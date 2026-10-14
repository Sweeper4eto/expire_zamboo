import { NextResponse } from "next/server";
import { z } from "zod";
import { auditUserPasswordSet } from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { apiT } from "@/i18n";

async function requireAdminResponse(request: Request) {
  try {
    return await requireAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "MUST_CHANGE_PASSWORD") {
      return NextResponse.json(
        { error: apiT(request, "auth.mustChangePassword"), code: "MUST_CHANGE_PASSWORD" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }
}

const bodySchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(6).max(72),
  confirmPassword: z.string().min(1),
});

export async function POST(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return NextResponse.json(
      { error: apiT(request, "auth.passwordMismatch") },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, username: true, role: true },
  });
  if (!user) {
    return NextResponse.json(
      { error: apiT(request, "errors.userNotFound") },
      { status: 404 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: true,
    },
  });

  await logAuditEvent(
    request,
    admin,
    "user_password_set",
    auditUserPasswordSet(user.username),
  );

  return NextResponse.json({ ok: true });
}
