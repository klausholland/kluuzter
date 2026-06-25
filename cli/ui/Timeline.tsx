import React from "react";
import { Box, Text } from "ink";
import type { Player } from "@/lib/engine/types";

export default function Timeline(props: { player: Player }): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text bold>Timeline von {props.player.name}:</Text>
      {props.player.timeline.length === 0 ? (
        <Text dimColor>  (leer)</Text>
      ) : (
        props.player.timeline.map((c, i) => (
          <Text key={c.id}>  {i + 1}. [{c.year}] {c.artist} – {c.title}</Text>
        ))
      )}
    </Box>
  );
}
