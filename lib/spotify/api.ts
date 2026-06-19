import type { SpotifyPlaylistSummary, SpotifyTrack } from "./types";

type RawPlaylist = {
  id: string;
  name: string;
  images?: Array<{ url: string }>;
  tracks?: { total?: number };
  owner?: { display_name?: string };
};

type RawTrackItem = {
  track: {
    id: string | null;
    uri: string;
    name: string;
    is_local?: boolean;
    artists?: Array<{ name: string }>;
    album?: { release_date?: string; images?: Array<{ url: string }> };
  } | null;
};

export function mapPlaylistSummaries(items: unknown[]): SpotifyPlaylistSummary[] {
  return (items as (RawPlaylist | null)[])
    .filter((p): p is RawPlaylist => p != null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.images?.[0]?.url ?? null,
      trackCount: p.tracks?.total ?? 0,
      owner: p.owner?.display_name ?? "",
    }));
}

export function mapPlaylistTrackItems(items: unknown[]): SpotifyTrack[] {
  return (items as RawTrackItem[])
    .map((i) => i.track)
    .filter((t): t is NonNullable<RawTrackItem["track"]> => t != null)
    .filter((t) => !t.is_local && typeof t.id === "string")
    .map((t) => ({
      id: t.id as string,
      uri: t.uri,
      title: t.name,
      artist: t.artists?.[0]?.name ?? "",
      releaseDate: t.album?.release_date ?? "",
      coverUrl: t.album?.images?.[0]?.url ?? null,
    }));
}
