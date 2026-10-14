import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createSessionToken,
  getSession,
  type SessionPayload,
} from "@/lib/session";
import type { MessageKey } from "@/i18n";
import type { ClientRole, User } from "@/generated/prisma/client";
import {
  normalizeUsername,
  validateOptionalEmail,
  validateOptionalOrgName,
  validatePassword,
  validateUsername,
} from "@/lib/register-validation";

export type AuthUser = Pick<
  User,
  | "id"
  | "username"
  | "role"
  | "active"
  | "clientId"
  | "clientRole"
  | "mustChangePassword"
>;

export type AuthFailure = {
  ok: false;
  errorKey: MessageKey;
  code?: "NO_CLIENT" | "MUST_CHANGE_PASSWORD" | "PAYMENT_REQUIRED";
};

export type RegisterAccountType = "home" | "retail";

export type RegisterOptions = {
  accountType: RegisterAccountType;
  organizationName?: string;
  email?: string | null;
};

export function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function isValidEmail(email: string): boolean {
  // Practical validation: local@domain with a dot in the domain.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function defaultOrgName(username: string, accountType: RegisterAccountType): string {
  if (accountType === "home") {
    return `${username}'s household`;
  }
  return `${username}'s business`;
}

function defaultLocationName(accountType: RegisterAccountType): string {
  return accountType === "home" ? "Home" : "Main";
}

export async function registerUser(
  username: string,
  password: string,
  options: RegisterOptions,
): Promise<{ ok: true; user: AuthUser; token: string } | AuthFailure> {
  const usernameError = validateUsername(username);
  if (usernameError) {
    return { ok: false, errorKey: usernameError };
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { ok: false, errorKey: passwordError };
  }
  const orgError = validateOptionalOrgName(options.organizationName ?? "");
  if (orgError) {
    return { ok: false, errorKey: orgError };
  }

  const normalized = normalizeUsername(username);
  const email = normalizeEmail(options.email);
  const emailError = validateOptionalEmail(email ?? "");
  if (emailError) {
    return { ok: false, errorKey: emailError };
  }

  const existing = await db.user.findUnique({ where: { username: normalized } });
  if (existing) {
    return { ok: false, errorKey: "auth.usernameTaken" };
  }

  if (email) {
    const emailTaken = await db.user.findUnique({ where: { email } });
    if (emailTaken) {
      return { ok: false, errorKey: "auth.emailTaken" };
    }
  }

  const orgName =
    options.organizationName?.trim() ||
    defaultOrgName(normalized, options.accountType);
  const homeUser = options.accountType === "home";
  const passwordHash = await hashPassword(password);

  const user = await db.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        name: orgName,
        homeUser,
        active: true,
      },
    });

    // Every new account gets a default location (Home / Main) so the owner can
    // use the app immediately; they can rename it later in admin or settings.
    const store = await tx.store.create({
      data: {
        clientId: client.id,
        name: defaultLocationName(options.accountType),
        active: true,
      },
    });

    return tx.user.create({
      data: {
        username: normalized,
        email,
        passwordHash,
        role: "USER",
        clientRole: "OWNER",
        clientId: client.id,
        storeLinks: { create: [{ storeId: store.id }] },
      },
      select: {
        id: true,
        username: true,
        role: true,
        active: true,
        clientId: true,
        clientRole: true,
        mustChangePassword: true,
      },
    });
  });

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    clientId: user.clientId,
    mustChangePassword: user.mustChangePassword,
  });

  return { ok: true, user, token };
}

export async function loginUser(
  username: string,
  password: string,
): Promise<
  | { ok: true; token: string; user: AuthUser }
  | AuthFailure
> {
  const normalized = username.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { username: normalized } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, errorKey: "auth.invalidCredentials" };
  }

  if (!user.active) {
    return { ok: false, errorKey: "auth.accountDeactivated" };
  }

  if (user.role === "USER" && !user.clientId) {
    return {
      ok: false,
      code: "NO_CLIENT",
      errorKey: "auth.noClientAssigned",
    };
  }

  if (user.role === "USER" && user.clientId) {
    const client = await db.client.findUnique({ where: { id: user.clientId } });
    if (!client?.active) {
      return { ok: false, errorKey: "auth.clientDeactivated" };
    }
    const { clientRequiresPayment } = await import("@/lib/app-config");
    if (await clientRequiresPayment(user.clientId)) {
      return {
        ok: false,
        code: "PAYMENT_REQUIRED",
        errorKey: "auth.paymentRequired",
      };
    }
  }

  const payload: SessionPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    clientId: user.clientId,
    mustChangePassword: user.mustChangePassword,
  };

  return {
    ok: true,
    token: await createSessionToken(payload),
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      active: user.active,
      clientId: user.clientId,
      clientRole: user.clientRole,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

export async function changeOwnPassword(
  userId: string,
  nextPassword: string,
): Promise<{ ok: true; token: string; user: AuthUser } | AuthFailure> {
  const passwordError = validatePassword(nextPassword);
  if (passwordError) {
    return { ok: false, errorKey: passwordError };
  }

  const passwordHash = await hashPassword(nextPassword);
  const user = await db.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
    select: {
      id: true,
      username: true,
      role: true,
      active: true,
      clientId: true,
      clientRole: true,
      mustChangePassword: true,
    },
  });

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    clientId: user.clientId,
    mustChangePassword: false,
  });

  return { ok: true, token, user };
}

export async function requireSession(options?: {
  allowMustChangePassword?: boolean;
}): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      active: true,
      mustChangePassword: true,
      role: true,
      clientId: true,
      username: true,
    },
  });
  if (!user?.active) {
    throw new Error("UNAUTHORIZED");
  }
  if (user.mustChangePassword && !options?.allowMustChangePassword) {
    throw new Error("MUST_CHANGE_PASSWORD");
  }

  if (user.role === "USER" && user.clientId) {
    const { clientRequiresPayment } = await import("@/lib/app-config");
    if (await clientRequiresPayment(user.clientId)) {
      const { clearSessionCookie } = await import("@/lib/session");
      await clearSessionCookie();
      throw new Error("PAYMENT_REQUIRED");
    }
  }

  return {
    ...session,
    // Prefer live DB username so renames apply without forcing re-login.
    username: user.username,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export type { ClientRole };

export { paymentAmount, expiryListVisible } from "@/lib/expiry";
