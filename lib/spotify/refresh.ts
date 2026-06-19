export type RefreshableToken = {
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  error?: string;
};

export async function refreshAccessToken(
  token: RefreshableToken,
  fetchImpl: typeof fetch = fetch,
): Promise<RefreshableToken> {
  if (!token.refresh_token) {
    return { ...token, error: "RefreshAccessTokenError" };
  }
  try {
    const basic = Buffer.from(
      `${process.env.AUTH_SPOTIFY_ID}:${process.env.AUTH_SPOTIFY_SECRET}`,
    ).toString("base64");

    const response = await fetchImpl(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basic}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: token.refresh_token,
        }),
      },
    );

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
    };

    if (!response.ok || !data.access_token) {
      return { ...token, error: "RefreshAccessTokenError" };
    }

    return {
      access_token: data.access_token,
      expires_at: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
      refresh_token: data.refresh_token ?? token.refresh_token,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}
