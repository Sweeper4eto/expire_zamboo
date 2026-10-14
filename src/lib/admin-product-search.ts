import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type AdminProductListItem = {
  id: string;
  name: string;
  barcode: string;
  imagePath: string | null;
};

type SearchResult = {
  products: AdminProductListItem[];
  hasMore: boolean;
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function isBarcodeLike(q: string): boolean {
  const compact = q.replace(/\s/g, "");
  const digits = digitsOnly(compact);
  return digits.length >= 4 && digits.length === compact.length;
}

/**
 * Fast admin product search for large catalogs (millions of rows).
 *
 * Avoids COUNT(*) and ORDER BY on contains-matches — those force a full
 * table scan + sort on SQLite and make Items search unusable.
 */
export async function searchAdminProducts(
  q: string | undefined,
  page: number,
  pageSize: number,
): Promise<SearchResult> {
  const take = pageSize + 1;
  const skip = Math.max(0, (page - 1) * pageSize);
  const needle = q?.trim() ?? "";

  // Exclude synthetic no-barcode (NB…) rows — those are store-local scaffolding,
  // not shared catalog products.
  const catalogOnly = Prisma.sql`AND barcode NOT LIKE 'NB%'`;

  if (!needle) {
    const rows = await db.product.findMany({
      where: { NOT: { barcode: { startsWith: "NB" } } },
      orderBy: { name: "asc" },
      skip,
      take,
      select: { id: true, name: true, barcode: true, imagePath: true },
    });
    return {
      products: rows.slice(0, pageSize),
      hasMore: rows.length > pageSize,
    };
  }

  if (isBarcodeLike(needle)) {
    const digits = digitsOnly(needle);
    const prefix = `${digits}%`;
    const rows = await db.$queryRaw<AdminProductListItem[]>(Prisma.sql`
      SELECT id, name, barcode, imagePath
      FROM Product
      WHERE (barcode = ${digits} OR barcode LIKE ${prefix})
        ${catalogOnly}
      ORDER BY
        CASE WHEN barcode = ${digits} THEN 0 ELSE 1 END,
        barcode
      LIMIT ${take} OFFSET ${skip}
    `);
    return {
      products: rows.slice(0, pageSize),
      hasMore: rows.length > pageSize,
    };
  }

  const namePrefix = `${needle}%`;
  const prefixRows = await db.$queryRaw<AdminProductListItem[]>(Prisma.sql`
    SELECT id, name, barcode, imagePath
    FROM Product
    WHERE name LIKE ${namePrefix}
      ${catalogOnly}
    ORDER BY name
    LIMIT ${take} OFFSET ${skip}
  `);

  if (skip > 0) {
    return {
      products: prefixRows.slice(0, pageSize),
      hasMore: prefixRows.length > pageSize,
    };
  }

  if (prefixRows.length >= pageSize) {
    return {
      products: prefixRows.slice(0, pageSize),
      hasMore: prefixRows.length > pageSize,
    };
  }

  const needed = take - prefixRows.length;
  const excludeSql =
    prefixRows.length > 0
      ? Prisma.sql`AND id NOT IN (${Prisma.join(prefixRows.map((row) => row.id))})`
      : Prisma.empty;

  const contains = `%${needle}%`;
  const extraRows = await db.$queryRaw<AdminProductListItem[]>(Prisma.sql`
    SELECT id, name, barcode, imagePath
    FROM Product
    WHERE (name LIKE ${contains} OR barcode LIKE ${contains})
      ${catalogOnly}
    ${excludeSql}
    LIMIT ${needed}
  `);

  const merged = [...prefixRows, ...extraRows];
  return {
    products: merged.slice(0, pageSize),
    hasMore: merged.length > pageSize,
  };
}
