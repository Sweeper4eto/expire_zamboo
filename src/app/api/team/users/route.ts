import { NextResponse } from "next/server";
import { z } from "zod";
import { isOnlyClientOwner, requireClientOwner } from "@/lib/client-owner";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import {
  parseUsernameChange,
  syncDenormalizedUsername,
  usernameIsTaken,
} from "@/lib/rename-username";
import { normalizeUsername, validateUsername } from "@/lib/register-validation";
import { apiT } from "@/i18n";

async function ownerOrForbidden(request: Request) {
  try {
    return await requireClientOwner();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED" || message === "PAYMENT_REQUIRED") {
      return NextResponse.json(
        { error: apiT(request, "errors.unauthorized") },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }
}

export async function GET(request: Request) {
  const owner = await ownerOrForbidden(request);
  if (owner instanceof NextResponse) return owner;

  const users = await db.user.findMany({
    where: { clientId: owner.clientId, role: "USER" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      active: true,
      clientRole: true,
      storeLinks: {
        select: {
          store: { select: { id: true, name: true, active: true } },
        },
      },
    },
  });

  const stores = await db.store.findMany({
    where: { clientId: owner.clientId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, active: true },
  });

  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      active: user.active,
      clientRole: user.clientRole,
      stores: user.storeLinks.map((link) => link.store),
    })),
    stores,
  });
}

function normalizeDisplayName(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed.slice(0, 80) : null;
}

const createSchema = z.object({
  username: z.string().min(1),
  displayName: z.string().max(80).optional().nullable(),
  password: z.string().min(1),
  storeIds: z.array(z.string().min(1)).default([]),
  clientRole: z.enum(["OWNER", "MEMBER"]).optional(),
});

export async function POST(request: Request) {
  const owner = await ownerOrForbidden(request);
  if (owner instanceof NextResponse) return owner;

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const username = normalizeUsername(parsed.data.username);
  const usernameError = validateUsername(username);
  if (usernameError) {
    return NextResponse.json(
      { error: apiT(request, usernameError) },
      { status: 400 },
    );
  }
  if (parsed.data.password.length < 6) {
    return NextResponse.json(
      { error: apiT(request, "auth.passwordTooShort") },
      { status: 400 },
    );
  }
  if (parsed.data.password.length > 72) {
    return NextResponse.json(
      { error: apiT(request, "auth.passwordTooLong") },
      { status: 400 },
    );
  }

  const existing = await db.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: apiT(request, "auth.usernameTaken") },
      { status: 400 },
    );
  }

  const clientStores = await db.store.findMany({
    where: { clientId: owner.clientId, active: true },
    select: { id: true },
  });
  const allowed = new Set(clientStores.map((store) => store.id));
  const storeIds = parsed.data.storeIds.filter((id) => allowed.has(id));
  if (storeIds.length === 0 && clientStores[0]) {
    storeIds.push(clientStores[0].id);
  }

  const user = await db.user.create({
    data: {
      username,
      displayName: normalizeDisplayName(parsed.data.displayName),
      passwordHash: await hashPassword(parsed.data.password),
      role: "USER",
      clientRole: parsed.data.clientRole === "OWNER" ? "OWNER" : "MEMBER",
      clientId: owner.clientId,
      storeLinks: {
        create: storeIds.map((storeId) => ({ storeId })),
      },
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      active: true,
      clientRole: true,
      storeLinks: {
        select: { store: { select: { id: true, name: true, active: true } } },
      },
    },
  });

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      active: user.active,
      clientRole: user.clientRole,
      stores: user.storeLinks.map((link) => link.store),
    },
  });
}

const patchSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1).optional(),
  displayName: z.string().max(80).optional().nullable(),
  password: z.string().min(1).optional(),
  confirmPassword: z.string().optional(),
  active: z.boolean().optional(),
  storeIds: z.array(z.string().min(1)).optional(),
  clientRole: z.enum(["OWNER", "MEMBER"]).optional(),
});

