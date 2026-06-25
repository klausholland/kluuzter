import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { generateCodeVerifier, codeChallenge, buildAuthUrl } from "./pkce";
import { exchangeCodeBody, requestTokens } from "./oauth";
import type { StoredTokens } from "./store";

const REDIRECT_URI = "http://127.0.0.1:8888/callback";
const PORT = 8888;
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-modify-playback-state",
  "user-read-playback-state",
];

function openBrowser(url: string): void {
  // Best-effort; the URL is also printed so the user can open it manually.
  const cmd = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "cmd"
    : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try { spawn(cmd, args, { stdio: "ignore", detached: true }).unref(); } catch { /* ignore */ }
}

export function runAuthFlow(): Promise<StoredTokens> {
  const clientId = process.env.AUTH_SPOTIFY_ID;
  if (!clientId) throw new Error("AUTH_SPOTIFY_ID is not set");

  const verifier = generateCodeVerifier();
  const challenge = codeChallenge(verifier);
  const state = randomUUID();

  return new Promise<StoredTokens>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", REDIRECT_URI);
      if (url.pathname !== "/callback") { res.writeHead(404).end(); return; }
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body>Kluuzter: Login abgeschlossen. Du kannst dieses Fenster schließen.</body></html>");
      server.close();
      if (error || !code) { reject(new Error(`OAuth error: ${error ?? "no code"}`)); return; }
      if (returnedState !== state) { reject(new Error("OAuth state mismatch")); return; }
      try {
        const tokens = await requestTokens(
          exchangeCodeBody({ code, verifier, redirectUri: REDIRECT_URI, clientId }),
          null,
        );
        resolve(tokens);
      } catch (e) { reject(e as Error); }
    });
    server.on("error", reject);
    server.listen(PORT, "127.0.0.1", () => {
      const authUrl = buildAuthUrl({ clientId, redirectUri: REDIRECT_URI, scopes: SCOPES, challenge, state });
      console.log("\nÖffne zum Login:\n" + authUrl + "\n");
      openBrowser(authUrl);
    });
  });
}
