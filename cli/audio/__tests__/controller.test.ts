import { describe, it, expect, vi } from "vitest";
import { createController } from "../controller";

describe("createController", () => {
  it("play() PUTs the track uri to the device", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/me/player/play?device_id=dev1");
      expect(JSON.parse(init?.body as string)).toEqual({ uris: ["spotify:track:x"] });
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;

    await createController("tok", "dev1", fetchImpl).play("spotify:track:x");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("pause() PUTs to the pause endpoint for the device", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain("/me/player/pause?device_id=dev1");
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;

    await createController("tok", "dev1", fetchImpl).pause();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
