import { describe, it, expect } from "vitest";
import { tokenIsFresh } from "../token";

const t = { access_token: "AT", refresh_token: "RT", expires_at: 1000 };

describe("tokenIsFresh", () => {
  it("is fresh well before expiry (accounting for skew)", () => {
    expect(tokenIsFresh(t, 800)).toBe(true);
  });
  it("is stale within the skew window before expiry", () => {
    expect(tokenIsFresh(t, 950)).toBe(false); // default skew 60 -> 1000-60=940 < 950
  });
  it("is stale after expiry", () => {
    expect(tokenIsFresh(t, 1200)).toBe(false);
  });
});
