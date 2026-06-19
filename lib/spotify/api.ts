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

const API = "https://api.spotify.com/v1";

async function getJson(
  url: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<Record<string, unknown>> {
  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Spotify API ${res.status} for ${url}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

export async function getMyPlaylists(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SpotifyPlaylistSummary[]> {
  const data = await getJson(`${API}/me/playlists?limit=50`, token, fetchImpl);
  return mapPlaylistSummaries((data.items as unknown[]) ?? []);
}

export async function searchPlaylists(
  token: string,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SpotifyPlaylistSummary[]> {
  const url = `${API}/search?type=playlist&limit=20&q=${encodeURIComponent(query)}`;
  const data = await getJson(url, token, fetchImpl);
  const playlists = (data.playlists as { items?: unknown[] }) ?? {};
  return mapPlaylistSummaries(playlists.items ?? []);
}

export async function getPlaylistTracks(
  token: string,
  playlistId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SpotifyTrack[]> {
  const fields =
    "fields=items(track(id,uri,name,is_local,artists(name),album(release_date,images))),next";
  let url: string | null = `${API}/playlists/${playlistId}/tracks?limit=100&${fields}`;
  const out: SpotifyTrack[] = [];
  while (url) {
    const data: Record<string, unknown> = await getJson(url, token, fetchImpl);
    out.push(...mapPlaylistTrackItems((data.items as unknown[]) ?? []));
    url = (data.next as string | null) ?? null;
  }
  return out;
}
