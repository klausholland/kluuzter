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
  const activeName =
    players.find((p) => p.id === activePlayerId)?.name ?? "Spieler";
  const correct = resolution.activeCorrect;

  return (
    <div
      className={`fixed inset-0 z-20 flex flex-col items-center justify-center gap-4 p-6 text-center ${
        correct ? "bg-green-950/90" : "bg-red-950/90"
      }`}
    >
      {/* Großes, partytaugliches Richtig/Falsch-Banner */}
      <div
        data-testid="verdict-banner"
        className={`w-full max-w-md rounded-2xl px-6 py-4 shadow-2xl ${
          correct ? "bg-green-600" : "bg-red-600"
        }`}
      >
        <p className="text-4xl font-black tracking-wide text-white">
          {correct ? "✓ RICHTIG!" : "✗ DANEBEN!"}
        </p>
        <p className="mt-1 text-sm text-white/90">
          {activeName} hat {correct ? "richtig" : "falsch"} eingeordnet
        </p>
      </div>

      <GameCard card={resolution.card} />
      <p className="text-lg font-semibold">
        {resolution.card.title} — {resolution.card.artist} ({resolution.card.year})
      </p>

      {resolution.counters.length > 0 && (
        <div className="space-y-1">
          {resolution.counters.map((c) => (
            <p
              key={c.playerId}
              className={c.correct ? "text-green-300" : "text-red-300"}
            >
              Konter {players.find((p) => p.id === c.playerId)?.name} (Slot {c.slot}):{" "}
              {c.correct ? "richtig" : "falsch"}
            </p>
          ))}
        </div>
      )}

      <p className="text-xl font-bold">
        {winner ? `🎉 ${winner.name} gewinnt die Karte!` : "Karte wird verworfen."}
      </p>

      <div className="mt-2 w-full max-w-sm space-y-2">
        <p className="text-sm text-white/80">
          Hat {activeName} Titel & Interpret laut richtig genannt? (+1 Token)
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onContinue(true)}
            className="flex-1 rounded-lg bg-green-600 py-2 font-semibold"
          >
            Ja, +1 Token
          </button>
          <button
            type="button"
            onClick={() => onContinue(false)}
            className="flex-1 rounded-lg bg-neutral-700 py-2 font-semibold"
          >
            Nein, weiter
          </button>
        </div>
      </div>
    </div>
  );
}
