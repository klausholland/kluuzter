import type { Card, CounterPlacement, Player, Resolution } from "./types";
import { insertSorted, slotIsCorrect } from "./timeline";

export function evaluateTurn(
  activeTimeline: Card[],
  activeSlot: number,
  counters: CounterPlacement[],
  card: Card,
  activePlayerId: string,
): Resolution {
  const activeCorrect = slotIsCorrect(activeTimeline, activeSlot, card.year);

  const evaluatedCounters = counters.map((c) => ({
    playerId: c.playerId,
    slot: c.slot,
    correct: slotIsCorrect(activeTimeline, c.slot, card.year),
  }));

  let winnerId: string | null = null;
  if (activeCorrect) {
    winnerId = activePlayerId;
  } else {
    const firstCorrect = evaluatedCounters.find((c) => c.correct);
    winnerId = firstCorrect ? firstCorrect.playerId : null;
  }

  return {
    card,
    activePlayerId,
    activeSlot,
    activeCorrect,
    counters: evaluatedCounters,
    winnerId,
  };
}

export function applyResolution(
  players: Player[],
  resolution: Resolution,
): Player[] {
  if (!resolution.winnerId) return players;
  return players.map((p) =>
    p.id === resolution.winnerId
      ? { ...p, timeline: insertSorted(p.timeline, resolution.card) }
      : p,
  );
}
