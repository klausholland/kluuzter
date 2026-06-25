import React, { useEffect, useState } from "react";
import { render, Text, Box } from "ink";
import { getValidAccessToken } from "@/cli/auth/token";
import { startLibrespot, DEVICE_NAME, type LibrespotHandle } from "@/cli/audio/librespot";
import { waitForDevice } from "@/cli/audio/device";
import { getDevices } from "@/lib/spotify/api";
import { createController, type AudioController } from "@/cli/audio/controller";
import Setup from "@/cli/ui/Setup";
import App from "@/cli/ui/App";
import type { GameInput } from "@/lib/engine/types";

type Boot =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; token: string; controller: AudioController };

function Root(): React.ReactElement {
  const [boot, setBoot] = useState<Boot>({ kind: "loading", message: "Anmeldung bei Spotify…" });
  const [input, setInput] = useState<GameInput | null>(null);

  useEffect(() => {
    let handle: LibrespotHandle | null = null;
    (async () => {
      try {
        const token = await getValidAccessToken();
        setBoot({ kind: "loading", message: "Starte librespot…" });
        handle = startLibrespot(token);
        const deviceId = await waitForDevice(DEVICE_NAME, () => getDevices(token));
        setBoot({ kind: "ready", token, controller: createController(token, deviceId) });
      } catch (e) {
        setBoot({ kind: "error", message: String(e) });
      }
    })();
    const cleanup = () => { handle?.stop(); };
    process.on("SIGINT", () => { cleanup(); process.exit(0); });
    process.on("exit", cleanup);
    return cleanup;
  }, []);

  if (boot.kind === "error") return <Text color="red">Fehler: {boot.message}</Text>;
  if (boot.kind === "loading") return <Box padding={1}><Text>{boot.message}</Text></Box>;
  if (!input) return <Setup token={boot.token} onReady={setInput} />;
  return <App input={input} controller={boot.controller} />;
}

const instance = render(<Root />);
// When Ink unmounts (game over auto-exit, or Ctrl-C), Root's effect cleanup has
// already stopped librespot; force the process to terminate so a lingering child
// handle can't keep it alive.
void instance.waitUntilExit().then(() => process.exit(0));
