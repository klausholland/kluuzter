import { describe, it, expect, vi } from "vitest";
import { startLibrespot, DEVICE_NAME } from "../librespot";

describe("startLibrespot", () => {
  it("spawns the binary with the device name and access token", () => {
    const fakeChild = { kill: vi.fn() };
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
});
