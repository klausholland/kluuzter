"use client";

import { useMachine } from "@xstate/react";
import { gameMachine } from "./machine";
import type { GameInput } from "./types";

export type Phase =
  | "dealing"
  | "playing"
  | "countering"
  | "reveal"
  | "betweenTurns"
  | "drawNext"
  | "gameOver";

export function useGameEngine(input: GameInput) {
  const [snapshot, send] = useMachine(gameMachine, { input });
  return {
    snapshot,
    send,
    context: snapshot.context,
    phase: snapshot.value as Phase,
  };
}
