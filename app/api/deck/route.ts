import { NextResponse } from "next/server";
import { getSessionAccessToken } from "@/lib/spotify/session-token";
import { getPlaylistTracks } from "@/lib/spotify/api";
import { buildDeck, dedupeTracks } from "@/lib/spotify/deck";
import { enrichTracks } from "@/lib/musicbrainz/service";
import type { SpotifyTrack } from "@/lib/spotify/types";

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
    return NextResponse.json({ error: "playlistIds must be a non-empty array" }, { status: 400 });
  }

  const all: SpotifyTrack[] = [];
  for (const id of body.playlistIds as string[]) {
    all.push(...(await getPlaylistTracks(token, id)));
  }
  const deck = await buildDeck(dedupeTracks(all), enrichTracks);
  return NextResponse.json({ deck });
}
