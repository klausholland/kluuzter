"use client";

import { useState } from "react";
import type { GameMode } from "@/lib/engine/types";
import { PlaylistPicker } from "./PlaylistPicker";
import { minTracksNeeded, type SetupConfig } from "@/components/game/game-setup";

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
    <main className="mx-auto max-w-lg space-y-6 p-4">
      <h1 className="text-2xl font-bold">Neues Spiel</h1>

      <section className="space-y-2">
        <h2 className="font-semibold">Spieler (Zugreihenfolge)</h2>
        {players.map((p, i) => (
          <div key={p.id} className="flex gap-2">
            <input
              value={p.name}
              onChange={(e) =>
                setPlayers((prev) =>
                  prev.map((q) => (q.id === p.id ? { ...q, name: e.target.value } : q)),
                )
              }
              placeholder={`Spieler ${i + 1}`}
              className="flex-1 rounded-lg bg-neutral-700 px-3 py-2 outline-none"
            />
            {players.length > 1 && (
              <button
                type="button"
                onClick={() => setPlayers((prev) => prev.filter((q) => q.id !== p.id))}
                className="rounded-lg bg-neutral-700 px-3"
                aria-label="Spieler entfernen"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPlayers((prev) => [...prev, newPlayer()])}
          className="rounded-lg bg-neutral-700 px-3 py-1 text-sm"
        >
          + Spieler hinzufügen
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Modus</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("targetCards")}
            className={`flex-1 rounded-lg px-3 py-2 ${mode === "targetCards" ? "bg-green-600" : "bg-neutral-700"}`}
          >
            X Karten erreichen
          </button>
          <button
            type="button"
            onClick={() => setMode("fixedRounds")}
            className={`flex-1 rounded-lg px-3 py-2 ${mode === "fixedRounds" ? "bg-green-600" : "bg-neutral-700"}`}
          >
            Feste Rundenzahl
          </button>
        </div>
        <label className="block text-sm">
          {mode === "targetCards" ? "Karten zum Sieg" : "Anzahl Runden"}
          <input
            type="number"
            min={1}
            value={targetValue}
            onChange={(e) => setTargetValue(Math.max(1, Number(e.target.value)))}
            className="ml-2 w-20 rounded bg-neutral-700 px-2 py-1"
          />
        </label>
        <label className="block text-sm">
          Start-Token je Spieler
          <input
            type="number"
            min={0}
            value={startTokens}
            onChange={(e) => setStartTokens(Math.max(0, Number(e.target.value)))}
            className="ml-2 w-20 rounded bg-neutral-700 px-2 py-1"
          />
        </label>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Playlists</h2>
        <PlaylistPicker
          selectedIds={playlistIds}
          onChange={(ids, total) => {
            setPlaylistIds(ids);
            setAvailableTracks(total);
          }}
        />
        {tooFewTracks && (
          <p className="text-sm text-amber-400">
            Achtung: ~{availableTracks} Tracks gewählt, empfohlen sind ≥ {needed} für
            diesen Modus.
          </p>
        )}
      </section>

      <button
        type="button"
        disabled={!canStart}
        onClick={() => onStart(config)}
        className="w-full rounded-xl bg-green-600 py-3 text-lg font-semibold disabled:opacity-40"
      >
        Deck vorbereiten & starten
      </button>
    </main>
  );
}
