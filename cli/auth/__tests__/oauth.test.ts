import { describe, it, expect, vi } from "vitest";
import { exchangeCodeBody, refreshBody, requestTokens } from "../oauth";

describe("exchangeCodeBody", () => {
  it("builds an authorization_code body with the verifier and no secret", () => {
    const b = exchangeCodeBody({
      code: "c", verifier: "v", redirectUri: "http://127.0.0.1:8888/callback", clientId: "cid",
    });
    expect(b.get("grant_type")).toBe("authorization_code");
    expect(b.get("code")).toBe("c");
    expect(b.get("code_verifier")).toBe("v");
    expect(b.get("client_id")).toBe("cid");
    expect(b.get("client_secret")).toBeNull();
  });
});

describe("refreshBody", () => {
  it("builds a refresh_token body with the client_id and no secret", () => {
    const b = refreshBody({ refreshToken: "r", clientId: "cid" });
    expect(b.get("grant_type")).toBe("refresh_token");
    expect(b.get("refresh_token")).toBe("r");
    expect(b.get("client_id")).toBe("cid");
    expect(b.get("client_secret")).toBeNull();
  });
});

describe("requestTokens", () => {
  it("POSTs to the token endpoint and maps the response to StoredTokens", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://accounts.spotify.com/api/token");
      expect(init?.method).toBe("POST");
      return new Response(JSON.stringify({ access_token: "AT", refresh_token: "RT", expires_in: 3600 }));
    }) as unknown as typeof fetch;

    const out = await requestTokens(new URLSearchParams({ grant_type: "refresh_token" }), null, fetchImpl, () => 1000);
    expect(out).toEqual({ access_token: "AT", refresh_token: "RT", expires_at: 4600 });
  });

  it("falls back to the provided refresh token when the response omits one", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: "AT2", expires_in: 3600 }))) as unknown as typeof fetch;
    const out = await requestTokens(new URLSearchParams(), "OLD_RT", fetchImpl, () => 0);
    expect(out.refresh_token).toBe("OLD_RT");
  });

  it("throws on a non-OK response", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 400 })) as unknown as typeof fetch;
    await expect(requestTokens(new URLSearchParams(), null, fetchImpl)).rejects.toThrow();
  });
});
