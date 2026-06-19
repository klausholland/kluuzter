import type { TrackQuery } from "./types";
import { bestRecordingYear, type MbRecording } from "./match";
import pkg from "@/package.json";

type MbResponse = {
  recordings?: Array<{
    title?: string;
    "first-release-date"?: string;
    "artist-credit"?: Array<{ name?: string }>;
  }>;
};

const APP_NAME = "Kluuzter";

/**
 * MusicBrainz verlangt einen aussagekräftigen User-Agent im Format
 * "Application name/<version> ( contact-url )", damit sie bei Problemen die
 * Maintainer erreichen können (siehe MusicBrainz-API-Doku). Die Version kommt
 * aus package.json, der Kontakt aus MUSICBRAINZ_CONTACT (E-Mail oder URL).
 */
function userAgent(): string {
  const contact = process.env.MUSICBRAINZ_CONTACT ?? "contact-not-configured";
  return `${APP_NAME}/${pkg.version} ( ${contact} )`;
}

export async function lookupYear(
  query: TrackQuery,
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<number | null> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const q = `recording:"${query.title}" AND artist:"${query.artist}"`;
  const url =
    "https://musicbrainz.org/ws/2/recording/?" +
    new URLSearchParams({ query: q, fmt: "json", limit: "25" }).toString();

  try {
    const res = await fetchImpl(url, {
      headers: { "User-Agent": userAgent(), Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as MbResponse;
    if (!data.recordings || data.recordings.length === 0) return null;

    const recordings: MbRecording[] = data.recordings.map((r) => ({
      title: r.title ?? "",
      firstReleaseDate: r["first-release-date"],
      artistCredit: (r["artist-credit"] ?? []).map((a) => a.name ?? ""),
    }));

    return bestRecordingYear(query, recordings);
  } catch {
    return null;
  }
}
