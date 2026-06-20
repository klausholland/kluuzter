import type { ResolvedYear, TrackQuery } from "./types";
import type { SpotifyTrack } from "@/lib/spotify/types";
import type { Card } from "@/lib/engine/types";
import { buildTrackQueries, buildCard, shuffle } from "@/lib/spotify/deck";

export type PlaylistStatus = {
  total: number;
  indexed: number;
  missing: TrackQuery[];
  all: TrackQuery[]; // alle indexierbaren Tracks (für „Neu indizieren"/force)
};

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function computeStatus(
  tracks: SpotifyTrack[],
  cached: ResolvedYear[],
): PlaylistStatus {
  const queries = buildTrackQueries(tracks); // nur Tracks mit parsbarem Jahr
  const cachedIds = new Set(cached.map((c) => c.spotifyTrackId));
  const missing = queries.filter((q) => !cachedIds.has(q.spotifyTrackId));
  return {
    total: queries.length,
    indexed: queries.length - missing.length,
    missing,
    all: queries,
  };
}

export function buildDeckFromCache(
  tracks: SpotifyTrack[],
  cached: ResolvedYear[],
  rng: () => number = Math.random,
): Card[] {
  const trackById = new Map(tracks.map((t) => [t.id, t]));
  const cards: Card[] = [];
  for (const r of cached) {
    const track = trackById.get(r.spotifyTrackId);
    if (track) cards.push(buildCard(track, r));
  }
  return shuffle(cards, rng);
}

export const INDEX_BATCH_SIZE = 20;

export function isValidBatch(tracks: unknown): tracks is TrackQuery[] {
  if (!Array.isArray(tracks)) return false;
  if (tracks.length > INDEX_BATCH_SIZE) return false;
  return tracks.every(
    (t) =>
      t != null &&
      typeof t.spotifyTrackId === "string" &&
      typeof t.title === "string" &&
      typeof t.artist === "string" &&
      typeof t.spotifyReleaseYear === "number",
  );
}
