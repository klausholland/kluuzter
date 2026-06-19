import { describe, it, expect, beforeEach, vi } from "vitest";
import { refreshAccessToken } from "../refresh";

beforeEach(() => {
  vi.stubEnv("AUTH_SPOTIFY_ID", "client-id");
  vi.stubEnv("AUTH_SPOTIFY_SECRET", "client-secret");
});

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("refreshAccessToken", () => {
  it("returns a new access token and expiry on success", async () => {
    const before = Math.floor(Date.now() / 1000);
    const result = await refreshAccessToken(
      { refresh_token: "r1" },
      fakeFetch(200, {
        access_token: "new-access",
        expires_in: 3600,
      }),
    );
    expect(result.access_token).toBe("new-access");
    expect(result.expires_at).toBeGreaterThanOrEqual(before + 3600);
    expect(result.error).toBeUndefined();
  });

  it("keeps the old refresh token when none is returned", async () => {
    const result = await refreshAccessToken(
      { refresh_token: "r1" },
      fakeFetch(200, { access_token: "a", expires_in: 3600 }),
    );
    expect(result.refresh_token).toBe("r1");
  });

  it("uses a rotated refresh token when returned", async () => {
    const result = await refreshAccessToken(
      { refresh_token: "r1" },
      fakeFetch(200, {
        access_token: "a",
        expires_in: 3600,
        refresh_token: "r2",
      }),
    );
    expect(result.refresh_token).toBe("r2");
  });

  it("sets error on HTTP failure", async () => {
    const result = await refreshAccessToken(
      { refresh_token: "r1" },
      fakeFetch(400, { error: "invalid_grant" }),
    );
    expect(result.error).toBe("RefreshAccessTokenError");
  });

  it("sets error when there is no refresh token", async () => {
    const result = await refreshAccessToken({}, fakeFetch(200, {}));
    expect(result.error).toBe("RefreshAccessTokenError");
  });
});
