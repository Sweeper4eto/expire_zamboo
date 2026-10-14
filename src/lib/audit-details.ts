export const AUDIT_DETAILS_MAX = 900;

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "active" : "inactive";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

export function auditFieldChange(
  label: string,
  before: unknown,
  after: unknown,
): string | null {
  const from = formatAuditValue(before);
  const to = formatAuditValue(after);
  if (from === to) return null;
  return `${label} ${from} → ${to}`;
}

export function auditJoin(parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" · ")
    .slice(0, AUDIT_DETAILS_MAX);
}

export function auditSubjectWithChanges(
  subject: string,
  changes: Array<string | null>,
): string {
  const changed = changes.filter((part): part is string => Boolean(part));
  if (!changed.length) return auditJoin([subject]);
  return auditJoin([subject, `changes: ${changed.join("; ")}`]);
}

type ClientLike = {
  name: string;
  phone: string | null;
  additionalInfo: string | null;
  monthlyFeePerStore: number;
  active: boolean;
  homeUser: boolean;
  referredByClientId?: string | null;
};

export function auditClientCreated(client: ClientLike): string {
  return auditJoin([
    `client "${client.name}"`,
    client.phone ? `phone ${client.phone}` : null,
    client.additionalInfo ? `info: ${client.additionalInfo}` : null,
    formatAuditValue(client.active),
    client.homeUser ? "household" : null,
    client.referredByClientId ? `referredBy ${client.referredByClientId}` : null,
  ]);
}

export function auditClientUpdated(before: ClientLike, after: ClientLike): string {
  return auditSubjectWithChanges(`client "${after.name}"`, [
    auditFieldChange("name", before.name, after.name),
    auditFieldChange("phone", before.phone, after.phone),
    auditFieldChange("info", before.additionalInfo, after.additionalInfo),
    auditFieldChange("status", before.active, after.active),
    auditFieldChange(
      "household",
      before.homeUser ? "yes" : "no",
      after.homeUser ? "yes" : "no",
    ),
    auditFieldChange(
      "referredBy",
      before.referredByClientId ?? "—",
      after.referredByClientId ?? "—",
    ),
  ]);
}

export function auditClientDeleted(client: ClientLike): string {
  return auditJoin([
    `client "${client.name}"`,
    client.phone ? `phone ${client.phone}` : null,
  ]);
}

type StoreLike = {
  name: string;
  address: string | null;
  phone: string | null;
  additionalInfo: string | null;
  active: boolean;
  monthlyFee?: number;
};

export function auditStoreCreated(store: StoreLike, clientName: string): string {
  return auditJoin([
    `store "${store.name}"`,
    `client "${clientName}"`,
    store.monthlyFee !== undefined ? `fee ${store.monthlyFee} €` : null,
    store.address ? `address ${store.address}` : null,
    store.phone ? `phone ${store.phone}` : null,
    formatAuditValue(store.active),
  ]);
}

export function auditStoreUpdated(
  before: StoreLike,
  after: StoreLike,
  clientName: string,
): string {
  return auditSubjectWithChanges(`store "${after.name}" · client "${clientName}"`, [
    auditFieldChange("name", before.name, after.name),
    auditFieldChange("address", before.address, after.address),
    auditFieldChange("phone", before.phone, after.phone),
    auditFieldChange("info", before.additionalInfo, after.additionalInfo),
    auditFieldChange("fee", before.monthlyFee, after.monthlyFee),
    auditFieldChange("status", before.active, after.active),
  ]);
}

export function auditStoreDeleted(store: StoreLike, clientName: string): string {
  return auditJoin([
    `store "${store.name}"`,
    `client "${clientName}"`,
    store.address ? `address ${store.address}` : null,
  ]);
}

