import { getMyPlaylists, getPlaylistTracks } from "@/lib/spotify/api";
import { dedupeTracks, buildDeck } from "@/lib/spotify/deck";
import { enrichTracks } from "@/lib/musicbrainz/service";
import type { Card } from "@/lib/engine/types";
import type { SpotifyPlaylistSummary } from "@/lib/spotify/types";

export function listPlaylists(token: string): Promise<SpotifyPlaylistSummary[]> {
  return getMyPlaylists(token);
}

export async function buildDeckForPlaylist(token: string, playlistId: string): Promise<Card[]> {
  const tracks = await getPlaylistTracks(token, playlistId);
  const unique = dedupeTracks(tracks);
  return buildDeck(unique, (queries) => enrichTracks(queries));
}
