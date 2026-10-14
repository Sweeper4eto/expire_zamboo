import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { saveDataUrl, saveUpload, UploadError } from "@/lib/upload";
import { apiT } from "@/i18n";

export async function POST(request: Request) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: apiT(request, "errors.missingFile") },
          { status: 400 },
        );
      }
      const path = await saveUpload(file);
      return NextResponse.json({ path });
    }

    const json = await request.json().catch(() => null);
    if (json?.dataUrl && typeof json.dataUrl === "string") {
      const path = await saveDataUrl(json.dataUrl);
      return NextResponse.json({ path });
    }

    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json(
        { error: apiT(request, error.errorKey) },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: apiT(request, "errors.uploadFailed") },
      { status: 400 },
    );
  }
}
