import { auth } from "@/auth";

/**
 * Liefert das aktuelle Spotify-Access-Token aus der Auth.js-Session
 * (Auth.js refresht automatisch). `null`, wenn nicht angemeldet oder Refresh-Fehler.
 */
export async function getSessionAccessToken(): Promise<string | null> {
  const session = await auth();
  if (!session || session.error || !session.accessToken) return null;
  return session.accessToken;
}
