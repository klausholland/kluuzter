import { describe, it, expect } from "vitest";
import { mapPlaylistSummaries, mapPlaylistTrackItems } from "../api";

describe("mapPlaylistSummaries", () => {
  it("maps the Spotify playlist shape", () => {
    const out = mapPlaylistSummaries([
      {
        id: "pl1",
        name: "Oldies",
        images: [{ url: "http://img/1" }],
        tracks: { total: 42 },
        owner: { display_name: "Anna" },
      },
    ]);
    expect(out).toEqual([
      { id: "pl1", name: "Oldies", imageUrl: "http://img/1", trackCount: 42, owner: "Anna" },
    ]);
  });

  it("tolerates missing images and owner name", () => {
    const out = mapPlaylistSummaries([
      { id: "pl2", name: "Empty", images: [], tracks: { total: 0 }, owner: {} },
    ]);
    expect(out[0].imageUrl).toBeNull();
    expect(out[0].owner).toBe("");
  });

  it("skips null entries (Spotify returns them in search)", () => {
    const out = mapPlaylistSummaries([null, { id: "p", name: "n", images: [], tracks: { total: 1 }, owner: {} }]);
    expect(out).toHaveLength(1);
  });
});

describe("mapPlaylistTrackItems", () => {
  const item = {
    track: {
      id: "t1",
      uri: "spotify:track:t1",
      name: "Sultans of Swing",
      is_local: false,
      artists: [{ name: "Dire Straits" }, { name: "Other" }],
      album: { release_date: "1978-10-20", images: [{ url: "http://cover/1" }] },
    },
  };

  it("maps a track item to SpotifyTrack with the primary artist", () => {
    expect(mapPlaylistTrackItems([item])).toEqual([
      {
        id: "t1",
        uri: "spotify:track:t1",
        title: "Sultans of Swing",
        artist: "Dire Straits",
        releaseDate: "1978-10-20",
        coverUrl: "http://cover/1",
      },
    ]);
  });

  it("skips items with a null track (removed songs)", () => {
    expect(mapPlaylistTrackItems([{ track: null }, item])).toHaveLength(1);
  });

  it("skips local tracks (not playable via SDK)", () => {
    const local = { track: { ...item.track, id: "t2", is_local: true } };
    expect(mapPlaylistTrackItems([local])).toHaveLength(0);
  });

  it("skips tracks without an id", () => {
    const noId = { track: { ...item.track, id: null } };
    expect(mapPlaylistTrackItems([noId])).toHaveLength(0);
  });
});
