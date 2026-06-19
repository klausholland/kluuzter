import { describe, it, expect, beforeEach, vi } from "vitest";
import { lookupYear } from "../client";

beforeEach(() => vi.stubEnv("MUSICBRAINZ_CONTACT", "test@example.com"));

const query = {
  spotifyTrackId: "x",
  title: "Sultans of Swing",
  artist: "Dire Straits",
  spotifyReleaseYear: 2010,
};

function fakeFetch(status: number, body: unknown, capture?: (url: string, init?: RequestInit) => void): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    capture?.(url, init);
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

describe("lookupYear", () => {
  it("returns the earliest matching year from the MB response", async () => {
    const body = {
      recordings: [
        {
          title: "Sultans of Swing",
          "first-release-date": "1979-05-04",
          "artist-credit": [{ name: "Dire Straits" }],
        },
      ],
    };
    const year = await lookupYear(query, { fetchImpl: fakeFetch(200, body) });
    expect(year).toBe(1979);
  });

  it("sends a User-Agent header with the contact", async () => {
    let seen: RequestInit | undefined;
    await lookupYear(query, {
      fetchImpl: fakeFetch(200, { recordings: [] }, (_u, init) => (seen = init)),
    });
    const ua = new Headers(seen?.headers).get("User-Agent");
    expect(ua).toContain("test@example.com");
  });

  it("returns null on HTTP error", async () => {
    const year = await lookupYear(query, { fetchImpl: fakeFetch(503, {}) });
    expect(year).toBeNull();
  });

  it("returns null when the response has no recordings", async () => {
    const year = await lookupYear(query, { fetchImpl: fakeFetch(200, {}) });
    expect(year).toBeNull();
  });
});
