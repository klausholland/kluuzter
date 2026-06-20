"use client";

import { useEffect, useState } from "react";
import type { SpotifyPlaylistSummary } from "@/lib/spotify/types";
import { fetchStatus, indexPlaylist } from "@/lib/spotify/playlist-index";

async function fetchPlaylists(query: string): Promise<SpotifyPlaylistSummary[]> {
  const url = query
    ? `/api/spotify/playlists?q=${encodeURIComponent(query)}`
    : "/api/spotify/playlists";
  const res = await fetch(url);
  if (!res.ok) throw new Error("playlists fetch failed");
  return (await res.json()) as SpotifyPlaylistSummary[];
}

type IndexState =
  | { kind: "loading" }
  | { kind: "ready"; total: number; indexed: number }
  | { kind: "indexing"; done: number; total: number }
  | { kind: "error" };

function IndexControls({ playlistId }: { playlistId: string }) {
  const [state, setState] = useState<IndexState>({ kind: "loading" });

  async function loadStatus() {
    setState({ kind: "loading" });
    try {
      const s = await fetchStatus(playlistId);
      setState({ kind: "ready", total: s.total, indexed: s.indexed });
    } catch {
      setState({ kind: "error" });
    }
  }

  useEffect(() => {
    let active = true;
    fetchStatus(playlistId)
      .then((s) => active && setState({ kind: "ready", total: s.total, indexed: s.indexed }))
      .catch(() => active && setState({ kind: "error" }));
    return () => {
      active = false;
    };
  }, [playlistId]);

  async function runIndex(force = false) {
    setState({ kind: "indexing", done: 0, total: 0 });
    try {
      await indexPlaylist(playlistId, {
        force,
        onProgress: (done, total) => setState({ kind: "indexing", done, total }),
      });
      await loadStatus();
    } catch {
      setState({ kind: "error" });
    }
  }

  if (state.kind === "loading") {
    return <p className="text-xs text-neutral-400">Status wird geladen…</p>;
  }
  if (state.kind === "error") {
    return (
      <button type="button" onClick={loadStatus} className="text-xs text-red-400 underline">
        Status-Fehler — erneut versuchen
      </button>
    );
  }
  if (state.kind === "indexing") {
    const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;
    return (
      <p className="text-xs text-amber-300">
        Indiziere… {state.done}/{state.total} ({pct}%)
      </p>
    );
  }
  // ready
  const fully = state.indexed >= state.total && state.total > 0;
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs ${fully ? "text-green-400" : "text-neutral-300"}`}>
        {fully ? "indiziert ✓" : `${state.indexed} / ${state.total} indiziert`}
      </span>
      {fully ? (
        <button
          type="button"
          onClick={() => runIndex(true)}
          className="rounded bg-neutral-700 px-2 py-1 text-xs font-semibold"
        >
          Neu indizieren
        </button>
      ) : (
        <button
          type="button"
          onClick={() => runIndex(false)}
          className="rounded bg-fuchsia-600 px-2 py-1 text-xs font-semibold"
        >
          Indizieren
        </button>
      )}
    </div>
  );
}

export function PlaylistPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[], totalTracks: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchPlaylists(query)
      .then((p) => active && setPlaylists(p))
      .catch(() => active && setError("Playlists konnten nicht geladen werden."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query]);

  function toggle(p: SpotifyPlaylistSummary) {
    const next = selectedIds.includes(p.id)
      ? selectedIds.filter((id) => id !== p.id)
      : [...selectedIds, p.id];
    const total = playlists
      .filter((pl) => next.includes(pl.id))
      .reduce((sum, pl) => sum + pl.trackCount, 0);
    onChange(next, total);
  }

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Öffentliche Playlists suchen…"
        className="w-full rounded-lg bg-neutral-700 px-3 py-2 outline-none"
      />
      {loading && <p className="text-sm text-neutral-400">Lädt…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {playlists.map((p) => {
          const selected = selectedIds.includes(p.id);
          return (
            <li key={p.id} className="space-y-1">
              <button
                type="button"
                onClick={() => toggle(p)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left ${
                  selected ? "bg-green-600/30 ring-1 ring-green-400" : "bg-neutral-800"
                }`}
              >
                <span className="truncate">
                  {p.name}
                  <span className="ml-2 text-xs text-neutral-400">
                    {p.trackCount} Tracks · {p.owner}
                  </span>
                </span>
                {selected && <span className="text-green-300">✓</span>}
              </button>
              {selected && (
                <div className="px-3">
                  <IndexControls playlistId={p.id} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
