import type { TrackQuery } from "./types";
import { bestRecordingYear, type MbRecording } from "./match";

type MbResponse = {
  recordings?: Array<{
    title?: string;
    "first-release-date"?: string;
    "artist-credit"?: Array<{ name?: string }>;
  }>;
};

function userAgent(): string {
  const contact = process.env.MUSICBRAINZ_CONTACT ?? "unknown";
  return `Hitster/0.1 ( ${contact} )`;
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
