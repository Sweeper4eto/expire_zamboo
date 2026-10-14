import type { MessageKey } from "@/i18n";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MAX = 72;
export const ORG_NAME_MAX = 80;

const USERNAME_RE = /^[a-z0-9_]+$/;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validateUsername(username: string): MessageKey | null {
  const normalized = normalizeUsername(username);
  if (!normalized) return "auth.usernameRequired";
  if (normalized.length < USERNAME_MIN) return "auth.usernameTooShort";
  if (normalized.length > USERNAME_MAX) return "auth.usernameTooLong";
  if (!USERNAME_RE.test(normalized)) return "auth.usernameInvalid";
  return null;
}

/** Any non-empty password up to PASSWORD_MAX is allowed. Strength UI is advisory only. */
export function validatePassword(password: string): MessageKey | null {
  if (!password) return "auth.passwordRequired";
  if (password.length > PASSWORD_MAX) return "auth.passwordTooLong";
  return null;
}

export function validateOptionalEmail(email: string): MessageKey | null {
  const trimmed = email.trim();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.toLowerCase())) {
    return "auth.invalidEmail";
  }
  return null;
}

export function normalizeSupportEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateSupportEmail(email: string): MessageKey | null {
  const normalized = normalizeSupportEmail(email);
  if (!normalized) return "support.contactRequired";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return "auth.invalidEmail";
  }
  return null;
}

export function validateOptionalOrgName(name: string): MessageKey | null {
  if (name.trim().length > ORG_NAME_MAX) return "auth.organizationNameTooLong";
  return null;
}

export function passwordsMatch(password: string, confirm: string): boolean {
  return password === confirm;
}