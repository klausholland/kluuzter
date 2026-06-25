import React, { useEffect } from "react";
import { Box, Text, useApp } from "ink";
import { useGameEngine } from "@/lib/engine/useGameEngine";
import { activePlayer, availableSlots } from "@/lib/engine/selectors";
import type { GameInput } from "@/lib/engine/types";
import type { AudioController } from "@/cli/audio/controller";
import { useAudioSync } from "./useAudioSync";
import PlayerBar from "./PlayerBar";
import Timeline from "./Timeline";
import SlotPicker from "./SlotPicker";
import Reveal from "./Reveal";
import GameOver from "./GameOver";

/** How long the final standings stay on screen before the CLI exits itself. */
const GAME_OVER_EXIT_DELAY_MS = 6000;

export default function App(props: { input: GameInput; controller: AudioController }): React.ReactElement {
  const { context, phase, send } = useGameEngine(props.input);
  useAudioSync(props.controller, phase, context.currentCard);
  const { exit } = useApp();

  // When the game is over, show the standings briefly, then unmount Ink. Root's
  // effect cleanup stops librespot on unmount and index.tsx exits the process.
  useEffect(() => {
    if (phase !== "gameOver") return;
    const t = setTimeout(() => exit(), GAME_OVER_EXIT_DELAY_MS);
    return () => clearTimeout(t);
  }, [phase, exit]);

  const active = activePlayer(context);
  const slots = availableSlots(context);

  return (
    <Box flexDirection="column" padding={1}>
      <PlayerBar context={context} />
      <Box marginY={1}><Timeline player={active} /></Box>

      {phase === "playing" && (
        <SlotPicker
          player={active}
          slots={slots}
          prompt={`♪ Mystery-Song läuft — wo einordnen, ${active.name}?`}
          onPick={(slot) => send({ type: "PLACE", slot })}
          onSkip={() => send({ type: "SKIP" })}
        />
      )}

      {phase === "countering" && (
        <SlotPicker
          player={active}
          slots={slots}
          prompt="Konter: in die Timeline des aktiven Spielers einordnen (kostet 1 Token) oder passen."
          onPick={(slot) => send({ type: "COUNTER", slot })}
          onPass={() => send({ type: "PASS" })}
        />
      )}

      {phase === "reveal" && context.resolution && (
        <Reveal resolution={context.resolution} onContinue={(claimed) => send({ type: "CONTINUE", claimedCorrect: claimed })} />
      )}

      {phase === "gameOver" && <GameOver context={context} />}

      {(phase === "dealing" || phase === "betweenTurns" || phase === "drawNext") && (
        <Text dimColor>…</Text>
      )}
    </Box>
  );
}
