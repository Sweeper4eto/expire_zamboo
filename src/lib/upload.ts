import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import type { MessageKey } from "@/i18n";

/** Max size for user uploads (multipart file or data URL). Keep in sync with camera-capture picker check. */
export const MAX_UPLOAD_FILE_BYTES = 12 * 1024 * 1024;

const UPLOAD_DIR =
  process.env.MAGAZIN_UPLOAD_DIR?.trim() ||
  path.join(process.cwd(), "public", "uploads");

export class UploadError extends Error {
  constructor(public readonly errorKey: MessageKey) {
    super(errorKey);
  }
}

export function isLocalUploadPath(value: string | null | undefined): boolean {
  return Boolean(value && /^\/uploads\/[^/]+$/.test(value));
}

/** Resolve a /uploads/... path to an absolute file under public/uploads, or null. */
export function resolveLocalUploadPath(
  imagePath: string | null | undefined,
): string | null {
  if (!isLocalUploadPath(imagePath)) return null;
  const filename = imagePath!.slice("/uploads/".length);
  if (
    !filename ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    return null;
  }
  return path.join(UPLOAD_DIR, filename);
}

/** Delete a local upload file if it lives under public/uploads. Ignores CDN URLs. */
export async function deleteLocalUpload(
  imagePath: string | null | undefined,
): Promise<boolean> {
  const filePath = resolveLocalUploadPath(imagePath);
  if (!filePath) return false;
  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function saveUpload(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const allowed = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  if (!allowed.has(ext)) {
    throw new UploadError("errors.invalidFileFormat");
  }

  if (buffer.length > MAX_UPLOAD_FILE_BYTES) {
    throw new UploadError("errors.fileTooLarge");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

const DATA_URL_EXT: Record<string, string> = {
  jpeg: "jpg",
  jpg: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
};

export async function saveDataUrl(dataUrl: string): Promise<string> {
  const match = dataUrl.match(
    /^data:image\/([\w+-]+);(?:charset=[\w-]+;)?base64,(.+)$/,
  );
  if (!match) {
    throw new UploadError("errors.invalidImage");
  }

  const ext = DATA_URL_EXT[match[1].toLowerCase()];
  if (!ext) {
    throw new UploadError("errors.invalidImage");
  }
  const buffer = Buffer.from(match[2], "base64");

  if (buffer.length > MAX_UPLOAD_FILE_BYTES) {
    throw new UploadError("errors.fileTooLarge");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}
