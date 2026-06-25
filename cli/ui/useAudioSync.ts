import { useEffect, useRef } from "react";
import type { AudioController } from "@/cli/audio/controller";
import type { Phase } from "@/lib/engine/useGameEngine";
import type { Card } from "@/lib/engine/types";

export function useAudioSync(controller: AudioController, phase: Phase, currentCard: Card | null): void {
  const lastPlayed = useRef<string | null>(null);
  useEffect(() => {
    if (phase === "playing" && currentCard && lastPlayed.current !== currentCard.id) {
      lastPlayed.current = currentCard.id;
      void controller.play(currentCard.uri).catch(() => { /* surfaced elsewhere */ });
    }
    if (phase === "reveal") {
      void controller.pause().catch(() => { /* ignore */ });
    }
  }, [phase, currentCard, controller]);
}
