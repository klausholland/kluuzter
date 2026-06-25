import React from "react";
import { Box, Text } from "ink";
import type { GameContext } from "@/lib/engine/types";

export default function GameOver(props: { context: GameContext }): React.ReactElement {
  const { players, winnerId } = props.context;
  const winner = players.find((p) => p.id === winnerId);
  const ranked = [...players].sort((a, b) => b.timeline.length - a.timeline.length);
  return (
    <Box flexDirection="column">
      <Text bold color="green">Spiel vorbei!</Text>
      <Text>Sieger: {winner ? winner.name : "—"}</Text>
      {ranked.map((p) => <Text key={p.id}>  {p.name}: {p.timeline.length} Karten, {p.tokens} Tokens</Text>)}
      <Text dimColor>Spiel beendet — schließt automatisch… (Ctrl-C zum sofortigen Beenden)</Text>
    </Box>
  );
}
