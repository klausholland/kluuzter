import { EventEmitter } from "node:events";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openBrowser } from "../flow";

// ---------------------------------------------------------------------------
// Fake spawn factory
// Each fake child is an EventEmitter with a no-op `.unref()`.
// By default every spawn fires an ENOENT error via setImmediate so the
// production fallback chain is exercised without touching real binaries.
// ---------------------------------------------------------------------------
type SpawnCall = { cmd: string; args: string[] };

function makeAllErrorSpawn() {
  const spawnCalls: SpawnCall[] = [];

  function fakeSpawn(cmd: string, args: string[], _opts: unknown) {
    spawnCalls.push({ cmd, args: args as string[] });
    const child = Object.assign(new EventEmitter(), { unref() {} });
    // Fire the error *after* the caller can attach .on("error", ...) — mirrors
    // how Node delivers async spawn errors in production.
    setImmediate(() =>
      child.emit(
        "error",
        Object.assign(new Error(`spawn ${cmd} ENOENT`), { code: "ENOENT" }),
      ),
    );
    return child;
  }

  return { fakeSpawn, spawnCalls };
}

/** Drain enough event-loop ticks for all chained setImmediate callbacks to fire. */
async function flushAsync(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 20));
}

// ---------------------------------------------------------------------------

describe("openBrowser", () => {
  let savedWSL: string | undefined;

  beforeEach(() => {
    savedWSL = process.env.WSL_DISTRO_NAME;
  });

  afterEach(() => {
    if (savedWSL === undefined) delete process.env.WSL_DISTRO_NAME;
    else process.env.WSL_DISTRO_NAME = savedWSL;
  });

  it("does not crash when every opener candidate is missing (ENOENT)", async () => {
    process.env.WSL_DISTRO_NAME = "Ubuntu"; // force WSL path for determinism

    const { fakeSpawn, spawnCalls } = makeAllErrorSpawn();

    // openBrowser must return without throwing even though every spawn errors
    expect(() =>
      openBrowser("https://example.com", fakeSpawn as any),
    ).not.toThrow();

    await flushAsync();

    // The fallback chain was exercised: more than one candidate was tried
    expect(spawnCalls.length).toBeGreaterThan(1);
  });

  it("on WSL2 tries wslview first, then powershell.exe second", async () => {
    process.env.WSL_DISTRO_NAME = "Ubuntu";

    const { fakeSpawn, spawnCalls } = makeAllErrorSpawn();

    openBrowser("https://example.com", fakeSpawn as any);
    await flushAsync();

    expect(spawnCalls[0].cmd).toBe("wslview");
    expect(spawnCalls[1].cmd).toBe("powershell.exe");
  });

  it("on WSL2 includes xdg-open as the last-resort fallback", async () => {
    process.env.WSL_DISTRO_NAME = "Ubuntu";

    const { fakeSpawn, spawnCalls } = makeAllErrorSpawn();

    openBrowser("https://example.com", fakeSpawn as any);
    await flushAsync();

    const cmds = spawnCalls.map((c) => c.cmd);
    expect(cmds.at(-1)).toBe("xdg-open");
  });
});
