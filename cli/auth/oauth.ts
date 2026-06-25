// TODO(task-4): `StoredTokens` is canonically defined in `store.ts`. It is
// defined here temporarily to avoid importing a module that doesn't exist
// yet. Once Task 4 creates `store.ts`, remove this and switch to:
//   import type { StoredTokens } from "./store";
export type StoredTokens = { access_token: string; refresh_token: string; expires_at: number };

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

export function exchangeCodeBody(opts: {
  code: string;
  verifier: string;
  redirectUri: string;
  clientId: string;
}): URLSearchParams {
  return new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: opts.clientId,
    code_verifier: opts.verifier,
  });
}

export function refreshBody(opts: { refreshToken: string; clientId: string }): URLSearchParams {
  return new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: opts.refreshToken,
    client_id: opts.clientId,
  });
}

export async function requestTokens(
  body: URLSearchParams,
  fallbackRefreshToken: string | null,
  fetchImpl: typeof fetch = fetch,
  now: () => number = () => Math.floor(Date.now() / 1000),
): Promise<StoredTokens> {
  const res = await fetchImpl(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Spotify token endpoint ${res.status}`);
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? fallbackRefreshToken ?? "",
    expires_at: now() + data.expires_in,
  };
}
