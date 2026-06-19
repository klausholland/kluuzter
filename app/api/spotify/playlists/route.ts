import { NextResponse } from "next/server";
import { getSessionAccessToken } from "@/lib/spotify/session-token";
import { getMyPlaylists, searchPlaylists } from "@/lib/spotify/api";

export async function GET(request: Request) {
  const token = await getSessionAccessToken();
  if (!token) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const query = new URL(request.url).searchParams.get("q")?.trim();
  const playlists = query
    ? await searchPlaylists(token, query)
    : await getMyPlaylists(token);
  return NextResponse.json(playlists);
}
