import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, changeOwnPassword } from "@/lib/auth";
import { auditUserPasswordChanged } from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { setSessionCookie } from "@/lib/session";
import { apiT } from "@/i18n";

const bodySchema = z.object({
  password: z.string().min(1),
  confirmPassword: z.string().min(1),
});

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession({ allowMustChangePassword: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "MUST_CHANGE_PASSWORD") {
      return NextResponse.json(
        { error: apiT(request, "auth.mustChangePassword"), code: "MUST_CHANGE_PASSWORD" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

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

  const result = await changeOwnPassword(session.userId, parsed.data.password);
  if (!result.ok) {
    return NextResponse.json(
      { error: apiT(request, result.errorKey) },
      { status: 400 },
    );
  }

  await setSessionCookie(result.token);
  await logAuditEvent(
    request,
    result.user,
    "user_password_changed",
    auditUserPasswordChanged(result.user.username),
  );

  return NextResponse.json({ user: result.user });
}
