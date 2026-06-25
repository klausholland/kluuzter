import { spawn as nodeSpawn, type ChildProcess } from "node:child_process";

export const DEVICE_NAME = "Kluuzter";

export type LibrespotHandle = { process: ChildProcess; stop: () => void };

/**
 * NOTE: Flags confirmed via the Task 1 audio spike on WSL2 (see
 * `cli/audio/NOTES.md`): `--name Kluuzter --access-token <token> --bitrate 320
 * --backend pulseaudio`. The `--backend pulseaudio` flag is REQUIRED for audio
 * under WSL2 — without it librespot falls back to a silent backend (the Connect
 * device still registers, but no sound plays). The backend is overridable via
 * `KLUUZTER_LIBRESPOT_BACKEND` for non-WSL/non-pulse environments.
 */
export function startLibrespot(
  accessToken: string,
  opts: { binary?: string; spawnImpl?: typeof nodeSpawn; onError?: (err: Error) => void } = {},
): LibrespotHandle {
  const binary = opts.binary ?? process.env.KLUUZTER_LIBRESPOT ?? "librespot";
  const backend = process.env.KLUUZTER_LIBRESPOT_BACKEND ?? "pulseaudio";
  const spawnImpl = opts.spawnImpl ?? nodeSpawn;
  const args = ["--name", DEVICE_NAME, "--access-token", accessToken, "--bitrate", "320", "--backend", backend];
  // stdout/stderr are discarded (not piped): an unread pipe can backpressure-stall
  // librespot mid-game once its log fills the buffer, and "inherit" would corrupt
  // the Ink TUI rendering.
  const child = spawnImpl(binary, args, { stdio: ["ignore", "ignore", "ignore"] }) as ChildProcess;
  // Without this listener, Node throws on an unhandled 'error' event (e.g. ENOENT
  // when the binary is missing), crashing the whole CLI outside any try/catch.
  // Attaching a listener — even a no-op — turns a missing binary into a graceful
  // path: the device never appears and the existing waitForDevice timeout produces
  // the friendly boot error instead of a raw stack trace.
  child.on("error", (err) => {
    opts.onError?.(err);
  });
  const stop = () => {
    try {
      child.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  };
  return { process: child, stop };
}
