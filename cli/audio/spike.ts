import { spawn } from "node:child_process";
import { getDevices } from "@/lib/spotify/api";
import { playTrack } from "@/lib/spotify/playback";

const TOKEN = process.env.KLUUZTER_SPIKE_TOKEN;
const URI = process.env.KLUUZTER_SPIKE_URI ?? "spotify:track:4cOdK2wGLETKBW3PvgPWqT"; // Never Gonna Give You Up
const BINARY = process.env.KLUUZTER_LIBRESPOT ?? "librespot";

if (!TOKEN) {
  console.error("Set KLUUZTER_SPIKE_TOKEN to a Spotify access token (streaming scope).");
  process.exit(1);
}

// NOTE: confirm these flags against `librespot --help` for the installed version
// in Step 6 and update NOTES.md. --access-token is the modern OAuth login path.
const child = spawn(BINARY, ["--name", "Kluuzter", "--access-token", TOKEN, "--bitrate", "320"], {
  stdio: ["ignore", "inherit", "inherit"],
});
child.on("exit", (code) => console.log("librespot exited:", code));

async function main(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const devices = await getDevices(TOKEN!);
    const dev = devices.find((d) => d.name === "Kluuzter" && d.id);
    if (dev?.id) {
      console.log("Found device:", dev.id, "— playing", URI);
      await playTrack(TOKEN!, dev.id, URI);
      console.log("If you hear audio, the spike passed. Ctrl-C to stop.");
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error("Kluuzter device never appeared.");
  child.kill("SIGTERM");
  process.exit(1);
}
main().catch((e) => { console.error(e); child.kill("SIGTERM"); process.exit(1); });
