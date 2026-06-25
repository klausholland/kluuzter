import React from "react";
import { Box, Text } from "ink";
import SelectList from "./SelectList";
import type { Player } from "@/lib/engine/types";

function slotLabel(player: Player, slot: number): string {
  const t = player.timeline;
  if (t.length === 0) return "erste Karte";
  if (slot === 0) return `vor ${t[0].year}`;
  if (slot === t.length) return `nach ${t[t.length - 1].year}`;
  return `zwischen ${t[slot - 1].year} und ${t[slot].year}`;
}

const PASS = -1;
const SKIP = -2;

export default function SlotPicker(props: {
  player: Player;
  slots: number[];
  prompt: string;
  onPick: (slot: number) => void;
  onPass?: () => void;
  onSkip?: () => void;
}): React.ReactElement {
  const items = props.slots.map((s) => ({ label: slotLabel(props.player, s), value: s }));
  if (props.onPass) items.push({ label: "Passen (kein Konter)", value: PASS });
  if (props.onSkip) items.push({ label: "Song überspringen (in Region nicht spielbar)", value: SKIP });

  return (
    <Box flexDirection="column">
      <Text>{props.prompt}</Text>
      <SelectList
        items={items}
        onSelect={(v) => {
          if (v === PASS && props.onPass) props.onPass();
          else if (v === SKIP && props.onSkip) props.onSkip();
          else props.onPick(v);
        }}
      />
    </Box>
  );
}
