import type { GameContext, Player } from "./types";
import { freeSlots } from "./timeline";

export function activePlayer(context: GameContext): Player {
  return context.players[context.activeIndex];
}

export function currentCountererId(context: GameContext): string | null {
  return context.pendingCounterIds[0] ?? null;
}

/** Freie Slots in der Timeline des aktiven Spielers (für Platzierung/Konter). */
export function availableSlots(context: GameContext): number[] {
  const active = activePlayer(context);
  const taken = [
    context.placement?.slot ?? -1,
    ...context.counters.map((c) => c.slot),
  ];
  return freeSlots(active.timeline.length, taken);
}
