"use client";

import { useEffect } from "react";
import type { Card } from "@/lib/engine/types";

export function CardDetail({
  card,
  onClose,
}: {
  card: Card;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${card.artist} – ${card.title}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-3 rounded-2xl bg-neutral-900 p-6 text-center ring-1 ring-white/10"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="ml-auto block text-neutral-400 hover:text-white"
        >
          ✕
        </button>
        {card.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.coverUrl}
            alt=""
            className="mx-auto h-40 w-40 rounded-lg object-cover"
          />
        )}
        <p className="text-xl font-bold text-white">{card.artist}</p>
        <p className="text-base text-neutral-200">{card.title}</p>
        <p className="text-3xl font-black text-white">{card.year}</p>
        {card.yearSource === "spotify" && (
          <p className="text-sm text-amber-300">≈ Jahr ungenau (Spotify-Quelle)</p>
        )}
      </div>
    </div>
  );
}
