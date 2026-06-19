import type { TrackQuery, ResolvedYear } from "./types";

export type ResolveDeps = {
  getCached: (ids: string[]) => Promise<ResolvedYear[]>;
  putCached: (
    rows: Array<ResolvedYear & { title: string; artist: string }>,
  ) => Promise<void>;
  lookup: (q: TrackQuery) => Promise<number | null>;
  limit: <T>(fn: () => Promise<T>) => Promise<T>;
};

export async function resolveYears(
  queries: TrackQuery[],
  deps: ResolveDeps,
): Promise<ResolvedYear[]> {
  const cached = await deps.getCached(queries.map((q) => q.spotifyTrackId));
  const cachedById = new Map(cached.map((c) => [c.spotifyTrackId, c]));

  const misses = queries.filter((q) => !cachedById.has(q.spotifyTrackId));

  const fresh: Array<ResolvedYear & { title: string; artist: string }> = [];
  for (const q of misses) {
    const mbYear = await deps.limit(() => deps.lookup(q));
    const resolved: ResolvedYear & { title: string; artist: string } =
      mbYear !== null
        ? {
            spotifyTrackId: q.spotifyTrackId,
            year: mbYear,
            source: "musicbrainz",
            title: q.title,
            artist: q.artist,
          }
        : {
            spotifyTrackId: q.spotifyTrackId,
            year: q.spotifyReleaseYear,
            source: "spotify",
            title: q.title,
            artist: q.artist,
          };
    fresh.push(resolved);
  }

  if (fresh.length > 0) {
    try {
      await deps.putCached(fresh);
    } catch {
      // Cache-Schreibfehler sind nicht fatal.
    }
  }

  const freshById = new Map(fresh.map((f) => [f.spotifyTrackId, f]));
  return queries.map((q) => {
    const hit = cachedById.get(q.spotifyTrackId) ?? freshById.get(q.spotifyTrackId)!;
    return { spotifyTrackId: hit.spotifyTrackId, year: hit.year, source: hit.source };
  });
}
