import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  APP_SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/app-auth/session";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(APP_SESSION_COOKIE)?.value;
  const ok = await verifySessionToken(token);
  if (!ok) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Alles schützen außer: /login, Auth.js-Routen, Next-Interna, statische Assets
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
