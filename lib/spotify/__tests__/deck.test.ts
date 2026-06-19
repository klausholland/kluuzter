import { describe, it, expect } from "vitest";
import {
  parseReleaseYear,
  buildTrackQueries,
  buildCard,
  shuffle,
  buildDeck,
} from "../deck";
import type { SpotifyTrack } from "../types";
import type { ResolvedYear } from "@/lib/musicbrainz/types";

function track(id: string, releaseDate: string): SpotifyTrack {
  return {
    id,
    uri: `spotify:track:${id}`,
    title: `Title ${id}`,
    artist: `Artist ${id}`,
    releaseDate,
    coverUrl: `http://cover/${id}`,
  };
}

describe("parseReleaseYear", () => {
  it("parses a full date", () => expect(parseReleaseYear("1979-05-12")).toBe(1979));
  it("parses a year-only value", () => expect(parseReleaseYear("1979")).toBe(1979));
  it("parses a year-month value", () => expect(parseReleaseYear("1979-05")).toBe(1979));
  it("returns null for empty input", () => expect(parseReleaseYear("")).toBeNull());
  it("returns null for garbage", () => expect(parseReleaseYear("abcd")).toBeNull());
});

describe("buildTrackQueries", () => {
  it("builds queries and skips tracks without a parsable year", () => {
    const qs = buildTrackQueries([track("a", "1979"), track("b", "")]);
    expect(qs).toEqual([
      { spotifyTrackId: "a", title: "Title a", artist: "Artist a", spotifyReleaseYear: 1979 },
    ]);
  });
});

describe("buildCard", () => {
  it("merges a track with its resolved year", () => {
    const card = buildCard(track("a", "2010"), {
      spotifyTrackId: "a",
      year: 1979,
      source: "musicbrainz",
    });
    expect(card).toEqual({
      id: "a",
      uri: "spotify:track:a",
      title: "Title a",
      artist: "Artist a",
      year: 1979,
      yearSource: "musicbrainz",
      coverUrl: "http://cover/a",
    });
  });
});

describe("shuffle", () => {
  it("keeps the same multiset of items", () => {
    const out = shuffle([1, 2, 3, 4, 5], () => 0.5);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it("does not mutate the input", () => {
    const input = [1, 2, 3];
    shuffle(input, () => 0);
    expect(input).toEqual([1, 2, 3]);
  });
});

describe("buildDeck", () => {
  it("builds cards from tracks via enrich, then shuffles deterministically", async () => {
    const tracks = [track("a", "2010"), track("b", "2011")];
    const enrich = async (qs: { spotifyTrackId: string }[]): Promise<ResolvedYear[]> =>
      qs.map((q) => ({ spotifyTrackId: q.spotifyTrackId, year: 1980, source: "spotify" as const }));
    // rng () => 0 ⇒ deterministische Reihenfolge
    const deck = await buildDeck(tracks, enrich, () => 0);
    expect(deck).toHaveLength(2);
    expect(deck.every((c) => c.year === 1980 && c.yearSource === "spotify")).toBe(true);
    expect([...deck].map((c) => c.id).sort()).toEqual(["a", "b"]);
  });

  it("drops tracks that have no resolved year", async () => {
    const tracks = [track("a", "2010"), track("b", "2011")];
    const enrich = async (): Promise<ResolvedYear[]> => [
      { spotifyTrackId: "a", year: 1990, source: "musicbrainz" },
    ];
    const deck = await buildDeck(tracks, enrich, () => 0);
    expect(deck.map((c) => c.id)).toEqual(["a"]);
  });
});
