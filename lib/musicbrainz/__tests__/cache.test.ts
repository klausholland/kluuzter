import { describe, it, expect } from "vitest";
import { rowsToResolved } from "../cache";

describe("rowsToResolved", () => {
  it("maps DB rows to ResolvedYear", () => {
    const out = rowsToResolved([
      {
        spotifyTrackId: "1",
        title: "t",
        artist: "a",
        resolvedYear: 1979,
        source: "musicbrainz",
        fetchedAt: new Date(),
      },
    ]);
    expect(out).toEqual([{ spotifyTrackId: "1", year: 1979, source: "musicbrainz" }]);
  });
});
