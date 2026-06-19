"use client";

import { useEffect, useState } from "react";
import type { GameInput } from "@/lib/engine/types";
import { useGameEngine } from "@/lib/engine/useGameEngine";
import {
  activePlayer,
  availableSlots,
  currentCountererId,
} from "@/lib/engine/selectors";
import { useSpotifyPlayer } from "@/lib/spotify/useSpotifyPlayer";
import { playTrack } from "@/lib/spotify/playback";
import { PlayerBar } from "./PlayerBar";
import { Timeline } from "./Timeline";
import { PlaybackControls } from "./PlaybackControls";
import { GameCard } from "./Card";
import { CounterOverlay } from "./CounterOverlay";
import { RevealOverlay } from "./RevealOverlay";
import { GameOverScreen } from "./GameOverScreen";

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
    <div className="flex min-h-screen flex-col">
      <PlayerBar players={context.players} activeIndex={context.activeIndex} />

      {error && (
        <p className="bg-red-900/50 px-3 py-1 text-center text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="flex-1">
        <p className="px-4 pt-3 text-sm text-neutral-400">
          {active.name} ist am Zug — wo gehört der Song hin?
        </p>
        <Timeline
          cards={active.timeline}
          availableSlots={slots}
          selectedSlot={selectedSlot}
          onSelectSlot={(s) => setSelectedSlot(s)}
          interactive={phase === "playing"}
        />
      </div>

      {phase === "playing" && (
        <div className="flex flex-col items-center gap-3 border-t border-neutral-800 p-4">
          {card && <GameCard card={card} faceDown />}
          <PlaybackControls
            playback={playback}
            onToggle={togglePlay}
            disabled={!ready}
          />
          {playError && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-amber-400">{playError}</p>
              <button
                type="button"
                onClick={() => {
                  setPlayError(null);
                  setSelectedSlot(null);
                  send({ type: "SKIP" });
                }}
                className="rounded-lg bg-neutral-700 px-4 py-2 text-sm"
              >
                Karte überspringen
              </button>
            </div>
          )}
          <button
            type="button"
            disabled={selectedSlot === null}
            onClick={() => {
              send({ type: "PLACE", slot: selectedSlot! });
              setSelectedSlot(null);
            }}
            className="w-full max-w-md rounded-xl bg-green-600 py-3 font-semibold disabled:opacity-40"
          >
            Hier einsetzen
          </button>
        </div>
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
    </div>
  );
}
