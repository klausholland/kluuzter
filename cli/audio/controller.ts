import { playTrack, pausePlayback } from "@/lib/spotify/playback";

export type AudioController = {
  play: (uri: string) => Promise<void>;
  pause: () => Promise<void>;
};

export function createController(
  token: string,
  deviceId: string,
  fetchImpl: typeof fetch = fetch,
): AudioController {
  return {
    play: (uri: string) => playTrack(token, deviceId, uri, fetchImpl),
    pause: () => pausePlayback(token, deviceId, fetchImpl),
  };
}
