import { NextResponse } from "next/server";
import { getSessionAccessToken } from "@/lib/spotify/session-token";
import { getPlaylistTracks } from "@/lib/spotify/api";
import { dedupeTracks } from "@/lib/spotify/deck";
import { getCached } from "@/lib/musicbrainz/cache";
import { buildDeckFromCache } from "@/lib/musicbrainz/indexing";
import type { SpotifyTrack } from "@/lib/spotify/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const token = await getSessionAccessToken();
  if (!token) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  let body: { playlistIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.playlistIds) || body.playlistIds.length === 0) {
    return NextResponse.json(
      { error: "playlistIds must be a non-empty array" },
      { status: 400 },
    );
  }

  const all: SpotifyTrack[] = [];
  for (const id of body.playlistIds as string[]) {
    all.push(...(await getPlaylistTracks(token, id)));
  }
  const tracks = dedupeTracks(all);
  const cached = await getCached(tracks.map((t) => t.id));
  const deck = buildDeckFromCache(tracks, cached);

  if (deck.length === 0) {
    return NextResponse.json(
      { error: "no indexed tracks — please index the playlist first" },
      { status: 409 },
    );
  }
  return NextResponse.json({ deck });
}
