"use client";

import { useEffect, useState } from "react";
import type { Card } from "@/lib/engine/types";
import type { SetupConfig } from "./game-setup";

export function DeckLoading({
  config,
  onReady,
  onCancel,
}: {
  config: SetupConfig;
  onReady: (deck: Card[]) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/deck", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playlistIds: config.playlistIds }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`deck ${res.status}`);
        const data = (await res.json()) as { deck: Card[] };
        if (active) onReady(data.deck);
      })
      .catch(() => active && setError("Deck konnte nicht vorbereitet werden."));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      {error ? (
        <>
          <p className="text-red-400">{error}</p>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-neutral-700 px-4 py-2"
          >
            Zurück
          </button>
        </>
      ) : (
        <>
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-neutral-600 border-t-green-500" />
          <p className="text-lg font-semibold">Deck wird vorbereitet…</p>
          <p className="text-sm text-neutral-400">
            Erscheinungsjahre werden über MusicBrainz angereichert. Das kann je nach
            Playlist-Größe einen Moment dauern.
          </p>
        </>
      )}
    </main>
  );
}
