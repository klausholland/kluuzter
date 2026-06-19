import type { Card, GameInput, GameMode } from "@/lib/engine/types";

export type SetupConfig = {
  players: { id: string; name: string }[];
  mode: GameMode;
  targetValue: number;
  startTokens: number;
  playlistIds: string[];
};

export function buildGameInput(config: SetupConfig, deck: Card[]): GameInput {
  return {
    players: config.players,
    mode: config.mode,
    targetValue: config.targetValue,
    startTokens: config.startTokens,
    deck,
  };
}

/** Konservative Mindestanzahl an Tracks: 1 Anker je Spieler + 1 Mystery-Karte je Zug. */
export function minTracksNeeded(config: SetupConfig): number {
  const anchors = config.players.length;
  return anchors + config.targetValue * config.players.length;
}
