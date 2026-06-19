export type SpotifyPlaylistSummary = {
  id: string;
  name: string;
  imageUrl: string | null;
  trackCount: number;
  owner: string;
};

export type SpotifyTrack = {
  id: string;
  uri: string;
  title: string;
  artist: string; // primärer Interpret
  releaseDate: string; // album.release_date (z. B. "1979", "1979-05", "1979-05-12")
  coverUrl: string | null;
};