export function auditPaymentRecorded(input: {
  clientName: string;
  year: number;
  month: number;
  activeStoreCount: number;
  feePerStore: number;
  discount: number;
  amountPaid: number;
  notes?: string | null;
}): string {
  const period = `${input.year}-${String(input.month).padStart(2, "0")}`;
  return auditJoin([
    `client "${input.clientName}"`,
    `period ${period}`,
    `${input.activeStoreCount} locations · fees ${input.feePerStore} €`,
    input.discount > 0 ? `discount ${input.discount} €` : null,
    `paid ${input.amountPaid} €`,
    input.notes?.trim() ? `notes: ${input.notes.trim()}` : null,
  ]);
}

type UserAssignmentLike = {
  username: string;
  active: boolean;
  clientName: string | null;
  storeNames: string[];
  clientRole?: string | null;
};

export function auditUserUpdated(before: UserAssignmentLike, after: UserAssignmentLike): string {
  const beforeStores = before.storeNames.length
    ? before.storeNames.join(", ")
    : "—";
  const afterStores = after.storeNames.length ? after.storeNames.join(", ") : "—";

  return auditSubjectWithChanges(`user "${after.username}"`, [
    auditFieldChange("username", before.username, after.username),
    auditFieldChange("client", before.clientName, after.clientName),
    beforeStores !== afterStores ? `locations ${beforeStores} → ${afterStores}` : null,
    auditFieldChange("owner", before.clientRole === "OWNER", after.clientRole === "OWNER"),
    auditFieldChange("status", before.active, after.active),
  ]);
}

export function auditUserDeleted(user: UserAssignmentLike): string {
  return auditJoin([
    `user "${user.username}"`,
    user.clientName ? `client "${user.clientName}"` : null,
    user.storeNames.length ? `stores: ${user.storeNames.join(", ")}` : null,
    formatAuditValue(user.active),
  ]);
}

export function auditUserPasswordSet(username: string): string {
  return `password reset for user "${username}" (must change on next login)`;
}

export function auditUserPasswordChanged(username: string): string {
  return `password changed by user "${username}"`;
}

type ProductLike = {
  name: string;
  barcode: string;
  imagePath: string | null;
};

export function auditProductCreated(product: ProductLike): string {
  return auditJoin([
    `product "${product.name}"`,
    `barcode ${product.barcode}`,
    product.imagePath ? "with image" : "no image",
  ]);
}

export function auditProductUpdated(
  before: ProductLike,
  after: ProductLike,
  inventoryBarcodeUpdates = 0,
): string {
  return auditSubjectWithChanges(`product "${after.name}"`, [
    auditFieldChange("name", before.name, after.name),
    auditFieldChange("barcode", before.barcode, after.barcode),
    before.imagePath !== after.imagePath ? "image updated" : null,
    inventoryBarcodeUpdates > 0
      ? `inventory barcode synced (${inventoryBarcodeUpdates} entries)`
      : null,
  ]);
}

export function auditProductDeleted(
  product: ProductLike,
  removed?: { inventoryEntries: number; buyListEntries: number },
): string {
  return auditJoin([
    `product "${product.name}"`,
    `barcode ${product.barcode}`,
    removed && removed.inventoryEntries > 0
      ? `inventory entries removed (${removed.inventoryEntries})`
      : null,
    removed && removed.buyListEntries > 0
      ? `buy list entries removed (${removed.buyListEntries})`
      : null,
  ]);
}

export function auditInventoryAdded(input: {
  productName: string;
  barcode: string;
  quantity: number;
  storeName: string;
  expiryDate: Date;
}): string {
  return auditJoin([
    `product "${input.productName}"`,
    `barcode ${input.barcode}`,
    `qty ${input.quantity}`,
    `store "${input.storeName}"`,
    `expires ${input.expiryDate.toISOString().slice(0, 10)}`,
  ]);
}

export function auditInventoryMerged(input: {
  productName: string;
  barcode: string;
  addedQty: number;
  totalQty: number;
  storeName: string;
  expiryDate: Date;
}): string {
  return auditJoin([
    `product "${input.productName}"`,
    `barcode ${input.barcode}`,
    `added ${input.addedQty} → total ${input.totalQty}`,
    `store "${input.storeName}"`,
    `expires ${input.expiryDate.toISOString().slice(0, 10)}`,
  ]);
}

