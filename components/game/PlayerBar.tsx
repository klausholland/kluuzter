import type { Player } from "@/lib/engine/types";
import { scoredCardCount } from "@/lib/engine/timeline";

export function PlayerBar({
  players,
  activeIndex,
}: {
  players: Player[];
  activeIndex: number;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-neutral-800 px-3 py-2">
      {players.map((p, i) => (
        <div
          key={p.id}
          className={`flex shrink-0 flex-col rounded-lg px-3 py-1 text-sm ${
            i === activeIndex
              ? "bg-green-600/30 ring-1 ring-green-400"
              : "bg-neutral-800"
          }`}
        >
          <span className="font-semibold">{p.name}</span>
          <span className="text-xs text-neutral-300">
            {scoredCardCount(p)} Karten · {p.tokens} Token
          </span>
        </div>
      ))}
    </div>
  );
}
