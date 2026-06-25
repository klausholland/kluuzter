import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type StoredTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
};

export function configDir(): string {
  return process.env.KLUUZTER_CONFIG_DIR ?? join(homedir(), ".config", "kluuzter");
}

function tokensPath(): string {
  return join(configDir(), "tokens.json");
}

export async function readTokens(): Promise<StoredTokens | null> {
  try {
    return JSON.parse(await readFile(tokensPath(), "utf8")) as StoredTokens;
  } catch {
    return null;
  }
}

export async function writeTokens(tokens: StoredTokens): Promise<void> {
  await mkdir(configDir(), { recursive: true, mode: 0o700 });
  await writeFile(tokensPath(), JSON.stringify(tokens, null, 2), { mode: 0o600 });
}