export function auditInventoryRemoved(input: {
  productName: string;
  barcode: string;
  quantity: number;
  storeName: string;
  expiryDate: Date;
}): string {
  return auditJoin([
    `removed "${input.productName}"`,
    `barcode ${input.barcode}`,
    `qty ${input.quantity}`,
    `store "${input.storeName}"`,
    `expires ${input.expiryDate.toISOString().slice(0, 10)}`,
  ]);
}

export function auditInventoryUpdated(input: {
  productName: string;
  barcode: string;
  storeName: string;
  beforeQty: number;
  afterQty: number;
  beforeExpiry: Date;
  afterExpiry: Date;
}): string {
  return auditSubjectWithChanges(`product "${input.productName}"`, [
    `barcode ${input.barcode}`,
    `store "${input.storeName}"`,
    auditFieldChange("qty", input.beforeQty, input.afterQty),
    auditFieldChange("expires", input.beforeExpiry, input.afterExpiry),
  ]);
}

export function auditInventoryPriceReduced(input: {
  productName: string;
  barcode: string;
  quantity: number;
  storeName: string;
  expiryDate: Date;
  discountPercent?: number;
}): string {
  return auditJoin([
    `price reduced for "${input.productName}"`,
    input.discountPercent !== undefined
      ? `discount ${input.discountPercent}%`
      : null,
    `barcode ${input.barcode}`,
    `qty ${input.quantity}`,
    `store "${input.storeName}"`,
    `expires ${input.expiryDate.toISOString().slice(0, 10)}`,
  ]);
}

export function auditInventoryPriceRestored(input: {
  productName: string;
  barcode: string;
  quantity: number;
  storeName: string;
  expiryDate: Date;
}): string {
  return auditJoin([
    `price reduction cleared for "${input.productName}"`,
    `barcode ${input.barcode}`,
    `qty ${input.quantity}`,
    `store "${input.storeName}"`,
    `expires ${input.expiryDate.toISOString().slice(0, 10)}`,
  ]);
}

export function auditAuthLogin(role: string, clientName?: string | null): string {
  return auditJoin([
    `role ${role}`,
    clientName ? `client "${clientName}"` : null,
  ]);
}

export function auditAuthRegister(username: string): string {
  return `new account "${username}"`;
}

export function auditBuyListAdded(input: {
  productName: string;
  barcode: string;
  quantity: number;
  storeName: string;
}): string {
  return auditJoin([
    `buy list "${input.productName}"`,
    `barcode ${input.barcode}`,
    `qty ${input.quantity}`,
    `store "${input.storeName}"`,
  ]);
}

export function auditBuyListMerged(input: {
  productName: string;
  barcode: string;
  addedQty: number;
  totalQty: number;
  storeName: string;
}): string {
  return auditJoin([
    `buy list "${input.productName}"`,
    `barcode ${input.barcode}`,
    `added ${input.addedQty} → total ${input.totalQty}`,
    `store "${input.storeName}"`,
  ]);
}

export function auditBuyListRemoved(input: {
  productName: string;
  barcode: string;
  quantity: number;
  storeName: string;
}): string {
  return auditJoin([
    `removed buy list "${input.productName}"`,
    `barcode ${input.barcode}`,
    `qty ${input.quantity}`,
    `store "${input.storeName}"`,
  ]);
}

export function auditBuyListUpdated(input: {
  productName: string;
  barcode: string;
  storeName: string;
  beforeQty: number;
  afterQty: number;
}): string {
  return auditSubjectWithChanges(`buy list "${input.productName}"`, [
    `barcode ${input.barcode}`,
    `store "${input.storeName}"`,
    auditFieldChange("qty", input.beforeQty, input.afterQty),
  ]);
}
