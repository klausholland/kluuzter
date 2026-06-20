import type { Card } from "@/lib/engine/types";
import { Box } from "@mui/material";
import { GameCard } from "./Card";
import { Slot } from "./Slot";

export function Timeline({
  cards,
  availableSlots,
  selectedSlot,
  onSelectSlot,
  interactive,
  onCardClick,
}: {
  cards: Card[];
  availableSlots: number[];
  selectedSlot: number | null;
  onSelectSlot: (slot: number) => void;
  interactive: boolean;
  onCardClick?: (card: Card) => void;
}) {
  const free = new Set(availableSlots);
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i <= cards.length; i++) {
    nodes.push(
      <Slot
        key={`slot-${i}`}
        index={i}
        selected={selectedSlot === i}
        disabled={!interactive || !free.has(i)}
        onSelect={onSelectSlot}
      />,
    );
    if (i < cards.length) {
      const c = cards[i];
      nodes.push(
        <GameCard
          key={c.id}
          card={c}
          onClick={onCardClick ? () => onCardClick(c) : undefined}
        />,
      );
    }
  }
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, overflowX: "auto", px: 1.5, py: 2 }}>
      {nodes}
    </Box>
  );
}
