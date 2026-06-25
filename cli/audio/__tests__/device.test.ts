import { describe, it, expect, vi } from "vitest";
import { findDevice, waitForDevice } from "../device";
import type { SpotifyDevice } from "@/lib/spotify/api";

const dev = (id: string | null, name: string): SpotifyDevice => ({ id, name, isActive: false });

describe("findDevice", () => {
  it("returns the id of the named device", () => {
    expect(findDevice([dev("a", "Other"), dev("b", "Kluuzter")], "Kluuzter")).toBe("b");
  });
  it("ignores a matching name with a null id", () => {
    expect(findDevice([dev(null, "Kluuzter")], "Kluuzter")).toBeNull();
  });
  it("returns null when not present", () => {
    expect(findDevice([dev("a", "Other")], "Kluuzter")).toBeNull();
  });
});

describe("waitForDevice", () => {
  it("resolves once the device appears", async () => {
    const getter = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([dev("b", "Kluuzter")]);
    const id = await waitForDevice("Kluuzter", getter, { intervalMs: 1, sleep: async () => {} });
    expect(id).toBe("b");
    expect(getter).toHaveBeenCalledTimes(2);
  });
  it("throws after exhausting attempts", async () => {
    const getter = vi.fn().mockResolvedValue([]);
    await expect(waitForDevice("Kluuzter", getter, { attempts: 3, sleep: async () => {} })).rejects.toThrow();
    expect(getter).toHaveBeenCalledTimes(3);
  });
});
