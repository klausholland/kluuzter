"use client";

import { useEffect, useState } from "react";
import type { Card, GameInput } from "@/lib/engine/types";
import { useGameEngine } from "@/lib/engine/useGameEngine";
import {
  activePlayer,
  availableSlots,
  currentCountererId,
} from "@/lib/engine/selectors";
import { useSpotifyPlayer } from "@/lib/spotify/useSpotifyPlayer";
import { playTrack } from "@/lib/spotify/playback";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Stack,
  Alert,
} from "@mui/material";
import { PlayerBar } from "./PlayerBar";
import { Timeline } from "./Timeline";
import { PlaybackControls } from "./PlaybackControls";
import { GameCard } from "./Card";
import { CounterOverlay } from "./CounterOverlay";
import { RevealOverlay } from "./RevealOverlay";
import { GameOverScreen } from "./GameOverScreen";
import { ConfirmDialog } from "./ConfirmDialog";
import { CardDetail } from "./CardDetail";

async function getAccessToken(): Promise<string> {
  const res = await fetch("/api/spotify/token");
  if (!res.ok) throw new Error("token fetch failed");
  return ((await res.json()) as { accessToken: string }).accessToken;
}

export function GameScreen({
  input,
  onRestart,
}: {
  input: GameInput;
  onRestart: () => void;
}) {
  const { send, context, phase } = useGameEngine(input);
  const { deviceId, ready, error, playback, togglePlay } = useSpotifyPlayer();
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [showAbort, setShowAbort] = useState(false);
  const [detailCard, setDetailCard] = useState<Card | null>(null);

  const card = context.currentCard;

  // Wiedergabe starten, sobald eine neue Mystery-Karte in der playing-Phase anliegt.
  useEffect(() => {
    if (phase !== "playing" || !deviceId || !card) return;
    let active = true;
    setPlayError(null);
    (async () => {
      try {
        const token = await getAccessToken();
        await playTrack(token, deviceId, card.uri);
      } catch {
        if (active) setPlayError("Track konnte nicht abgespielt werden.");
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, deviceId, card?.id]);

  if (phase === "gameOver") {
    return (
      <GameOverScreen
        players={context.players}
        winnerId={context.winnerId}
        onRestart={onRestart}
      />
    );
  }

  const active = activePlayer(context);
  const slots = availableSlots(context);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", flexDirection: "column" }}>
      <AppBar position="static">
        <Toolbar variant="dense" sx={{ justifyContent: "space-between" }}>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}
          >
            Kluuzter
          </Typography>
          <Button
            size="small"
            color="inherit"
            onClick={() => setShowAbort(true)}
          >
            Abbrechen
          </Button>
        </Toolbar>
      </AppBar>
      <PlayerBar players={context.players} activeIndex={context.activeIndex} />

      {error && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, pt: 1.5 }}>
          {active.name} ist am Zug — Mystery-Karte auf einen Slot ziehen oder einen
          Slot antippen.
        </Typography>
        <Timeline
          cards={active.timeline}
          availableSlots={slots}
          selectedSlot={selectedSlot}
          onSelectSlot={(s) => setSelectedSlot(s)}
          interactive={phase === "playing"}
          onCardClick={(c) => setDetailCard(c)}
        />
      </Box>

      {phase === "playing" && (
        <Stack
          spacing={1.5}
          sx={{ alignItems: "center", borderTop: 1, borderColor: "divider", p: 2 }}
        >
          {card && (
            <GameCard
              card={card}
              faceDown
              draggable
              onDragStart={(e) => {
                // Pflicht für Firefox, damit der Drag überhaupt startet.
                e.dataTransfer.setData("text/plain", "mystery-card");
                e.dataTransfer.effectAllowed = "move";
              }}
            />
          )}
          <PlaybackControls
            playback={playback}
            onToggle={togglePlay}
            disabled={!ready}
          />
          {playError && (
            <Stack spacing={1} sx={{ alignItems: "center" }}>
              <Alert severity="warning">{playError}</Alert>
              <Button
                color="inherit"
                onClick={() => {
                  setPlayError(null);
                  setSelectedSlot(null);
                  send({ type: "SKIP" });
                }}
              >
                Karte überspringen
              </Button>
            </Stack>
          )}
          <Button
            fullWidth
            color="success"
            size="large"
            disabled={selectedSlot === null}
            onClick={() => {
              send({ type: "PLACE", slot: selectedSlot! });
              setSelectedSlot(null);
            }}
            sx={{ maxWidth: 448 }}
          >
            Hier einsetzen
          </Button>
        </Stack>
      )}

      {phase === "countering" && (() => {
        const counterId = currentCountererId(context);
        const counterer = context.players.find((p) => p.id === counterId);
        if (!counterer) return null;
        return (
          <CounterOverlay
            counterer={counterer}
            availableSlots={slots}
            onCounter={(slot) => send({ type: "COUNTER", slot })}
            onPass={() => send({ type: "PASS" })}
          />
        );
      })()}

      {phase === "reveal" && context.resolution && (
        <RevealOverlay
          resolution={context.resolution}
          players={context.players}
          activePlayerId={active.id}
          onContinue={(claimedCorrect) =>
            send({ type: "CONTINUE", claimedCorrect })
          }
        />
      )}

      {showAbort && (
        <ConfirmDialog
          title="Spiel abbrechen?"
          message="Der aktuelle Spielfortschritt geht verloren."
          confirmLabel="Spiel beenden"
          cancelLabel="Weiterspielen"
          onConfirm={onRestart}
          onCancel={() => setShowAbort(false)}
        />
      )}

      {detailCard && (
        <CardDetail card={detailCard} onClose={() => setDetailCard(null)} />
      )}
    </Box>
  );
}
