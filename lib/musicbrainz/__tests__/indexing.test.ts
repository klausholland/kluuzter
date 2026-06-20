import { describe, it, expect } from "vitest";
import { chunk, computeStatus, buildDeckFromCache } from "../indexing";
import type { ResolvedYear } from "../types";
import type { SpotifyTrack } from "@/lib/spotify/types";

function track(id: string, releaseDate = "1990"): SpotifyTrack {
  return {
    id,
    uri: `spotify:track:${id}`,
    title: `Title ${id}`,
    artist: `Artist ${id}`,
    releaseDate,
    coverUrl: null,
  };
}
function cached(id: string, year = 1990): ResolvedYear {
  return { spotifyTrackId: id, year, source: "musicbrainz" };
}

describe("chunk", () => {
  it("splits into blocks of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("returns an empty array for an empty input", () => {
    expect(chunk([], 3)).toEqual([]);
  });
  it("keeps everything in one block when size exceeds length", () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });
});

describe("computeStatus", () => {
  it("counts indexed tracks and lists the missing ones as queries", () => {
    const tracks = [track("a"), track("b"), track("c")];
    const status = computeStatus(tracks, [cached("b")]);
    expect(status.total).toBe(3);
    expect(status.indexed).toBe(1);
    expect(status.missing.map((q) => q.spotifyTrackId)).toEqual(["a", "c"]);
    expect(status.missing[0]).toEqual({
      spotifyTrackId: "a",
      title: "Title a",
      artist: "Artist a",
      spotifyReleaseYear: 1990,
    });
  });

  it("ignores tracks without a parsable year (not indexable)", () => {
    const tracks = [track("a", "1990"), track("b", "")];
    const status = computeStatus(tracks, []);
    expect(status.total).toBe(1); // nur 'a' ist TrackQuery-fähig
    expect(status.missing.map((q) => q.spotifyTrackId)).toEqual(["a"]);
  });

  it("reports fully indexed when every query is cached", () => {
    const tracks = [track("a"), track("b")];
    const status = computeStatus(tracks, [cached("a"), cached("b")]);
    expect(status.total).toBe(2);
    expect(status.indexed).toBe(2);
    expect(status.missing).toEqual([]);
  });

  it("exposes ALL queries (for force re-index), even when fully indexed", () => {
    const tracks = [track("a"), track("b")];
    const status = computeStatus(tracks, [cached("a"), cached("b")]);
    expect(status.all.map((q) => q.spotifyTrackId)).toEqual(["a", "b"]);
  });
});

describe("buildDeckFromCache", () => {
  it("builds cards only from cached tracks and skips uncached ones", () => {
    const tracks = [track("a"), track("b"), track("c")];
    const deck = buildDeckFromCache(tracks, [cached("a", 1985), cached("c", 2001)], () => 0);
    expect(deck.map((card) => card.id).sort()).toEqual(["a", "c"]);
    const a = deck.find((card) => card.id === "a")!;
    expect(a.year).toBe(1985);
    expect(a.yearSource).toBe("musicbrainz");
  });

  it("returns an empty deck when nothing is cached", () => {
    expect(buildDeckFromCache([track("a")], [], () => 0)).toEqual([]);
  });
});
