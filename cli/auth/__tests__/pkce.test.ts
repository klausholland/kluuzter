import { describe, it, expect } from "vitest";
import { generateCodeVerifier, codeChallenge, buildAuthUrl } from "../pkce";

describe("generateCodeVerifier", () => {
  it("produces a url-safe string with no padding", () => {
    const v = generateCodeVerifier(() => Buffer.from("a".repeat(32)));
    expect(v).not.toMatch(/[+/=]/);
    expect(v.length).toBeGreaterThanOrEqual(43);
  });
});

describe("codeChallenge", () => {
  it("is the url-safe base64 of the SHA-256 of the verifier", () => {
    // Known S256 of verifier "test" -> base64url
    expect(codeChallenge("test")).toBe("n4bQgYhMfWWaL-qgxVrQFaO_TxsrC4Is0V1sFbDwCgg");
  });
});

describe("buildAuthUrl", () => {
  it("includes the required PKCE query params", () => {
    const url = buildAuthUrl({
      clientId: "cid", redirectUri: "http://127.0.0.1:8888/callback",
      scopes: ["streaming", "user-read-email"], challenge: "chal", state: "st",
    });
    expect(url).toContain("https://accounts.spotify.com/authorize?");
    expect(url).toContain("client_id=cid");
    expect(url).toContain("code_challenge_method=S256");
    expect(url).toContain("code_challenge=chal");
    expect(url).toContain("scope=streaming+user-read-email");
    expect(url).toContain("state=st");
    expect(url).toContain(encodeURIComponent("http://127.0.0.1:8888/callback"));
  });
});
