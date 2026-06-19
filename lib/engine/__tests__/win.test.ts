import { describe, it, expect } from "vitest";
import { isGameOver, determineWinner } from "../win";
import type { Card, GameContext, Player } from "../types";

function card(id: string, year: number): Card {
  return {
    id,
    uri: `spotify:track:${id}`,
    title: id,
    artist: id,
    year,
    yearSource: "musicbrainz",
    coverUrl: null,
  };
}

// erstellt einen Spieler mit `scored` gewerteten Karten (+ 1 Anker)
function player(id: string, scored: number, tokens: number): Player {
  const timeline: Card[] = [card(`${id}-anchor`, 1900)];
  for (let i = 0; i < scored; i++) timeline.push(card(`${id}-${i}`, 1950 + i));
  return { id, name: id, tokens, timeline };
}

function ctx(partial: Partial<GameContext>): GameContext {
  return {
    mode: "targetCards",
    targetValue: 3,
    players: [],
    turnOrder: [],
    activeIndex: 0,
    deck: [card("d", 1999)],
    currentCard: null,
    placement: null,
    counters: [],
    pendingCounterIds: [],
    resolution: null,
    roundsCompleted: 0,
    turnsThisRound: 0,
    winnerId: null,
    ...partial,
  };
}

describe("isGameOver — targetCards", () => {
  it("is true when a player reached the card target", () => {
    const c = ctx({
      mode: "targetCards",
      targetValue: 3,
      players: [player("A", 3, 1), player("B", 1, 2)],
      turnOrder: ["A", "B"],
    });
    expect(isGameOver(c)).toBe(true);
  });
  it("is false when nobody reached the target and deck has cards", () => {
    const c = ctx({
      mode: "targetCards",
      targetValue: 3,
      players: [player("A", 2, 1), player("B", 1, 2)],
      turnOrder: ["A", "B"],
    });
    expect(isGameOver(c)).toBe(false);
  });
});

describe("isGameOver — fixedRounds", () => {
  it("is true once the configured rounds are completed", () => {
    const c = ctx({
      mode: "fixedRounds",
      targetValue: 5,
      roundsCompleted: 5,
      players: [player("A", 1, 1)],
      turnOrder: ["A"],
    });
    expect(isGameOver(c)).toBe(true);
  });
  it("is false before the rounds are completed", () => {
    const c = ctx({
      mode: "fixedRounds",
      targetValue: 5,
      roundsCompleted: 4,
      players: [player("A", 1, 1)],
      turnOrder: ["A"],
    });
    expect(isGameOver(c)).toBe(false);
  });
});

describe("isGameOver — empty deck", () => {
  it("is true when the draw pile is empty", () => {
    const c = ctx({
      mode: "fixedRounds",
      targetValue: 99,
      deck: [],
      players: [player("A", 1, 1)],
      turnOrder: ["A"],
    });
    expect(isGameOver(c)).toBe(true);
  });
});

describe("determineWinner", () => {
  it("picks the player with the most scored cards", () => {
    const c = ctx({
      players: [player("A", 1, 0), player("B", 3, 0)],
      turnOrder: ["A", "B"],
    });
    expect(determineWinner(c)).toBe("B");
  });
  it("breaks card ties by remaining tokens", () => {
    const c = ctx({
      players: [player("A", 2, 1), player("B", 2, 3)],
      turnOrder: ["A", "B"],
    });
    expect(determineWinner(c)).toBe("B");
  });
  it("breaks card+token ties by turn order", () => {
    const c = ctx({
      players: [player("A", 2, 2), player("B", 2, 2)],
      turnOrder: ["A", "B"],
    });
    expect(determineWinner(c)).toBe("A");
  });
  it("returns null when there are no players", () => {
    expect(determineWinner(ctx({ players: [], turnOrder: [] }))).toBeNull();
  });
});
