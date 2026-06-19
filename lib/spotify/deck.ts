import type { Card } from "@/lib/engine/types";
import type { ResolvedYear, TrackQuery } from "@/lib/musicbrainz/types";
import type { SpotifyTrack } from "./types";

export function parseReleaseYear(releaseDate: string): number | null {
  const match = /^(\d{4})/.exec(releaseDate);
  if (!match) return null;
  return Number(match[1]);
}

export function buildTrackQueries(tracks: SpotifyTrack[]): TrackQuery[] {
  const queries: TrackQuery[] = [];
  for (const t of tracks) {
    const year = parseReleaseYear(t.releaseDate);
    if (year === null) continue;
    queries.push({
      spotifyTrackId: t.id,
      title: t.title,
      artist: t.artist,
      spotifyReleaseYear: year,
    });
  }
  return queries;
}

export function buildCard(track: SpotifyTrack, resolved: ResolvedYear): Card {
  return {
    id: track.id,
    uri: track.uri,
    title: track.title,
    artist: track.artist,
    year: resolved.year,
    yearSource: resolved.source,
    coverUrl: track.coverUrl,
  };
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function buildDeck(
  tracks: SpotifyTrack[],
  enrich: (queries: TrackQuery[]) => Promise<ResolvedYear[]>,
  rng: () => number = Math.random,
): Promise<Card[]> {
  const queries = buildTrackQueries(tracks);
  const resolved = await enrich(queries);
  const byId = new Map(resolved.map((r) => [r.spotifyTrackId, r]));
  const trackById = new Map(tracks.map((t) => [t.id, t]));

  const cards: Card[] = [];
  for (const [id, r] of byId) {
    const track = trackById.get(id);
    if (track) cards.push(buildCard(track, r));
  }
  return shuffle(cards, rng);
}
