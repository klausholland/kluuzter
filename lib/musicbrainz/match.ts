import type { TrackQuery } from "./types";

export type MbRecording = {
  title: string;
  firstReleaseDate?: string;
  artistCredit: string[];
};

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Akzente entfernen
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // Klammerzusätze (Remastered, feat., …)
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s-\s.*$/g, "") // " - Live", " - Remastered"
    .replace(/[^a-z0-9\s]/g, "") // Satzzeichen
    .replace(/\s+/g, " ")
    .trim();
}

function parseYear(date?: string): number | null {
  if (!date) return null;
  const match = date.match(/^(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  return year > 0 ? year : null;
}

export function bestRecordingYear(
  query: TrackQuery,
  recordings: MbRecording[],
): number | null {
  const wantTitle = normalize(query.title);
  const wantArtist = normalize(query.artist);

  const years = recordings
    .filter((r) => normalize(r.title) === wantTitle)
    .filter((r) =>
      r.artistCredit.some((a) => normalize(a) === wantArtist),
    )
    .map((r) => parseYear(r.firstReleaseDate))
    .filter((y): y is number => y !== null);

  if (years.length === 0) return null;
  return Math.min(...years);
}
