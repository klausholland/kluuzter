import { NextResponse } from "next/server";
import { getSessionAccessToken } from "@/lib/spotify/session-token";

export async function GET() {
  const token = await getSessionAccessToken();
  if (!token) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ accessToken: token });
}
