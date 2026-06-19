import { describe, it, expect } from "vitest";
import { evaluateTurn, applyResolution } from "../evaluate";
import type { Card, Player } from "../types";

function card(id: string, year: number): Card {
  return {
    id,
    uri: `spotify:track:${id}`,
    title: `t${id}`,
    artist: `a${id}`,
    year,
    yearSource: "musicbrainz",
    coverUrl: null,
  };
}

// A's Timeline: [1970, 2000]; Slots 0|1970|1|2000|2
const aTimeline = [card("a1", 1970), card("a2", 2000)];
const mystery = card("m", 1985); // gehört in Slot 1

describe("evaluateTurn", () => {
  it("active player correct → active wins", () => {
    const r = evaluateTurn(aTimeline, 1, [], mystery, "A");
    expect(r.activeCorrect).toBe(true);
    expect(r.winnerId).toBe("A");
    expect(r.counters).toEqual([]);
  });

  it("active wrong, no counters → discarded", () => {
    const r = evaluateTurn(aTimeline, 0, [], mystery, "A");
    expect(r.activeCorrect).toBe(false);
    expect(r.winnerId).toBeNull();
  });

  it("active wrong, a counter correct → counterer wins", () => {
    const r = evaluateTurn(
      aTimeline,
      0,
      [{ playerId: "B", slot: 1 }],
      mystery,
      "A",
    );
    expect(r.activeCorrect).toBe(false);
    expect(r.counters[0]).toEqual({ playerId: "B", slot: 1, correct: true });
    expect(r.winnerId).toBe("B");
  });

  it("active wrong, multiple counters: first correct in order wins", () => {
    const r = evaluateTurn(
      aTimeline,
      0,
      [
        { playerId: "B", slot: 2 }, // falsch (1985 < 2000)
        { playerId: "C", slot: 1 }, // korrekt
      ],
      mystery,
      "A",
    );
    expect(r.winnerId).toBe("C");
  });

  it("active correct takes precedence over a correct counter", () => {
    const r = evaluateTurn(
      aTimeline,
      1,
      [{ playerId: "B", slot: 1 }],
      mystery,
      "A",
    );
    expect(r.winnerId).toBe("A");
  });

  it("all slots wrong → discarded", () => {
    const r = evaluateTurn(
      aTimeline,
      0,
      [{ playerId: "B", slot: 2 }],
      mystery,
      "A",
    );
    expect(r.winnerId).toBeNull();
  });
});

describe("applyResolution", () => {
  const players: Player[] = [
    { id: "A", name: "A", tokens: 2, timeline: [...aTimeline] },
    { id: "B", name: "B", tokens: 2, timeline: [card("b1", 1990)] },
  ];

  it("adds the card to the winner's timeline, sorted", () => {
    const r = evaluateTurn(aTimeline, 0, [{ playerId: "B", slot: 1 }], mystery, "A");
    const next = applyResolution(players, r);
    const b = next.find((p) => p.id === "B")!;
    expect(b.timeline.map((c) => c.year)).toEqual([1985, 1990]);
  });

  it("leaves timelines unchanged when discarded", () => {
    const r = evaluateTurn(aTimeline, 0, [], mystery, "A");
    const next = applyResolution(players, r);
    expect(next).toEqual(players);
  });

  it("does not mutate the input players", () => {
    const r = evaluateTurn(aTimeline, 1, [], mystery, "A");
    const snapshot = JSON.parse(JSON.stringify(players));
    applyResolution(players, r);
    expect(players).toEqual(snapshot);
  });
});
