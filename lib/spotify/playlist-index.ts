import type { PlaylistStatus } from "@/lib/musicbrainz/indexing";
import { chunk, INDEX_BATCH_SIZE } from "@/lib/musicbrainz/indexing";
import type { TrackQuery } from "@/lib/musicbrainz/types";

export async function fetchStatus(
  playlistId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PlaylistStatus> {
  const res = await fetchImpl(`/api/playlist-status?id=${playlistId}`);
  if (!res.ok) throw new Error(`playlist-status ${res.status}`);
  return (await res.json()) as PlaylistStatus;
}

async function postBatch(
  tracks: TrackQuery[],
  fetchImpl: typeof fetch,
): Promise<void> {
  let attempt = 0;
  // 1 Versuch + 1 Retry
  while (true) {
    attempt++;
    const res = await fetchImpl("/api/index", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tracks }),
    });
    if (res.ok) return;
    if (attempt >= 2) throw new Error(`index batch failed (${res.status})`);
  }
}

export async function indexPlaylist(
  playlistId: string,
  opts: {
    onProgress?: (done: number, total: number) => void;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<void> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const status = await fetchStatus(playlistId, fetchImpl);
  const total = status.missing.length;
  if (total === 0) {
    opts.onProgress?.(0, 0);
    return;
  }
  let done = 0;
  for (const batch of chunk(status.missing, INDEX_BATCH_SIZE)) {
    await postBatch(batch, fetchImpl);
    done += batch.length;
    opts.onProgress?.(done, total);
  }
}
