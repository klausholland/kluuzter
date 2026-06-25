import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/spotify/api", () => ({
  getMyPlaylists: vi.fn(),
  getPlaylistTracks: vi.fn(),
}));
vi.mock("@/lib/musicbrainz/service", () => ({
  enrichTracks: vi.fn(),
}));

import { getMyPlaylists, getPlaylistTracks } from "@/lib/spotify/api";
import { enrichTracks } from "@/lib/musicbrainz/service";
import { listPlaylists, buildDeckForPlaylist } from "../build";

beforeEach(() => vi.clearAllMocks());

const track = (id: string, year: string) => ({
  id, uri: `spotify:track:${id}`, title: `T${id}`, artist: "A", releaseDate: year, coverUrl: null,
});

describe("listPlaylists", () => {
  it("delegates to getMyPlaylists with the token", async () => {
    (getMyPlaylists as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "p1", name: "P", imageUrl: null, trackCount: 1, owner: "o" }]);
    const out = await listPlaylists("tok");
    expect(getMyPlaylists).toHaveBeenCalledWith("tok");
    expect(out[0].id).toBe("p1");
  });
});

describe("buildDeckForPlaylist", () => {
  it("dedupes tracks, enriches years, and returns cards", async () => {
    (getPlaylistTracks as ReturnType<typeof vi.fn>).mockResolvedValue([track("t1", "1990"), track("t1", "1990"), track("t2", "2001")]);
    (enrichTracks as ReturnType<typeof vi.fn>).mockImplementation(async (queries: Array<{ spotifyTrackId: string; spotifyReleaseYear: number }>) =>
      queries.map((q) => ({ spotifyTrackId: q.spotifyTrackId, year: q.spotifyReleaseYear, source: "spotify" as const })));

    const deck = await buildDeckForPlaylist("tok", "pl");
    expect(getPlaylistTracks).toHaveBeenCalledWith("tok", "pl");
    expect(deck.map((c) => c.id).sort()).toEqual(["t1", "t2"]); // deduped
    expect(deck.find((c) => c.id === "t2")?.year).toBe(2001);
  });
});
