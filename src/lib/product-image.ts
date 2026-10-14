import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { isLocalUploadPath, MAX_UPLOAD_FILE_BYTES } from "@/lib/upload";

export { isLocalUploadPath };

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const OFF_USER_AGENT =
  "Magazin/1.0 (https://github.com/Sweeper4eto/barcodescanner; product image fetch)";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isRemoteImageUrl(value: string | null | undefined): boolean {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function extensionFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split(".").pop()?.toLowerCase();
    if (ext && ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
      return ext === "jpeg" ? "jpg" : ext;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Download a remote product image into public/uploads and return the local path. */
export async function saveRemoteProductImage(
  imageUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!isRemoteImageUrl(imageUrl)) return null;

  try {
    const response = await fetchImpl(imageUrl, {
      headers: {
        "User-Agent": OFF_USER_AGENT,
        Accept: "image/*",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    if (!response.ok) return null;

    const contentType = (response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const ext =
      EXT_BY_TYPE[contentType] || extensionFromUrl(imageUrl) || "jpg";
    if (!["jpg", "png", "webp", "gif"].includes(ext)) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_UPLOAD_FILE_BYTES) return null;

    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);
    return `/uploads/${filename}`;
  } catch {
    return null;
  }
}

/**
 * Prefer a local upload path. If only a remote URL is available, optionally
 * download it; otherwise keep/store the remote URL.
 */
export async function resolveProductImagePath(options: {
  existingPath?: string | null;
  remoteUrl?: string | null;
  download?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  const existing = options.existingPath?.trim() || null;
  if (isLocalUploadPath(existing)) return existing;

  const remote = options.remoteUrl?.trim() || existing;
  if (!isRemoteImageUrl(remote)) return existing;

  if (options.download) {
    const local = await saveRemoteProductImage(
      remote!,
      options.fetchImpl ?? fetch,
    );
    if (local) return local;
  }

  return remote;
}
