import { db } from "@/lib/db";

/** Active user + active store (+ active client when assigned). */
export async function userCanAccessStore(userId: string, storeId: string) {
  const link = await db.userStore.findUnique({
    where: { userId_storeId: { userId, storeId } },
    include: {
      store: true,
      user: { include: { client: true } },
    },
  });

  if (!link?.store.active) return null;
  if (!link.user.active) return null;
  if (link.user.clientId) {
    if (!link.user.client?.active) return null;
    if (link.store.clientId !== link.user.clientId) return null;
  }

  return link.store;
}

/** Store users only (not home-user clients) — e.g. document OCR import. */
export async function userCanAccessRetailStore(
  userId: string,
  storeId: string,
) {
  const link = await db.userStore.findUnique({
    where: { userId_storeId: { userId, storeId } },
    include: {
      store: true,
      user: { include: { client: true } },
    },
  });

  if (!link?.store.active) return null;
  if (!link.user.active) return null;
  if (!link.user.client?.active) return null;
  if (link.user.client.homeUser) return null;
  if (link.store.clientId !== link.user.clientId) return null;

  return link.store;
}

/** Home-user clients only — orders / favourites. */
export async function userCanAccessHomeStore(userId: string, storeId: string) {
  const link = await db.userStore.findUnique({
    where: { userId_storeId: { userId, storeId } },
    include: {
      store: { include: { client: true } },
      user: { include: { client: true } },
    },
  });

  if (!link?.store.active) return null;
  if (!link.user.active) return null;
  if (!link.user.client?.homeUser || !link.user.client.active) return null;
  if (link.store.clientId !== link.user.clientId) return null;

  return link.store;
}