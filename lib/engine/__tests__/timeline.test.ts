import { describe, it, expect } from "vitest";
import {
  slotIsCorrect,
  insertSorted,
  freeSlots,
  scoredCardCount,
} from "../timeline";
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

// Timeline: [1970, 1985, 2000]; Slots: 0|1970|1|1985|2|2000|3
const tl = [card("a", 1970), card("b", 1985), card("c", 2000)];

describe("slotIsCorrect", () => {
  it("accepts a year inside the chosen gap", () => {
    expect(slotIsCorrect(tl, 1, 1979)).toBe(true); // zwischen 1970 und 1985
  });
  it("rejects a year outside the chosen gap", () => {
    expect(slotIsCorrect(tl, 1, 1990)).toBe(false);
  });
  it("accepts placement before the first card (slot 0)", () => {
    expect(slotIsCorrect(tl, 0, 1965)).toBe(true);
  });
  it("rejects slot 0 when year is too high", () => {
    expect(slotIsCorrect(tl, 0, 1972)).toBe(false);
  });
  it("accepts placement after the last card (slot length)", () => {
    expect(slotIsCorrect(tl, 3, 2010)).toBe(true);
  });
  it("treats a year equal to a boundary as correct on the adjacent slot", () => {
    expect(slotIsCorrect(tl, 1, 1985)).toBe(true);
    expect(slotIsCorrect(tl, 2, 1985)).toBe(true);
  });
  it("works for an empty timeline (only slot 0)", () => {
    expect(slotIsCorrect([], 0, 1999)).toBe(true);
  });
});

describe("insertSorted", () => {
  it("inserts into the correct chronological position", () => {
    const out = insertSorted(tl, card("x", 1990));
    expect(out.map((c) => c.year)).toEqual([1970, 1985, 1990, 2000]);
  });
  it("does not mutate the input array", () => {
    const before = [...tl];
    insertSorted(tl, card("x", 1990));
    expect(tl).toEqual(before);
  });
});

describe("freeSlots", () => {
  it("returns all slots minus taken ones", () => {
    // Timeline-Länge 3 → Slots 0..3; belegt: 1
    expect(freeSlots(3, [1])).toEqual([0, 2, 3]);
  });
  it("ignores invalid/negative taken markers", () => {
    expect(freeSlots(2, [-1])).toEqual([0, 1, 2]);
  });
});

describe("scoredCardCount", () => {
  it("excludes the anchor card", () => {
    const p: Player = { id: "p", name: "P", tokens: 2, timeline: tl };
    expect(scoredCardCount(p)).toBe(2); // 3 Karten - 1 Anker
  });
  it("is 0 for a player with only the anchor", () => {
    const p: Player = { id: "p", name: "P", tokens: 2, timeline: [card("a", 1970)] };
    expect(scoredCardCount(p)).toBe(0);
  });
});
