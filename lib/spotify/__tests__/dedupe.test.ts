import { describe, it, expect } from "vitest";
import { dedupeTracks } from "../deck";
import type { SpotifyTrack } from "../types";

function track(id: string): SpotifyTrack {
  return { id, uri: `spotify:track:${id}`, title: id, artist: id, releaseDate: "1990", coverUrl: null };
}

describe("dedupeTracks", () => {
  it("removes duplicate track ids, keeping first occurrence", () => {
    const out = dedupeTracks([track("a"), track("b"), track("a")]);
    expect(out.map((t) => t.id)).toEqual(["a", "b"]);
  });
});
