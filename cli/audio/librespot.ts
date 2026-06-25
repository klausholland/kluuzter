import { spawn as nodeSpawn, type ChildProcess } from "node:child_process";

export const DEVICE_NAME = "Kluuzter";

export type LibrespotHandle = { process: ChildProcess; stop: () => void };

/**
 * NOTE: The spawn args below mirror the PROPOSED flags recorded in
 * `cli/audio/NOTES.md` (`--name Kluuzter --access-token <token> --bitrate 320`).
 * Those flags are still PENDING human confirmation (Task 1, Step 6 — the audio
 * spike has not yet been run against a real librespot binary). If the spike
 * reveals different flag names (e.g. `--token` instead of `--access-token`) or
 * a required `--backend`, update this array to match and update NOTES.md.
 */
export function startLibrespot(
  accessToken: string,
  opts: { binary?: string; spawnImpl?: typeof nodeSpawn; onError?: (err: Error) => void } = {},
): LibrespotHandle {
  const binary = opts.binary ?? process.env.KLUUZTER_LIBRESPOT ?? "librespot";
  const spawnImpl = opts.spawnImpl ?? nodeSpawn;
  const args = ["--name", DEVICE_NAME, "--access-token", accessToken, "--bitrate", "320"];
  const child = spawnImpl(binary, args, { stdio: ["ignore", "pipe", "pipe"] }) as ChildProcess;
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