export async function PATCH(request: Request) {
  const owner = await ownerOrForbidden(request);
  if (owner instanceof NextResponse) return owner;

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const target = await db.user.findFirst({
    where: {
      id: parsed.data.userId,
      clientId: owner.clientId,
      role: "USER",
    },
    select: { id: true, clientRole: true, username: true },
  });
  if (!target) {
    return NextResponse.json(
      { error: apiT(request, "errors.userNotFound") },
      { status: 404 },
    );
  }

  if (target.id === owner.userId && parsed.data.active === false) {
    return NextResponse.json(
      { error: apiT(request, "errors.cannotDeactivateSelf") },
      { status: 400 },
    );
  }

  if (
    parsed.data.clientRole === "MEMBER" &&
    target.clientRole === "OWNER" &&
    (await isOnlyClientOwner(target.id, owner.clientId))
  ) {
    return NextResponse.json(
      { error: apiT(request, "errors.cannotRemoveLastOwner") },
      { status: 400 },
    );
  }

  if (
    target.clientRole === "OWNER" &&
    parsed.data.active === false &&
    (await isOnlyClientOwner(target.id, owner.clientId))
  ) {
    return NextResponse.json(
      { error: apiT(request, "errors.cannotDeactivateLastOwner") },
      { status: 400 },
    );
  }

  let nextUsername: string | undefined;
  if (parsed.data.username !== undefined) {
    const usernameChange = parseUsernameChange(
      parsed.data.username,
      target.username,
    );
    if (!usernameChange.ok) {
      return NextResponse.json(
        { error: apiT(request, usernameChange.errorKey) },
        { status: 400 },
      );
    }
    if (
      usernameChange.username &&
      (await usernameIsTaken(db, usernameChange.username, target.id))
    ) {
      return NextResponse.json(
        { error: apiT(request, "auth.usernameTaken") },
        { status: 400 },
      );
    }
    if (usernameChange.username) nextUsername = usernameChange.username;
  }

  let nextPasswordHash: string | undefined;
  if (parsed.data.password !== undefined && parsed.data.password.length > 0) {
    if (parsed.data.password.length < 6) {
      return NextResponse.json(
        { error: apiT(request, "auth.passwordTooShort") },
        { status: 400 },
      );
    }
    if (parsed.data.password.length > 72) {
      return NextResponse.json(
        { error: apiT(request, "auth.passwordTooLong") },
        { status: 400 },
      );
    }
    if (parsed.data.password !== (parsed.data.confirmPassword ?? "")) {
      return NextResponse.json(
        { error: apiT(request, "auth.passwordMismatch") },
        { status: 400 },
      );
    }
    nextPasswordHash = await hashPassword(parsed.data.password);
  }

  if (parsed.data.storeIds) {
    const clientStores = await db.store.findMany({
      where: { clientId: owner.clientId },
      select: { id: true },
    });
    const allowed = new Set(clientStores.map((store) => store.id));
    const storeIds = parsed.data.storeIds.filter((id) => allowed.has(id));

    await db.$transaction([
      db.userStore.deleteMany({ where: { userId: target.id } }),
      db.userStore.createMany({
        data: storeIds.map((storeId) => ({ userId: target.id, storeId })),
      }),
    ]);
  }

  const updateData: {
    username?: string;
    displayName?: string | null;
    passwordHash?: string;
    mustChangePassword?: boolean;
    active?: boolean;
    clientRole?: "OWNER" | "MEMBER";
  } = {};
  if (nextUsername !== undefined) updateData.username = nextUsername;
  if (parsed.data.displayName !== undefined) {
    updateData.displayName = normalizeDisplayName(parsed.data.displayName);
  }
  if (nextPasswordHash !== undefined) {
    updateData.passwordHash = nextPasswordHash;
    updateData.mustChangePassword = true;
  }
  if (parsed.data.active !== undefined) updateData.active = parsed.data.active;
  if (parsed.data.clientRole !== undefined) updateData.clientRole = parsed.data.clientRole;

  if (Object.keys(updateData).length > 0) {
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: updateData,
      });
      if (nextUsername) {
        await syncDenormalizedUsername(tx, target.id, nextUsername);
      }
    });
  }

  const updated = await db.user.findUniqueOrThrow({
    where: { id: target.id },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      active: true,
      clientRole: true,
      storeLinks: {
        select: { store: { select: { id: true, name: true, active: true } } },
      },
    },
  });

  return NextResponse.json({
    user: {
      id: updated.id,
      username: updated.username,
      displayName: updated.displayName,
      email: updated.email,
      active: updated.active,
      clientRole: updated.clientRole,
      stores: updated.storeLinks.map((link) => link.store),
    },
  });
}

const deleteSchema = z.object({
  userId: z.string().min(1),
});

export async function DELETE(request: Request) {
  const owner = await ownerOrForbidden(request);
  if (owner instanceof NextResponse) return owner;

  const json = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const target = await db.user.findFirst({
    where: {
      id: parsed.data.userId,
      clientId: owner.clientId,
      role: "USER",
    },
    select: { id: true, clientRole: true },
  });
  if (!target) {
    return NextResponse.json(
      { error: apiT(request, "errors.userNotFound") },
      { status: 404 },
    );
  }

  if (target.id === owner.userId) {
    return NextResponse.json(
      { error: apiT(request, "errors.cannotDeleteSelf") },
      { status: 400 },
    );
  }

  if (
    target.clientRole === "OWNER" &&
    (await isOnlyClientOwner(target.id, owner.clientId))
  ) {
    return NextResponse.json(
      { error: apiT(request, "errors.cannotDeleteLastOwner") },
      { status: 400 },
    );
  }

  await db.user.delete({ where: { id: target.id } });
  return NextResponse.json({ ok: true });
}