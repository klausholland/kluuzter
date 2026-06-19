import type { Card, Player } from "./types";

/**
 * Ein Slot i liegt zwischen timeline[i-1] und timeline[i].
 * Slot 0 = vor der ersten Karte, Slot timeline.length = nach der letzten.
 * Korrekt, wenn das Jahr in die Lücke passt (Gleichstand an Grenzen erlaubt).
 */
export function slotIsCorrect(
  timeline: Card[],
  slot: number,
  year: number,
): boolean {
  const lower = slot > 0 ? timeline[slot - 1].year : Number.NEGATIVE_INFINITY;
  const upper =
    slot < timeline.length ? timeline[slot].year : Number.POSITIVE_INFINITY;
  return lower <= year && year <= upper;
}

export function insertSorted(timeline: Card[], card: Card): Card[] {
  return [...timeline, card].sort((a, b) => a.year - b.year);
}

export function freeSlots(timelineLength: number, taken: number[]): number[] {
  const blocked = new Set(taken);
  const out: number[] = [];
  for (let i = 0; i <= timelineLength; i++) {
    if (!blocked.has(i)) out.push(i);
  }
  return out;
}

export function scoredCardCount(player: Player): number {
  return Math.max(0, player.timeline.length - 1);
}
