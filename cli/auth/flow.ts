import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import os from "node:os";
import { generateCodeVerifier, codeChallenge, buildAuthUrl } from "./pkce";
import { exchangeCodeBody, requestTokens } from "./oauth";
import type { StoredTokens } from "./store";

const REDIRECT_URI = "http://127.0.0.1:8888/callback";
const PORT = 8888;
const ABANDON_TIMEOUT_MS = 300_000;
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-modify-playback-state",
  "user-read-playback-state",
];

/** Returns an ordered list of [command, args] opener candidates for the current platform. */
function openerCandidates(url: string): [string, string[]][] {
  if (process.platform === "darwin") {
    return [["open", [url]]];
  }
  if (process.platform === "win32") {
    return [["cmd", ["/c", "start", "", url]]];
  }
  // Linux — detect WSL2 (env variable or kernel release string)
  const isWSL =
    Boolean(process.env.WSL_DISTRO_NAME) || /microsoft/i.test(os.release());
  if (isWSL) {
    // Escape single quotes in URL for PowerShell single-quoted string
    const safePsUrl = url.replace(/'/g, "''");
    return [
      ["wslview", [url]],
      ["powershell.exe", ["-NoProfile", "-Command", `Start-Process '${safePsUrl}'`]],
      ["xdg-open", [url]],
    ];
  }
  return [["xdg-open", [url]]];
}

/** Try each opener in sequence; if one is missing (ENOENT) advance to the next.
 *  Never throws — the printed URL is the manual fallback and the auth server must stay alive. */
function tryNext(
  candidates: [string, string[]][],
  idx: number,
  spawnImpl: typeof spawn,
): void {
  if (idx >= candidates.length) return;
  const [cmd, args] = candidates[idx];
  const child = spawnImpl(cmd, args, { stdio: "ignore", detached: true });
  child.on("error", () => tryNext(candidates, idx + 1, spawnImpl));
  child.unref();
}

/** Best-effort browser opener.  Production callers use the default spawnImpl.
 *  Tests inject a fake spawn to exercise the fallback chain without real binaries. */
export function openBrowser(url: string, spawnImpl: typeof spawn = spawn): void {
  tryNext(openerCandidates(url), 0, spawnImpl);
}

export function runAuthFlow(): Promise<StoredTokens> {
  const clientId = process.env.AUTH_SPOTIFY_ID;
  if (!clientId) throw new Error("AUTH_SPOTIFY_ID is not set");

  const verifier = generateCodeVerifier();
  const challenge = codeChallenge(verifier);
  const state = randomUUID();

  return new Promise<StoredTokens>((resolve, reject) => {
    let timer: NodeJS.Timeout;
    const settleResolve = (tokens: StoredTokens) => { clearTimeout(timer); resolve(tokens); };
    const settleReject = (e: Error) => { clearTimeout(timer); reject(e); };

    const server = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", REDIRECT_URI);
      if (url.pathname !== "/callback") { res.writeHead(404).end(); return; }
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body>Kluuzter: Login abgeschlossen. Du kannst dieses Fenster schließen.</body></html>");
      server.close();
      if (error || !code) { settleReject(new Error(`OAuth error: ${error ?? "no code"}`)); return; }
      if (returnedState !== state) { settleReject(new Error("OAuth state mismatch")); return; }
      try {
        const tokens = await requestTokens(
          exchangeCodeBody({ code, verifier, redirectUri: REDIRECT_URI, clientId }),
          null,
        );
        settleResolve(tokens);
      } catch (e) { settleReject(e as Error); }
    });
    server.on("error", settleReject);
    server.listen(PORT, "127.0.0.1", () => {
      const authUrl = buildAuthUrl({ clientId, redirectUri: REDIRECT_URI, scopes: SCOPES, challenge, state });
      console.log("\nÖffne zum Login:\n" + authUrl + "\n");
      openBrowser(authUrl);
    });
    timer = setTimeout(() => {
      server.close();
      settleReject(new Error("OAuth-Login Timeout: keine Antwort innerhalb von 5 Minuten."));
    }, ABANDON_TIMEOUT_MS);
  });
}
