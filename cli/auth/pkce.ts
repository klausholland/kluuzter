import { createHash, randomBytes } from "node:crypto";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateCodeVerifier(rng: () => Buffer = () => randomBytes(32)): string {
  return base64url(rng());
}

export function codeChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

export function buildAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  challenge: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    code_challenge_method: "S256",
    code_challenge: opts.challenge,
    scope: opts.scopes.join(" "),
    state: opts.state,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}
