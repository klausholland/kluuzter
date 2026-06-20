// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { PlaylistPicker } from "../PlaylistPicker";

afterEach(cleanup);

// Module mit den Netz-Funktionen mocken
vi.mock("@/lib/spotify/playlist-index", () => ({
  fetchStatus: vi.fn(async () => ({ total: 5, indexed: 2, missing: [] })),
  indexPlaylist: vi.fn(async (_id: string, opts?: { onProgress?: (d: number, t: number) => void }) => {
    opts?.onProgress?.(3, 3);
  }),
}));

// Playlists-Fetch (globaler fetch) mocken
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify([
          { id: "pl1", name: "Oldies", imageUrl: null, trackCount: 5, owner: "me" },
        ]),
        { status: 200 },
      ),
    ),
  );
});

describe("PlaylistPicker indexing", () => {
  it("shows an index status badge for a selected playlist", async () => {
    render(<PlaylistPicker selectedIds={["pl1"]} onChange={() => {}} />);
    // Status wird nach Auswahl geladen
    expect(await screen.findByText(/2\s*\/\s*5 indiziert/i)).toBeTruthy();
  });

  it("runs indexPlaylist when the index button is clicked", async () => {
    const { indexPlaylist } = await import("@/lib/spotify/playlist-index");
    render(<PlaylistPicker selectedIds={["pl1"]} onChange={() => {}} />);
    const btn = await screen.findByRole("button", { name: /^indizieren$/i });
    fireEvent.click(btn);
    await waitFor(() =>
      expect(indexPlaylist).toHaveBeenCalledWith(
        "pl1",
        expect.objectContaining({ force: false }),
      ),
    );
  });

  it("offers a re-index (force) button when fully indexed", async () => {
    const { fetchStatus, indexPlaylist } = await import("@/lib/spotify/playlist-index");
    vi.mocked(fetchStatus).mockResolvedValue({ total: 5, indexed: 5, missing: [], all: [] });

    render(<PlaylistPicker selectedIds={["pl1"]} onChange={() => {}} />);
    // vollständig indiziert
    expect(await screen.findByText(/indiziert ✓/i)).toBeTruthy();
    const reBtn = await screen.findByRole("button", { name: /neu indizieren/i });
    fireEvent.click(reBtn);
    await waitFor(() =>
      expect(indexPlaylist).toHaveBeenCalledWith(
        "pl1",
        expect.objectContaining({ force: true }),
      ),
    );
  });
});
