import { describe, it, expect, vi } from "vitest";
import { playTrack, pausePlayback, transferPlayback } from "../playback";

describe("playTrack", () => {
  it("PUTs /me/player/play with the device id and track uri", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://api.spotify.com/v1/me/player/play?device_id=dev1");
      expect(init?.method).toBe("PUT");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
      expect(JSON.parse(init?.body as string)).toEqual({ uris: ["spotify:track:t1"] });
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;

    await playTrack("tok", "dev1", "spotify:track:t1", fetchImpl);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("throws on a non-OK response", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 403 })) as unknown as typeof fetch;
    await expect(playTrack("tok", "dev1", "spotify:track:t1", fetchImpl)).rejects.toThrow();
  });
});

describe("pausePlayback", () => {
  it("PUTs /me/player/pause with the device id", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://api.spotify.com/v1/me/player/pause?device_id=dev1");
      expect(init?.method).toBe("PUT");
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    await pausePlayback("tok", "dev1", fetchImpl);
  });
});

describe("transferPlayback", () => {
  it("PUTs /me/player with the device id and play=false", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://api.spotify.com/v1/me/player");
      expect(JSON.parse(init?.body as string)).toEqual({ device_ids: ["dev1"], play: false });
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    await transferPlayback("tok", "dev1", fetchImpl);
  });
});
