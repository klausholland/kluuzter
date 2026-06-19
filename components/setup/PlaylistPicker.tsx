"use client";

import { useEffect, useState } from "react";
import type { SpotifyPlaylistSummary } from "@/lib/spotify/types";

async function fetchPlaylists(query: string): Promise<SpotifyPlaylistSummary[]> {
  const url = query
    ? `/api/spotify/playlists?q=${encodeURIComponent(query)}`
    : "/api/spotify/playlists";
  const res = await fetch(url);
  if (!res.ok) throw new Error("playlists fetch failed");
  return (await res.json()) as SpotifyPlaylistSummary[];
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
            <li key={p.id}>
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
