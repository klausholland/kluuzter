import { describe, it, expect } from "vitest";
import { activePlayer, currentCountererId, availableSlots } from "../selectors";
import type { Card, GameContext, Player } from "../types";

function card(id: string, year: number): Card {
  return { id, uri: `spotify:track:${id}`, title: id, artist: id, year, yearSource: "musicbrainz", coverUrl: null };
}
function player(id: string, years: number[]): Player {
  return { id, name: id, tokens: 2, timeline: years.map((y, i) => card(`${id}-${i}`, y)) };
}
function ctx(p: Partial<GameContext>): GameContext {
  return {
    mode: "targetCards", targetValue: 10,
    players: [], turnOrder: [], activeIndex: 0,
    deck: [], currentCard: null, placement: null, counters: [],
    pendingCounterIds: [], resolution: null,
    roundsCompleted: 0, turnsThisRound: 0, winnerId: null, ...p,
  };
}

describe("activePlayer", () => {
  it("returns the player at activeIndex", () => {
    const c = ctx({ players: [player("A", [1980]), player("B", [1990])], turnOrder: ["A", "B"], activeIndex: 1 });
    expect(activePlayer(c).id).toBe("B");
  });
});

describe("currentCountererId", () => {
  it("returns the head of the counter queue, or null", () => {
    expect(currentCountererId(ctx({ pendingCounterIds: ["B", "C"] }))).toBe("B");
    expect(currentCountererId(ctx({ pendingCounterIds: [] }))).toBeNull();
  });
});

describe("availableSlots", () => {
  it("lists all slots of the active timeline minus taken ones", () => {
    const c = ctx({
      players: [player("A", [1980, 2000])], // Timeline-Länge 2 → Slots 0..2
      turnOrder: ["A"],
      activeIndex: 0,
      placement: { playerId: "A", slot: 1 },
    });
    expect(availableSlots(c)).toEqual([0, 2]);
  });
});
