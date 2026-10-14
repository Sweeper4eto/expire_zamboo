import { db } from "@/lib/db";
import { WHATS_NEW_CATALOG } from "@/lib/whats-new-catalog";

/**
 * Upsert catalog entries as Draft rows (or refresh copy on unpublished rows).
 * Does not change `active` — admin still decides what to Push.
 * Skips keys the admin has deleted (suppressed) so they do not reappear on Refresh.
 */
export async function syncWhatsNewCatalog(): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  const maxSort = await db.whatsNewItem.aggregate({ _max: { sortOrder: true } });
  let nextSort = (maxSort._max.sortOrder ?? 0) + 1;

  for (const entry of WHATS_NEW_CATALOG) {
    const href = entry.href?.trim() ? entry.href.trim() : null;
    const existing = await db.whatsNewItem.findUnique({
      where: { sourceKey: entry.key },
    });

    if (existing?.suppressed) {
      continue;
    }

    if (!existing) {
      await db.whatsNewItem.create({
        data: {
          sourceKey: entry.key,
          titleEn: entry.titleEn,
          titleBg: entry.titleBg,
          href,
          active: false,
          suppressed: false,
          sortOrder: nextSort,
        },
      });
      nextSort += 1;
      created += 1;
      continue;
    }

    // Refresh copy only while still draft so a live push is not rewritten mid-flight.
    if (!existing.active) {
      const same =
        existing.titleEn === entry.titleEn &&
        existing.titleBg === entry.titleBg &&
        (existing.href ?? null) === href;
      if (!same) {
        await db.whatsNewItem.update({
          where: { id: existing.id },
          data: {
            titleEn: entry.titleEn,
            titleBg: entry.titleBg,
            href,
          },
        });
        updated += 1;
      }
    }
  }

  return { created, updated };
}
