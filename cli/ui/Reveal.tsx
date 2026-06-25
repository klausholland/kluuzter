import React from "react";
import { Box, Text } from "ink";
import SelectList from "./SelectList";
import type { Resolution } from "@/lib/engine/types";

export default function Reveal(props: {
  resolution: Resolution;
  onContinue: (claimedCorrect: boolean) => void;
}): React.ReactElement {
  const { card, activeCorrect, winnerId } = props.resolution;
  return (
    <Box flexDirection="column">
      <Text bold color="yellow">Auflösung</Text>
      <Text>{card.artist} – {card.title}</Text>
      <Text>Jahr: {card.year} ({card.yearSource})</Text>
      <Text color={activeCorrect ? "green" : "red"}>
        Platzierung des aktiven Spielers: {activeCorrect ? "richtig" : "falsch"}
      </Text>
      <Text>Karte geht an: {winnerId ?? "niemanden (verworfen)"}</Text>
      <Box marginTop={1}>
        <SelectList
          label="Bonus-Token für korrekt geratenen Titel/Interpret beanspruchen?"
          items={[{ label: "Nein, weiter", value: false }, { label: "Ja, Token beanspruchen", value: true }]}
          onSelect={props.onContinue}
        />
      </Box>
    </Box>
  );
}
