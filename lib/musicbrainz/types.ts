export type TrackQuery = {
  spotifyTrackId: string;
  title: string;
  artist: string;
  spotifyReleaseYear: number; // aus album.release_date abgeleitet (Fallback)
};

export type ResolvedYear = {
  spotifyTrackId: string;
  year: number;
  source: "musicbrainz" | "spotify";
};
