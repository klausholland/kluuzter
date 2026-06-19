import { describe, it, expect } from "vitest";
import { fetchProfile, isPremium } from "../profile";

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("fetchProfile", () => {
  it("returns the parsed profile on success", async () => {
    const profile = await fetchProfile(
      "tok",
      fakeFetch(200, {
        id: "u1",
        display_name: "Anna",
        product: "premium",
      }),
    );
    expect(profile).toEqual({
      id: "u1",
      display_name: "Anna",
      product: "premium",
    });
  });

  it("returns null on HTTP error", async () => {
    const profile = await fetchProfile("tok", fakeFetch(401, {}));
    expect(profile).toBeNull();
  });
});

describe("isPremium", () => {
  it("is true for product 'premium'", () => {
    expect(
      isPremium({ id: "u", display_name: null, product: "premium" }),
    ).toBe(true);
  });
  it("is false for product 'free'", () => {
    expect(isPremium({ id: "u", display_name: null, product: "free" })).toBe(
      false,
    );
  });
  it("is false for null", () => {
    expect(isPremium(null)).toBe(false);
  });
});
