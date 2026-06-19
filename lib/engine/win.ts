import type { GameContext } from "./types";
import { scoredCardCount } from "./timeline";

export function isGameOver(context: GameContext): boolean {
  if (context.mode === "targetCards") {
    const reached = context.players.some(
      (p) => scoredCardCount(p) >= context.targetValue,
    );
    if (reached) return true;
  } else {
    if (context.roundsCompleted >= context.targetValue) return true;
  }
  return context.deck.length === 0;
}

export function determineWinner(context: GameContext): string | null {
  if (context.players.length === 0) return null;
  const orderIndex = (id: string) => context.turnOrder.indexOf(id);
  const ranked = [...context.players].sort((a, b) => {
    const cards = scoredCardCount(b) - scoredCardCount(a);
    if (cards !== 0) return cards;
    if (b.tokens !== a.tokens) return b.tokens - a.tokens;
    return orderIndex(a.id) - orderIndex(b.id);
  });
  return ranked[0].id;
}
