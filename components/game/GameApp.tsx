"use client";

import { useState } from "react";
import type { Card, GameInput } from "@/lib/engine/types";
import { SetupScreen } from "@/components/setup/SetupScreen";
import { DeckLoading } from "./DeckLoading";
import { GameScreen } from "./GameScreen";
import { buildGameInput, type SetupConfig } from "./game-setup";

type Scene =
  | { name: "setup" }
  | { name: "preparing"; config: SetupConfig }
  | { name: "game"; input: GameInput };

export function GameApp() {
  const [scene, setScene] = useState<Scene>({ name: "setup" });

  if (scene.name === "setup") {
    return (
      <SetupScreen
        onStart={(config) => setScene({ name: "preparing", config })}
      />
    );
  }

  if (scene.name === "preparing") {
    return (
      <DeckLoading
        config={scene.config}
        onReady={(deck: Card[]) =>
          setScene({ name: "game", input: buildGameInput(scene.config, deck) })
        }
        onCancel={() => setScene({ name: "setup" })}
      />
    );
  }

  return (
    <GameScreen
      input={scene.input}
      onRestart={() => setScene({ name: "setup" })}
    />
  );
}
