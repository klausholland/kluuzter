"use client";

import { useEffect, useState } from "react";
import type { SpotifyPlaylistSummary } from "@/lib/spotify/types";
import { fetchStatus, indexPlaylist } from "@/lib/spotify/playlist-index";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  List,
  ListItemButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

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
    return (
      <Typography variant="caption" color="text.secondary">
        Status wird geladen…
      </Typography>
    );
  }
  if (state.kind === "error") {
    return (
      <Button type="button" onClick={loadStatus} size="small" color="error" variant="text">
        Status-Fehler — erneut versuchen
      </Button>
    );
  }
  if (state.kind === "indexing") {
    const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;
    return (
      <Stack spacing={0.5} sx={{ width: "100%" }}>
        <Typography variant="caption" color="warning.main">
          Indiziere… {state.done}/{state.total} ({pct}%)
        </Typography>
        <LinearProgress variant="determinate" value={pct} color="warning" />
      </Stack>
    );
  }
  // ready
  const fully = state.indexed >= state.total && state.total > 0;
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Typography variant="caption" color={fully ? "success.main" : "text.secondary"}>
        {fully ? "indiziert ✓" : `${state.indexed} / ${state.total} indiziert`}
      </Typography>
      {fully ? (
        <Button type="button" onClick={() => runIndex(true)} size="small">
          Neu indizieren
        </Button>
      ) : (
        <Button type="button" onClick={() => runIndex(false)} size="small" color="secondary">
          Indizieren
        </Button>
      )}
    </Stack>
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
    <Stack spacing={1}>
      <TextField
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Öffentliche Playlists suchen…"
        size="small"
        fullWidth
      />
      {loading && (
        <Typography variant="body2" color="text.secondary">
          Lädt…
        </Typography>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      <List sx={{ maxHeight: 256, overflowY: "auto", p: 0 }}>
        {playlists.map((p) => {
          const selected = selectedIds.includes(p.id);
          return (
            <Box component="li" key={p.id} sx={{ mb: 0.5, listStyle: "none" }}>
              <ListItemButton
                onClick={() => toggle(p)}
                selected={selected}
                sx={{
                  borderRadius: 2,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 1,
                }}
              >
                <Typography component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.name}
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    {p.trackCount} Tracks · {p.owner}
                  </Typography>
                </Typography>
                {selected && (
                  <Typography component="span" color="success.main">
                    ✓
                  </Typography>
                )}
              </ListItemButton>
              {selected && (
                <Box sx={{ px: 2, py: 0.5 }}>
                  <IndexControls playlistId={p.id} />
                </Box>
              )}
            </Box>
          );
        })}
      </List>
    </Stack>
  );
}
