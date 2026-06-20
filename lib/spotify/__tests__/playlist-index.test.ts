import { describe, it, expect, vi } from "vitest";
import { indexPlaylist, fetchStatus } from "../playlist-index";
import type { TrackQuery } from "@/lib/musicbrainz/types";

function q(id: string): TrackQuery {
  return { spotifyTrackId: id, title: id, artist: id, spotifyReleaseYear: 1990 };
}
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("fetchStatus", () => {
  it("requests the status route and returns the parsed status", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toBe("/api/playlist-status?id=pl1");
      return jsonResponse({ total: 3, indexed: 1, missing: [q("a")] });
    }) as unknown as typeof fetch;
    const status = await fetchStatus("pl1", fetchImpl);
    expect(status.indexed).toBe(1);
    expect(status.missing).toHaveLength(1);
  });
});

describe("indexPlaylist", () => {
  it("posts missing tracks in batches and reports progress", async () => {
    // 25 fehlende Tracks → bei Batch 20 zwei Requests (20 + 5)
    const missing = Array.from({ length: 25 }, (_, i) => q(String(i)));
    const bodies: number[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/playlist-status")) {
        return jsonResponse({ total: 25, indexed: 0, missing });
      }
      // /api/index
      const parsed = JSON.parse(init!.body as string) as { tracks: TrackQuery[] };
      bodies.push(parsed.tracks.length);
      return jsonResponse({ years: [] });
    }) as unknown as typeof fetch;

    const progress: Array<[number, number]> = [];
    await indexPlaylist("pl1", {
      fetchImpl,
      onProgress: (done, total) => progress.push([done, total]),
    });

    expect(bodies).toEqual([20, 5]); // zwei Batches
    expect(progress.at(-1)).toEqual([25, 25]); // am Ende vollständig
  });

  it("does nothing when there are no missing tracks", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.startsWith("/api/playlist-status")) {
        return jsonResponse({ total: 2, indexed: 2, missing: [] });
      }
      throw new Error("should not call /api/index");
    }) as unknown as typeof fetch;
    await indexPlaylist("pl1", { fetchImpl });
    // nur der Status-Request
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("force: re-indexes ALL tracks and sends force in the body", async () => {
    const all = Array.from({ length: 3 }, (_, i) => q(String(i)));
    const forceFlags: unknown[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/playlist-status")) {
        // bereits vollständig indiziert: missing leer, all gefüllt
        return jsonResponse({ total: 3, indexed: 3, missing: [], all });
      }
      const parsed = JSON.parse(init!.body as string) as { tracks: TrackQuery[]; force?: boolean };
      forceFlags.push(parsed.force);
      return jsonResponse({ years: [] });
    }) as unknown as typeof fetch;

    const progress: Array<[number, number]> = [];
    await indexPlaylist("pl1", {
      force: true,
      fetchImpl,
      onProgress: (done, total) => progress.push([done, total]),
    });

    // trotz missing=[] werden ALLE 3 Tracks neu indiziert
    expect(progress.at(-1)).toEqual([3, 3]);
    expect(forceFlags).toEqual([true]); // force im Request-Body
  });

  it("retries a failed batch once, then throws", async () => {
    const missing = [q("a")];
    let indexCalls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.startsWith("/api/playlist-status")) {
        return jsonResponse({ total: 1, indexed: 0, missing });
      }
      indexCalls++;
      return jsonResponse({ error: "boom" }, 500);
    }) as unknown as typeof fetch;

    await expect(indexPlaylist("pl1", { fetchImpl })).rejects.toThrow();
    expect(indexCalls).toBe(2); // 1 Versuch + 1 Retry
  });
});
