"use client";

import { useState } from "react";
import type { GameMode } from "@/lib/engine/types";
import { PlaylistPicker } from "./PlaylistPicker";
import { minTracksNeeded, type SetupConfig } from "@/components/game/game-setup";
import {
  Alert,
  Button,
  Container,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

type DraftPlayer = { id: string; name: string };

function newPlayer(): DraftPlayer {
  return { id: crypto.randomUUID(), name: "" };
}

export function SetupScreen({
  onStart,
}: {
  onStart: (config: SetupConfig) => void;
}) {
  const [players, setPlayers] = useState<DraftPlayer[]>([
    { id: crypto.randomUUID(), name: "Spieler 1" },
  ]);
  const [mode, setMode] = useState<GameMode>("targetCards");
  const [targetValue, setTargetValue] = useState(10);
  const [startTokens, setStartTokens] = useState(2);
  const [playlistIds, setPlaylistIds] = useState<string[]>([]);
  const [availableTracks, setAvailableTracks] = useState(0);

  const namedPlayers = players
    .map((p) => ({ id: p.id, name: p.name.trim() }))
    .filter((p) => p.name.length > 0);

  const config: SetupConfig = {
    players: namedPlayers,
    mode,
    targetValue,
    startTokens,
    playlistIds,
  };

  const needed = minTracksNeeded(config);
  const tooFewTracks = playlistIds.length > 0 && availableTracks < needed;
  const canStart =
    namedPlayers.length >= 1 && playlistIds.length > 0 && targetValue > 0;

  return (
    <Container component="main" maxWidth="sm" sx={{ py: 4 }}>
      <Stack spacing={4}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Neues Spiel
        </Typography>

        <Stack spacing={1.5}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Spieler (Zugreihenfolge)
          </Typography>
          {players.map((p, i) => (
            <Stack key={p.id} direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                value={p.name}
                onChange={(e) =>
                  setPlayers((prev) =>
                    prev.map((q) => (q.id === p.id ? { ...q, name: e.target.value } : q)),
                  )
                }
                placeholder={`Spieler ${i + 1}`}
              />
              {players.length > 1 && (
                <IconButton
                  type="button"
                  onClick={() => setPlayers((prev) => prev.filter((q) => q.id !== p.id))}
                  aria-label="Spieler entfernen"
                >
                  <CloseIcon />
                </IconButton>
              )}
            </Stack>
          ))}
          <Button
            type="button"
            onClick={() => setPlayers((prev) => [...prev, newPlayer()])}
            size="small"
            sx={{ alignSelf: "flex-start" }}
          >
            + Spieler hinzufügen
          </Button>
        </Stack>

        <Stack spacing={1.5}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Modus
          </Typography>
          <ToggleButtonGroup
            value={mode}
            exclusive
            fullWidth
            onChange={(_e, next) => {
              if (next) setMode(next as GameMode);
            }}
          >
            <ToggleButton value="targetCards">X Karten erreichen</ToggleButton>
            <ToggleButton value="fixedRounds">Feste Rundenzahl</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            type="number"
            label={mode === "targetCards" ? "Karten zum Sieg" : "Anzahl Runden"}
            size="small"
            sx={{ maxWidth: 160 }}
            slotProps={{ htmlInput: { min: 1 } }}
            value={targetValue}
            onChange={(e) => setTargetValue(Math.max(1, Number(e.target.value)))}
          />
          <TextField
            type="number"
            label="Start-Token je Spieler"
            size="small"
            sx={{ maxWidth: 160 }}
            slotProps={{ htmlInput: { min: 0 } }}
            value={startTokens}
            onChange={(e) => setStartTokens(Math.max(0, Number(e.target.value)))}
          />
        </Stack>

        <Stack spacing={1.5}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Playlists
          </Typography>
          <PlaylistPicker
            selectedIds={playlistIds}
            onChange={(ids, total) => {
              setPlaylistIds(ids);
              setAvailableTracks(total);
            }}
          />
          {tooFewTracks && (
            <Alert severity="warning">
              Achtung: ~{availableTracks} Tracks gewählt, empfohlen sind ≥ {needed} für
              diesen Modus.
            </Alert>
          )}
        </Stack>

        <Button
          type="button"
          disabled={!canStart}
          onClick={() => onStart(config)}
          fullWidth
          size="large"
          color="success"
        >
          Deck vorbereiten & starten
        </Button>
      </Stack>
    </Container>
  );
}
