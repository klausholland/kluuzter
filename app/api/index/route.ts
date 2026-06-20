import { NextResponse } from "next/server";
import { getSessionAccessToken } from "@/lib/spotify/session-token";
import { enrichTracks } from "@/lib/musicbrainz/service";
import { isValidBatch } from "@/lib/musicbrainz/indexing";

export const maxDuration = 60;

export async function POST(request: Request) {
  const token = await getSessionAccessToken();
  if (!token) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  let body: { tracks?: unknown; force?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!isValidBatch(body.tracks)) {
    return NextResponse.json(
      { error: "tracks must be an array of at most 20 TrackQuery objects" },
      { status: 400 },
    );
  }
  const years = await enrichTracks(body.tracks, { force: body.force === true });
  return NextResponse.json({ years });
}
