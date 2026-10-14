import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { queryDocumentOcrUsage } from "@/lib/document-ocr-usage";
import { apiT } from "@/i18n";

async function requireAdminResponse(request: Request) {
  try {
    return await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }
}

export async function GET(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const { searchParams } = new URL(request.url);
    const result = await queryDocumentOcrUsage({
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("document-ocr-usage GET failed:", error);
    return NextResponse.json(
      { error: apiT(request, "errors.pageLoadFailed") },
      { status: 500 },
    );
  }
}
