import React from "react";
import { render, Text, Box } from "ink";
import type { GameMode } from "@/lib/engine/types";

const mode: GameMode = "targetCards";

function Hello(): React.ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color="cyan">Kluuzter CLI — Skeleton</Text>
      <Text>Default mode: {mode}</Text>
    </Box>
  );
}

render(<Hello />);
