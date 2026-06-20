import { NextResponse } from "next/server";
import { getSessionAccessToken } from "@/lib/spotify/session-token";
import { getPlaylistTracks } from "@/lib/spotify/api";
import { getCached } from "@/lib/musicbrainz/cache";
import { computeStatus } from "@/lib/musicbrainz/indexing";

export const maxDuration = 60;

export async function GET(request: Request) {
  const token = await getSessionAccessToken();
  if (!token) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing playlist id" }, { status: 400 });
  }
  const tracks = await getPlaylistTracks(token, id);
  const cached = await getCached(tracks.map((t) => t.id));
  return NextResponse.json(computeStatus(tracks, cached));
}
