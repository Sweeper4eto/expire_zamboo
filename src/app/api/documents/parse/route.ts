export const maxDuration = 120;

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { userCanAccessRetailStore } from "@/lib/store-access";
import {
  extractDocumentRows,
  extractDocumentRowsFromPath,
  getDocumentAiStatus,
  isDocumentAiConfigured,
} from "@/lib/document-ai";
import { matchDocumentRows } from "@/lib/document-match";
import { matchZambooRows } from "@/lib/zamboo/match";
import {
  mockDocumentOcrRows,
  shouldMockDocumentOcr,
} from "@/lib/document-ocr-mock";
import { takeDocumentOcrSlot } from "@/lib/document-ocr-rate-limit";
import { recordDocumentOcrScan } from "@/lib/document-ocr-usage";
import { notifyAdminsDocumentAiFailure } from "@/lib/document-ai-admin-alert";
import { deleteLocalUpload } from "@/lib/upload";
import { apiT } from "@/i18n";

const parseSchema = z
  .object({
    storeId: z.string().min(1),
    dataUrl: z.string().min(32).optional(),
    imagePath: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.dataUrl || value.imagePath), {
    message: "image required",
  });

function providerErrorDetail(message: string): string {
  if (!message.startsWith("OCR_PROVIDER:")) return message;
  const rest = message.slice("OCR_PROVIDER:".length);
  return /^\d{3}:/.test(rest) ? rest.slice(4).trim() : rest.trim();
}

function publicOcrError(request: Request, message: string): string {
  const lower = message.toLowerCase();
  if (message === "OCR_CASCADE_EXHAUSTED") {
    return apiT(request, "errors.documentAiTryAgainLater");
  }
  if (
    lower.includes("free_tier") ||
    lower.includes("generate_content_free_tier")
  ) {
    return apiT(request, "errors.documentAiQuotaExceeded");
  }
  if (message.startsWith("OCR_PROVIDER:")) {
    const detail = providerErrorDetail(message);
    return detail
      ? `Document AI error: ${detail}`
      : apiT(request, "errors.documentParseFailed");
  }
  if (message.startsWith("OCR_EMPTY:")) {
    return apiT(request, "errors.documentNoItems");
  }
  if (message === "OCR_PARSE_FAILED") {
    return apiT(request, "errors.documentParseFailed");
  }
  if (message === "OCR_NOT_CONFIGURED") {
    return apiT(request, "errors.documentAiNotConfigured");
  }
  return apiT(request, "errors.documentParseFailed");
}

export async function POST(request: Request) {
  // Outer guard: never let an unhandled throw become an HTML 500 (which the
  // client cannot parse and mis-reports as a body-size error).
  try {
    let session;
    try {
      session = await requireSession();
    } catch {
      return NextResponse.json(
        { error: apiT(request, "errors.unauthorized") },
        { status: 401 },
      );
    }

    const useMock = shouldMockDocumentOcr();
    if (!useMock && !isDocumentAiConfigured()) {
      return NextResponse.json(
        { error: apiT(request, "errors.documentAiNotConfigured") },
        { status: 503 },
      );
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }
    const parsed = parseSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }

    let store;
    try {
      store = await userCanAccessRetailStore(
        session.userId,
        parsed.data.storeId,
      );
    } catch (error) {
      console.error("document parse: store access check failed", error);
      return NextResponse.json(
        { error: apiT(request, "errors.pageLoadFailed") },
        { status: 503 },
      );
    }
    if (!store) {
      return NextResponse.json(
        { error: apiT(request, "errors.noStoreAccess") },
        { status: 403 },
      );
    }

    const retryAfterMs = takeDocumentOcrSlot(session.userId);
    if (retryAfterMs !== null) {
      return NextResponse.json(
        { error: apiT(request, "errors.documentScanRateLimited") },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
        },
      );
    }

    void recordDocumentOcrScan({
      userId: session.userId,
      username: session.username,
      storeId: parsed.data.storeId,
    });

    try {
      const extractStart = Date.now();
      let rows;
      if (useMock) {
        // Brief delay so the processing UI is visible while testing design.
        await new Promise((r) => setTimeout(r, 700));
        rows = mockDocumentOcrRows();
        console.info(
          `[document parse] OCR mock — ${rows.length} rows (set OCR_MOCK=0 for real AI)`,
        );
        if (parsed.data.imagePath) {
          await deleteLocalUpload(parsed.data.imagePath);
        }
      } else {
        rows = parsed.data.imagePath
          ? await extractDocumentRowsFromPath(parsed.data.imagePath)
          : await extractDocumentRows(parsed.data.dataUrl!);
        if (parsed.data.imagePath) {
          await deleteLocalUpload(parsed.data.imagePath);
        }
      }
      const extractMs = Date.now() - extractStart;

      if (rows.length === 0) {
        return NextResponse.json(
          { error: apiT(request, "errors.documentNoItems") },
          { status: 422 },
        );
      }
      const matchStart = Date.now();
      const items = await matchDocumentRows(parsed.data.storeId, rows);
      const zambooStart = Date.now();
      const zambooMatches = await matchZambooRows(rows);
      const merged = items.map((item, index) => {
        const zamboo = zambooMatches[index];
        return {
          ...item,
          zambooGid: zamboo?.gId ?? null,
          zambooName: zamboo?.name ?? null,
          zambooCode: zamboo?.code ?? null,
          zambooMatch: zamboo?.source ?? null,
          zambooConfidence: zamboo?.confidence ?? null,
        };
      });
      console.log(
        `document parse timing: extract=${extractMs}ms match=${Date.now() - matchStart}ms zamboo=${Date.now() - zambooStart}ms rows=${rows.length}${useMock ? " mock=1" : ""}`,
      );
      return NextResponse.json({ items: merged, mock: useMock || undefined });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "INVALID_IMAGE") {
        return NextResponse.json(
          { error: apiT(request, "errors.invalidImage") },
          { status: 400 },
        );
      }
      const status = getDocumentAiStatus();
      console.error("document parse failed", {
        message,
        provider: status.provider,
        model: status.model,
        error,
      });
      void notifyAdminsDocumentAiFailure(message);
      return NextResponse.json(
        { error: publicOcrError(request, message) },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error("document parse: unhandled error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message
            ? `Server error: ${error.message}`
            : apiT(request, "errors.documentParseFailed"),
      },
      { status: 500 },
    );
  }
}
