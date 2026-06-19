import { describe, it, expect } from "vitest";
import { mapPlaylistSummaries, mapPlaylistTrackItems } from "../api";

describe("mapPlaylistSummaries", () => {
  it("maps the Spotify playlist shape (items.total — neues Feld)", () => {
    const out = mapPlaylistSummaries([
      {
        id: "pl1",
        name: "Oldies",
        images: [{ url: "http://img/1" }],
        items: { total: 42 },
        owner: { display_name: "Anna" },
      },
    ]);
    expect(out).toEqual([
      { id: "pl1", name: "Oldies", imageUrl: "http://img/1", trackCount: 42, owner: "Anna" },
    ]);
  });

  it("falls back to the legacy tracks.total field", () => {
    const out = mapPlaylistSummaries([
      { id: "pl1", name: "Legacy", images: [], tracks: { total: 7 }, owner: {} },
    ]);
    expect(out[0].trackCount).toBe(7);
  });

  it("tolerates missing images and owner name", () => {
    const out = mapPlaylistSummaries([
      { id: "pl2", name: "Empty", images: [], items: { total: 0 }, owner: {} },
    ]);
    expect(out[0].imageUrl).toBeNull();
    expect(out[0].owner).toBe("");
  });

  it("skips null entries (Spotify returns them in search)", () => {
    const out = mapPlaylistSummaries([null, { id: "p", name: "n", images: [], items: { total: 1 }, owner: {} }]);
    expect(out).toHaveLength(1);
  });
});

describe("mapPlaylistTrackItems", () => {
  // Neues /items-Format: Track-Objekt unter `item`, is_local auf dem Wrapper.
  const item = {
    is_local: false,
    item: {
      id: "t1",
      uri: "spotify:track:t1",
      name: "Sultans of Swing",
      type: "track",
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

  it("still supports the legacy `track` wrapper", () => {
    const legacy = {
      track: {
        id: "tL",
        uri: "spotify:track:tL",
        name: "Legacy",
        is_local: false,
        artists: [{ name: "X" }],
        album: { release_date: "1990", images: [] },
      },
    };
    expect(mapPlaylistTrackItems([legacy])[0].id).toBe("tL");
  });

  it("skips items with a null item (removed songs)", () => {
    expect(mapPlaylistTrackItems([{ item: null }, item])).toHaveLength(1);
  });

  it("skips local tracks (not playable via SDK)", () => {
    const local = { is_local: true, item: { ...item.item, id: "t2" } };
    expect(mapPlaylistTrackItems([local])).toHaveLength(0);
  });

  it("skips episodes (only tracks belong in the deck)", () => {
    const episode = { is_local: false, item: { ...item.item, id: "e1", type: "episode" } };
    expect(mapPlaylistTrackItems([episode])).toHaveLength(0);
  });

  it("skips tracks without an id", () => {
    const noId = { is_local: false, item: { ...item.item, id: null } };
    expect(mapPlaylistTrackItems([noId])).toHaveLength(0);
  });
});
