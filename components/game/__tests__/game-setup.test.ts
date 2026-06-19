import { describe, it, expect } from "vitest";
import { buildGameInput, minTracksNeeded } from "../game-setup";
import type { SetupConfig } from "../game-setup";
import type { Card } from "@/lib/engine/types";

const config: SetupConfig = {
  players: [
    { id: "1", name: "Anna" },
    { id: "2", name: "Ben" },
  ],
  mode: "targetCards",
  targetValue: 10,
  startTokens: 2,
  playlistIds: ["pl1"],
};

const deck: Card[] = [
  { id: "c1", uri: "spotify:track:c1", title: "x", artist: "y", year: 1990, yearSource: "musicbrainz", coverUrl: null },
];

describe("buildGameInput", () => {
  it("combines config and deck into a GameInput", () => {
    expect(buildGameInput(config, deck)).toEqual({
      players: config.players,
      mode: "targetCards",
      targetValue: 10,
      startTokens: 2,
      deck,
    });
  });
});

describe("minTracksNeeded", () => {
  it("accounts for anchors plus target cards times players", () => {
    // 2 Anker + 10 * 2 = 22
    expect(minTracksNeeded(config)).toBe(22);
  });
  it("accounts for anchors plus rounds times players in fixedRounds", () => {
    // 2 Anker + 5 Runden * 2 = 12
    expect(minTracksNeeded({ ...config, mode: "fixedRounds", targetValue: 5 })).toBe(12);
  });
});
