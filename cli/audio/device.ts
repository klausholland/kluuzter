import type { SpotifyDevice } from "@/lib/spotify/api";

export function findDevice(devices: SpotifyDevice[], name: string): string | null {
  const match = devices.find((d) => d.name === name && d.id !== null);
  return match?.id ?? null;
}

export async function waitForDevice(
  name: string,
  getDevicesImpl: () => Promise<SpotifyDevice[]>,
  opts: { attempts?: number; intervalMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<string> {
  const attempts = opts.attempts ?? 20;
  const intervalMs = opts.intervalMs ?? 500;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  for (let i = 0; i < attempts; i++) {
    const id = findDevice(await getDevicesImpl(), name);
    if (id) return id;
    await sleep(intervalMs);
  }
  throw new Error(`Spotify-Gerät "${name}" nicht gefunden (Timeout)`);
}
