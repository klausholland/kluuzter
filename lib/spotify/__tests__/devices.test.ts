import { describe, it, expect, vi } from "vitest";
import { getDevices } from "../api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("getDevices", () => {
  it("requests /me/player/devices and maps the result", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://api.spotify.com/v1/me/player/devices");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
      return jsonResponse({
        devices: [
          { id: "d1", name: "Kluuzter", is_active: false },
          { id: null, name: "Restricted", is_active: false },
        ],
      });
    }) as unknown as typeof fetch;

    const out = await getDevices("tok", fetchImpl);
    expect(out).toEqual([
      { id: "d1", name: "Kluuzter", isActive: false },
      { id: null, name: "Restricted", isActive: false },
    ]);
  });

  it("throws on a non-OK response", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 401)) as unknown as typeof fetch;
    await expect(getDevices("tok", fetchImpl)).rejects.toThrow();
  });
});
