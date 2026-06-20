"use client";

import type { Player, Resolution } from "@/lib/engine/types";
import { GameCard } from "./Card";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";

export function RevealOverlay({
  resolution,
  players,
  activePlayerId,
  onContinue,
}: {
  resolution: Resolution;
  players: Player[];
  activePlayerId: string;
  onContinue: (claimedCorrect: boolean) => void;
}) {
  const winner = resolution.winnerId
    ? players.find((p) => p.id === resolution.winnerId)
    : null;
  const activeName =
    players.find((p) => p.id === activePlayerId)?.name ?? "Spieler";
  const correct = resolution.activeCorrect;

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: (theme) => theme.zIndex.modal,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        p: 3,
        textAlign: "center",
        bgcolor: correct ? "rgba(5, 46, 22, 0.9)" : "rgba(69, 10, 10, 0.9)",
      }}
    >
      {/* Großes, partytaugliches Richtig/Falsch-Banner */}
      <Paper
        data-testid="verdict-banner"
        elevation={8}
        sx={{
          width: "100%",
          maxWidth: 420,
          px: 3,
          py: 2,
          borderRadius: 4,
          bgcolor: correct ? "success.main" : "error.main",
        }}
      >
        <Typography sx={{ fontSize: 36, fontWeight: 900, letterSpacing: 1, color: "#fff" }}>
          {correct ? "✓ RICHTIG!" : "✗ DANEBEN!"}
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: 14, color: "rgba(255,255,255,0.9)" }}>
          {activeName} hat {correct ? "richtig" : "falsch"} eingeordnet
        </Typography>
      </Paper>

      <GameCard card={resolution.card} />
      <Typography sx={{ fontSize: 18, fontWeight: 600 }}>
        {resolution.card.title} — {resolution.card.artist} ({resolution.card.year})
      </Typography>

      {resolution.counters.length > 0 && (
        <Stack spacing={0.5}>
          {resolution.counters.map((c) => (
            <Typography
              key={c.playerId}
              sx={{ color: c.correct ? "success.light" : "error.light" }}
            >
              Konter {players.find((p) => p.id === c.playerId)?.name} (Slot {c.slot}):{" "}
              {c.correct ? "richtig" : "falsch"}
            </Typography>
          ))}
        </Stack>
      )}

      <Typography sx={{ fontSize: 20, fontWeight: 700 }}>
        {winner ? `🎉 ${winner.name} gewinnt die Karte!` : "Karte wird verworfen."}
      </Typography>

      <Stack spacing={1} sx={{ mt: 1, width: "100%", maxWidth: 360 }}>
        <Typography sx={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}>
          Hat {activeName} Titel & Interpret laut richtig genannt? (+1 Token)
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            onClick={() => onContinue(true)}
            color="success"
            sx={{ flex: 1 }}
          >
            Ja, +1 Token
          </Button>
          <Button
            onClick={() => onContinue(false)}
            color="inherit"
            sx={{ flex: 1 }}
          >
            Nein, weiter
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
