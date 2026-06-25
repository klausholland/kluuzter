import { readTokens, writeTokens, type StoredTokens } from "./store";
import { refreshBody, requestTokens } from "./oauth";
import { runAuthFlow } from "./flow";

const SKEW = 60; // seconds of head-room before treating a token as expired

export function tokenIsFresh(t: StoredTokens, now: number, skew: number = SKEW): boolean {
  return t.expires_at - skew > now;
}

export async function getValidAccessToken(): Promise<string> {
  const clientId = process.env.AUTH_SPOTIFY_ID;
  if (!clientId) throw new Error("AUTH_SPOTIFY_ID is not set");

  let tokens = await readTokens();
  if (!tokens) {
    tokens = await runAuthFlow();
    await writeTokens(tokens);
    return tokens.access_token;
  }

  if (tokenIsFresh(tokens, Math.floor(Date.now() / 1000))) {
    return tokens.access_token;
  }

  try {
    const refreshed = await requestTokens(
      refreshBody({ refreshToken: tokens.refresh_token, clientId }),
      tokens.refresh_token,
    );
    await writeTokens(refreshed);
    return refreshed.access_token;
  } catch {
    const fresh = await runAuthFlow();
    await writeTokens(fresh);
    return fresh.access_token;
  }
}
