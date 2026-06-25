import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { startLibrespot, DEVICE_NAME } from "../librespot";

function makeFakeChild() {
  const child = new EventEmitter() as EventEmitter & { kill: ReturnType<typeof vi.fn> };
  child.kill = vi.fn();
  return child;
}

describe("startLibrespot", () => {
  it("spawns the binary with the device name and access token", () => {
    const fakeChild = makeFakeChild();
    const spawnImpl = vi.fn(() => fakeChild) as unknown as typeof import("node:child_process").spawn;
    const handle = startLibrespot("AT", { binary: "lr", spawnImpl });

    expect(spawnImpl).toHaveBeenCalledTimes(1);
    const [bin, args] = (spawnImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(bin).toBe("lr");
    expect(args).toContain("--name");
    expect(args).toContain(DEVICE_NAME);
    expect(args).toContain("--access-token");
    expect(args).toContain("AT");

    handle.stop();
    expect(fakeChild.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("does not crash and reports the error when the binary is missing (ENOENT)", () => {
    const fakeChild = makeFakeChild();
    const spawnImpl = vi.fn(() => fakeChild) as unknown as typeof import("node:child_process").spawn;
    const onError = vi.fn();

    startLibrespot("AT", { binary: "lr", spawnImpl, onError });

    const err = new Error("spawn librespot ENOENT");
    expect(() => fakeChild.emit("error", err)).not.toThrow();
    expect(onError).toHaveBeenCalledWith(err);
  });
});
