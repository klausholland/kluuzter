import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTokens, writeTokens, configDir } from "../store";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kluuzter-store-"));
  process.env.KLUUZTER_CONFIG_DIR = dir;
});
afterEach(async () => {
  delete process.env.KLUUZTER_CONFIG_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("store", () => {
  it("returns null when no tokens file exists", async () => {
    expect(await readTokens()).toBeNull();
  });

  it("round-trips tokens through write/read", async () => {
    const tokens = { access_token: "AT", refresh_token: "RT", expires_at: 123 };
    await writeTokens(tokens);
    expect(await readTokens()).toEqual(tokens);
  });

  it("uses KLUUZTER_CONFIG_DIR as the config directory", () => {
    expect(configDir()).toBe(dir);
  });
});
