import type { SpotifyPlaylistSummary, SpotifyTrack } from "./types";

type RawCount = { total?: number };

type RawPlaylist = {
  id: string;
  name: string;
  images?: Array<{ url: string }>;
  // Spotify hat das frühere `tracks`-Feld auf `items` umgestellt; beide unterstützen.
  items?: RawCount;
  tracks?: RawCount;
  owner?: { display_name?: string };
};

type RawTrack = {
  id: string | null;
  uri: string;
  name: string;
  type?: string; // "track" | "episode"
  is_local?: boolean;
  artists?: Array<{ name: string }>;
  album?: { release_date?: string; images?: Array<{ url: string }> };
};

// Neuer Endpoint /playlists/{id}/items liefert das Track-Objekt unter `item`
// (früher `track`). Beide unterstützen.
type RawTrackItem = {
  is_local?: boolean;
  item?: RawTrack | null;
  track?: RawTrack | null;
};

export function mapPlaylistSummaries(items: unknown[]): SpotifyPlaylistSummary[] {
  return (items as (RawPlaylist | null)[])
    .filter((p): p is RawPlaylist => p != null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.images?.[0]?.url ?? null,
      trackCount: (p.items ?? p.tracks)?.total ?? 0,
      owner: p.owner?.display_name ?? "",
    }));
}

export function mapPlaylistTrackItems(items: unknown[]): SpotifyTrack[] {
  return (items as RawTrackItem[])
    .map((i) => ({ wrapper: i, t: i.item ?? i.track ?? null }))
    .filter((x): x is { wrapper: RawTrackItem; t: RawTrack } => x.t != null)
    .filter(({ wrapper, t }) => {
      const isLocal = wrapper.is_local ?? t.is_local ?? false;
      const isTrack = t.type === undefined || t.type === "track";
      return !isLocal && isTrack && typeof t.id === "string";
    })
    .map(({ t }) => ({
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
  // Spotify hat /playlists/{id}/tracks durch /playlists/{id}/items ersetzt
  // (der alte Endpoint liefert mittlerweile 403).
  let url: string | null = `${API}/playlists/${playlistId}/items?limit=100`;
  const out: SpotifyTrack[] = [];
  while (url) {
    const data: Record<string, unknown> = await getJson(url, token, fetchImpl);
    out.push(...mapPlaylistTrackItems((data.items as unknown[]) ?? []));
    url = (data.next as string | null) ?? null;
  }
  return out;
}
