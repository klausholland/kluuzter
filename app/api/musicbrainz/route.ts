import { NextResponse } from "next/server";
import { enrichTracks } from "@/lib/musicbrainz/service";
import type { TrackQuery } from "@/lib/musicbrainz/types";

export async function POST(request: Request) {
  let body: { tracks?: TrackQuery[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.tracks)) {
    return NextResponse.json({ error: "tracks must be an array" }, { status: 400 });
  }
  const years = await enrichTracks(body.tracks);
  return NextResponse.json({ years });
}
