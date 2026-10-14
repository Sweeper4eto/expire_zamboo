export type ZambooMaterialDto = {
  gId: string;
  name?: string | null;
  altName?: string | null;
  code?: number | string | null;
  basePrice?: number | null;
  itemType?: number | null;
  uom?: { name?: string | null } | null;
  category?: { name?: string | null } | null;
  type?: { name?: string | null } | null;
};

export function isZambooConfigured(): boolean {
  return Boolean(process.env.ZAMBOO_API_KEY?.trim());
}

export function zambooApiBase(): string {
  return (process.env.ZAMBOO_API_BASE || "https://sweps.zamboo.bg").replace(
    /\/$/,
    "",
  );
}

export async function fetchZambooItems(
  fetchImpl: typeof fetch = fetch,
): Promise<ZambooMaterialDto[]> {
  const apiKey = process.env.ZAMBOO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ZAMBOO_NOT_CONFIGURED");
  }

  const url = new URL("/api/GetAllItems", `${zambooApiBase()}/`);
  url.searchParams.set("apiKey", apiKey);
  const dbGuid = process.env.ZAMBOO_DB_GUID?.trim();
  if (dbGuid) url.searchParams.set("dbGuid", dbGuid);

  const response = await fetchImpl(url.toString(), {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    throw new Error(`ZAMBOO_FETCH_${response.status}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("ZAMBOO_FETCH_INVALID");
  }
  return data as ZambooMaterialDto[];
}
