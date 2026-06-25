import React from "react";
import { Box, Text } from "ink";
import type { GameContext } from "@/lib/engine/types";

export default function PlayerBar(props: { context: GameContext }): React.ReactElement {
  const { players, activeIndex } = props.context;
  return (
    <Box>
      {players.map((p, i) => (
        <Text key={p.id} color={i === activeIndex ? "cyan" : undefined} bold={i === activeIndex}>
          {i === activeIndex ? "▶ " : "  "}{p.name} [{p.timeline.length}🃏 {p.tokens}🪙]{"  "}
        </Text>
      ))}
    </Box>
  );
}
