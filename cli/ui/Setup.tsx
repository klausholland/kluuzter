import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import SelectList from "./SelectList";
import TextPrompt from "./TextPrompt";
import { listPlaylists, buildDeckForPlaylist } from "@/cli/deck/build";
import type { GameInput, GameMode, PlayerSetup } from "@/lib/engine/types";
import type { SpotifyPlaylistSummary } from "@/lib/spotify/types";

type Step = "players" | "mode" | "target" | "tokens" | "playlist" | "building";

export default function Setup(props: { token: string; onReady: (input: GameInput) => void }): React.ReactElement {
  const [step, setStep] = useState<Step>("players");
  const [players, setPlayers] = useState<PlayerSetup[]>([]);
  const [mode, setMode] = useState<GameMode>("targetCards");
  const [targetValue, setTargetValue] = useState(10);
  const [startTokens, setStartTokens] = useState(3);
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load playlists once we reach the playlist step.
  useEffect(() => {
    if (step !== "playlist") return;
    let active = true;
    listPlaylists(props.token)
      .then((p) => { if (active) setPlaylists(p); })
      .catch((e) => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, [step, props.token]);

  if (error) return <Text color="red">Fehler: {error}</Text>;

  if (step === "players") {
    return (
      <Box flexDirection="column">
        <Text>Spieler {players.length + 1} (leer lassen + Enter zum Starten):</Text>
        {players.map((p, i) => <Text key={p.id}>  {i + 1}. {p.name}</Text>)}
        <TextPrompt
          label="Name:"
          onSubmit={(name) => {
            const trimmed = name.trim();
            if (trimmed === "" && players.length > 0) { setStep("mode"); return; }
            if (trimmed === "") return;
            setPlayers((ps) => [...ps, { id: `p${ps.length + 1}`, name: trimmed }]);
          }}
        />
      </Box>
    );
  }

  if (step === "mode") {
    return (
      <SelectList
        label="Spielmodus:"
        items={[
          { label: "Erster mit X Karten gewinnt", value: "targetCards" as GameMode },
          { label: "Feste Rundenzahl", value: "fixedRounds" as GameMode },
        ]}
        onSelect={(m) => { setMode(m); setStep("target"); }}
      />
    );
  }

  if (step === "target") {
    const label = mode === "targetCards" ? "Karten zum Sieg:" : "Anzahl Runden:";
    return (
      <SelectList
        label={label}
        items={[5, 8, 10, 12, 15].map((n) => ({ label: String(n), value: n }))}
        onSelect={(n) => { setTargetValue(n); setStep("tokens"); }}
      />
    );
  }

  if (step === "tokens") {
    return (
      <SelectList
        label="Start-Tokens pro Spieler:"
        items={[0, 1, 2, 3, 4].map((n) => ({ label: String(n), value: n }))}
        onSelect={(n) => { setStartTokens(n); setStep("playlist"); }}
      />
    );
  }

  if (step === "playlist") {
    if (playlists.length === 0) return <Text>Lade Playlists…</Text>;
    return (
      <SelectList
        label="Playlist wählen:"
        items={playlists.map((p) => ({ label: `${p.name} (${p.trackCount})`, value: p.id }))}
        onSelect={(id) => {
          setStep("building");
          buildDeckForPlaylist(props.token, id)
            .then((deck) => props.onReady({ players, mode, targetValue, startTokens, deck }))
            .catch((e) => setError(String(e)));
        }}
      />
    );
  }

  return <Text>Baue Deck (Jahre werden angereichert)…</Text>;
}
