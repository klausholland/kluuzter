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
const child = spawn(BINARY, ["--name", "Kluuzter", "--access-token", TOKEN, "--bitrate", "320", "--backend", "pulseaudio"], {
  stdio: ["ignore", "inherit", "inherit"],
});
child.on("exit", (code) => console.log("librespot exited:", code));

async function main(): Promise<void> {
  console.log("Warte kurz, bis librespot sich registriert...");
  await new Promise((r) => setTimeout(r, 2000)); // 2 Sekunden Puffer einbauen

 for (let i = 0; i < 20; i++) {
  try {
    const devices = await getDevices(TOKEN!);
    const dev = devices.find((d) => d.name === "Kluuzter" && d.id);
    
    if (dev?.id) {
      await new Promise((r) => setTimeout(r, 1000)); 
      
      await playTrack(TOKEN!, dev.id, URI);
      
      return;
    } else {
    }
  } catch (err: any) {
    console.error(`Fehler im Loop (Versuch ${i + 1}/20):`, err?.message || err);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
  console.error("Kluuzter device never appeared.");
  child.kill("SIGTERM");
  process.exit(1);
}

main().catch((e) => { console.error(e); child.kill("SIGTERM"); process.exit(1); });
