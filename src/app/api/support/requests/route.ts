import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { userCanAccessStore } from "@/lib/store-access";
import { apiT } from "@/i18n";
import {
  normalizeSupportEmail,
  validateSupportEmail,
} from "@/lib/register-validation";

const createSchema = z.object({
  topic: z.enum(["bug", "ocr", "billing", "other"]),
  storeId: z.string().min(1).optional().nullable(),
  contact: z.string().trim().max(120).optional().nullable(),
  message: z.string().trim().min(8).max(2000),
  guest: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }

    const asGuest = parsed.data.guest === true;
    const rawContact = parsed.data.contact?.trim() ?? "";
    const contactError = validateSupportEmail(rawContact);
    if (contactError) {
      return NextResponse.json(
        { error: apiT(request, contactError) },
        { status: 400 },
      );
    }

    const contact = normalizeSupportEmail(rawContact);

    if (asGuest) {
      const row = await db.supportRequest.create({
        data: {
          userId: null,
          clientId: null,
          storeId: null,
          topic: parsed.data.topic,
          contact,
          message: parsed.data.message.trim(),
        },
        select: { id: true, createdAt: true },
      });

      return NextResponse.json({
        ok: true,
        ticketId: row.id,
        createdAt: row.createdAt.toISOString(),
      });
    }

    const session = await requireSession({ allowMustChangePassword: true });
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { clientId: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: apiT(request, "errors.unauthorized") },
        { status: 401 },
      );
    }

    let storeId: string | null = null;
    if (parsed.data.storeId) {
      const store = await userCanAccessStore(session.userId, parsed.data.storeId);
      if (store) storeId = store.id;
    }

    const row = await db.supportRequest.create({
      data: {
        userId: session.userId,
        clientId: user.clientId ?? null,
        storeId,
        topic: parsed.data.topic,
        contact,
        message: parsed.data.message.trim(),
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({
      ok: true,
      ticketId: row.id,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("support request create failed", error);
    return NextResponse.json(
      { error: apiT(request, "errors.saveFailed") },
      { status: 500 },
    );
  }
}