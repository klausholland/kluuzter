import type { Player, Resolution } from "@/lib/engine/types";
import { GameCard } from "./Card";

export function RevealOverlay({
  resolution,
  players,
  activePlayerId,
  onContinue,
}: {
  resolution: Resolution;
  players: Player[];
  activePlayerId: string;
  onContinue: (claimedCorrect: boolean) => void;
}) {
  const winner = resolution.winnerId
    ? players.find((p) => p.id === resolution.winnerId)
    : null;

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/80 p-6 text-center">
      <GameCard card={resolution.card} />
      <p className="text-lg font-semibold">
        {resolution.card.title} — {resolution.card.artist} ({resolution.card.year})
      </p>
      <p
        className={
          resolution.activeCorrect ? "text-green-400" : "text-red-400"
        }
      >
        Platzierung des aktiven Spielers:{" "}
        {resolution.activeCorrect ? "richtig" : "falsch"}
      </p>
      {resolution.counters.map((c) => (
        <p key={c.playerId} className={c.correct ? "text-green-400" : "text-red-400"}>
          Konter {players.find((p) => p.id === c.playerId)?.name} (Slot {c.slot}):{" "}
          {c.correct ? "richtig" : "falsch"}
        </p>
      ))}
      <p className="font-bold">
        {winner ? `${winner.name} gewinnt die Karte!` : "Karte wird verworfen."}
      </p>

      <div className="mt-2 w-full max-w-sm space-y-2">
        <p className="text-sm text-neutral-300">
          Hat der aktive Spieler Titel & Interpret laut richtig genannt? (+1 Token)
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onContinue(true)}
            className="flex-1 rounded-lg bg-green-600 py-2"
          >
            Ja, +1 Token
          </button>
          <button
            type="button"
            onClick={() => onContinue(false)}
            className="flex-1 rounded-lg bg-neutral-700 py-2"
          >
            Nein
          </button>
        </div>
      </div>
    </div>
  );
}
