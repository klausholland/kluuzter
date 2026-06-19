import { describe, it, expect, vi } from "vitest";
import { getMyPlaylists, searchPlaylists, getPlaylistTracks } from "../api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("getMyPlaylists", () => {
  it("requests /me/playlists with the bearer token and maps the result", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("https://api.spotify.com/v1/me/playlists");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
      return jsonResponse({
        items: [{ id: "p1", name: "P", images: [], tracks: { total: 3 }, owner: { display_name: "A" } }],
      });
    }) as unknown as typeof fetch;

    const out = await getMyPlaylists("tok", fetchImpl);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("p1");
  });
});

describe("searchPlaylists", () => {
  it("queries /search with type=playlist and the encoded query", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain("https://api.spotify.com/v1/search");
      expect(url).toContain("type=playlist");
      expect(url).toContain(encodeURIComponent("80s hits"));
      return jsonResponse({
        playlists: { items: [{ id: "s1", name: "80s", images: [], tracks: { total: 9 }, owner: { display_name: "X" } }] },
      });
    }) as unknown as typeof fetch;

    const out = await searchPlaylists("tok", "80s hits", fetchImpl);
    expect(out[0].id).toBe("s1");
  });
});

describe("getPlaylistTracks", () => {
  it("queries the /items endpoint and follows pagination via `next`", async () => {
    const page1 = {
      items: [
        { is_local: false, item: { id: "t1", uri: "spotify:track:t1", name: "One", type: "track", artists: [{ name: "A" }], album: { release_date: "1990", images: [] } } },
      ],
      next: "https://api.spotify.com/v1/playlists/pl/items?offset=100",
    };
    const page2 = {
      items: [
        { is_local: false, item: { id: "t2", uri: "spotify:track:t2", name: "Two", type: "track", artists: [{ name: "B" }], album: { release_date: "1991", images: [] } } },
      ],
      next: null,
    };
    const urls: string[] = [];
    const fetchImpl = vi
      .fn((url: string) => {
        urls.push(url);
        return Promise.resolve(urls.length === 1 ? jsonResponse(page1) : jsonResponse(page2));
      }) as unknown as typeof fetch;

    const out = await getPlaylistTracks("tok", "pl", fetchImpl);
    expect(out.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(urls[0]).toContain("/playlists/pl/items");
    expect(urls[0]).not.toContain("/tracks");
  });

  it("throws on a non-OK response", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "nope" }, 401)) as unknown as typeof fetch;
    await expect(getPlaylistTracks("tok", "pl", fetchImpl)).rejects.toThrow();
  });
});
