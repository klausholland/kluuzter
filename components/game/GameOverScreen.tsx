import type { Player } from "@/lib/engine/types";
import { scoredCardCount } from "@/lib/engine/timeline";

export function GameOverScreen({
  players,
  winnerId,
  onRestart,
}: {
  players: Player[];
  winnerId: string | null;
  onRestart: () => void;
}) {
  const ranked = [...players].sort(
    (a, b) => scoredCardCount(b) - scoredCardCount(a) || b.tokens - a.tokens,
  );
  return (
    <main className="mx-auto max-w-md space-y-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Spiel beendet</h1>
      <ul className="space-y-2">
        {ranked.map((p) => (
          <li
            key={p.id}
            className={`flex justify-between rounded-lg px-4 py-2 ${
              p.id === winnerId ? "bg-green-600/30 ring-1 ring-green-400" : "bg-neutral-800"
            }`}
          >
            <span className="font-semibold">
              {p.id === winnerId ? "🏆 " : ""}
              {p.name}
            </span>
            <span>
              {scoredCardCount(p)} Karten · {p.tokens} Token
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onRestart}
        className="w-full rounded-xl bg-green-600 py-3 text-lg font-semibold"
      >
        Neue Runde
      </button>
    </main>
  );
}
