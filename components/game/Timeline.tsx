import type { Card } from "@/lib/engine/types";
import { GameCard } from "./Card";
import { Slot } from "./Slot";

export function Timeline({
  cards,
  availableSlots,
  selectedSlot,
  onSelectSlot,
  interactive,
}: {
  cards: Card[];
  availableSlots: number[];
  selectedSlot: number | null;
  onSelectSlot: (slot: number) => void;
  interactive: boolean;
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
      nodes.push(<GameCard key={cards[i].id} card={cards[i]} />);
    }
  }
  return (
    <div className="flex items-center gap-1 overflow-x-auto px-3 py-4">
      {nodes}
    </div>
  );
}
