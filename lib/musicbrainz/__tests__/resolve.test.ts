import { describe, it, expect, vi } from "vitest";
import { resolveYears } from "../resolve";
import type { TrackQuery, ResolvedYear } from "../types";

const q = (id: string, year = 2010): TrackQuery => ({
  spotifyTrackId: id,
  title: `t${id}`,
  artist: `a${id}`,
  spotifyReleaseYear: year,
});

describe("resolveYears", () => {
  it("returns cached entries without calling lookup", async () => {
    const lookup = vi.fn();
    const putCached = vi.fn().mockResolvedValue(undefined);
    const result = await resolveYears([q("1")], {
      getCached: async () => [{ spotifyTrackId: "1", year: 1985, source: "musicbrainz" }],
      putCached,
      lookup,
      limit: (fn) => fn(),
    });
    expect(result).toEqual([{ spotifyTrackId: "1", year: 1985, source: "musicbrainz" }]);
    expect(lookup).not.toHaveBeenCalled();
    expect(putCached).not.toHaveBeenCalled();
  });

  it("looks up misses via MusicBrainz and caches them", async () => {
    const putCached = vi.fn().mockResolvedValue(undefined);
    const result = await resolveYears([q("2")], {
      getCached: async () => [],
      putCached,
      lookup: async () => 1979,
      limit: (fn) => fn(),
    });
    expect(result).toEqual([{ spotifyTrackId: "2", year: 1979, source: "musicbrainz" }]);
    expect(putCached).toHaveBeenCalledWith([
      { spotifyTrackId: "2", year: 1979, source: "musicbrainz", title: "t2", artist: "a2" },
    ]);
  });

  it("falls back to the Spotify year when MusicBrainz has no match", async () => {
    const result = await resolveYears([q("3", 2004)], {
      getCached: async () => [],
      putCached: async () => {},
      lookup: async () => null,
      limit: (fn) => fn(),
    });
    expect(result).toEqual([{ spotifyTrackId: "3", year: 2004, source: "spotify" }]);
  });

  it("preserves input order across cached and looked-up entries", async () => {
    const result = await resolveYears([q("a"), q("b"), q("c")], {
      getCached: async () => [{ spotifyTrackId: "b", year: 1990, source: "musicbrainz" }],
      putCached: async () => {},
      lookup: async (query) => (query.spotifyTrackId === "a" ? 1970 : null),
      limit: (fn) => fn(),
    });
    expect(result.map((r) => r.spotifyTrackId)).toEqual(["a", "b", "c"]);
    expect(result[1]).toEqual({ spotifyTrackId: "b", year: 1990, source: "musicbrainz" });
  });

  it("does not fail the batch if caching throws", async () => {
    const result = await resolveYears([q("4", 2001)], {
      getCached: async () => [],
      putCached: async () => {
        throw new Error("db down");
      },
      lookup: async () => 1995,
      limit: (fn) => fn(),
    });
    expect(result).toEqual([{ spotifyTrackId: "4", year: 1995, source: "musicbrainz" }]);
  });
});
