import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { yearCache, type YearCacheRow } from "@/db/schema";
import type { ResolvedYear } from "./types";

export function rowsToResolved(rows: YearCacheRow[]): ResolvedYear[] {
  return rows.map((r) => ({
    spotifyTrackId: r.spotifyTrackId,
    year: r.resolvedYear,
    source: r.source,
  }));
}

export async function getCached(ids: string[]): Promise<ResolvedYear[]> {
  if (ids.length === 0) return [];
  const rows = await db.select().from(yearCache).where(inArray(yearCache.spotifyTrackId, ids));
  return rowsToResolved(rows);
}

export async function putCached(
  rows: Array<ResolvedYear & { title: string; artist: string }>,
): Promise<void> {
  if (rows.length === 0) return;
  await db
    .insert(yearCache)
    .values(
      rows.map((r) => ({
        spotifyTrackId: r.spotifyTrackId,
        title: r.title,
        artist: r.artist,
        resolvedYear: r.year,
        source: r.source,
      })),
    )
    .onConflictDoNothing();
}
