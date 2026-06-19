import { SignJWT, jwtVerify } from "jose";

export const APP_SESSION_COOKIE = "app_session";

function secretKey(): Uint8Array {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ ok: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secretKey());
    return true;
  } catch {
    return false;
  }
}

export function isCorrectPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected || !input) return false;
  // Best-effort-Vergleich: leakt absichtlich die Länge (früher Return bei
  // Längen-Mismatch). Für das Single-User-/lokale Bedrohungsmodell akzeptiert.
  if (input.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < input.length; i++) {
    mismatch |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
