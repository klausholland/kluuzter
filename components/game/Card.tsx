import type { Card } from "@/lib/engine/types";

export function GameCard({
  card,
  faceDown = false,
  draggable = false,
  onDragStart,
  onClick,
}: {
  card: Card;
  /** Verdeckte Mystery-Karte: Interpret, Jahr und Titel bleiben verborgen. */
  faceDown?: boolean;
  /** Macht die Karte per HTML5-DnD ziehbar (z. B. die Mystery-Karte). */
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  /** Öffnet die Detailansicht (nur für aufgedeckte Karten). */
  onClick?: () => void;
}) {
  if (faceDown) {
    return (
      <div
        draggable={draggable}
        onDragStart={onDragStart}
        className={`flex aspect-[3/4] w-24 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-neutral-700 to-neutral-900 p-2 text-center shadow-lg ring-2 ring-white/10 sm:w-28 ${
          draggable ? "cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        <p className="text-4xl font-black text-white">?</p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-white/60">
          Mystery-Song
        </p>
      </div>
    );
  }

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={onClick ? `Details: ${card.artist} – ${card.title}` : undefined}
      className={`flex aspect-[3/4] w-24 shrink-0 flex-col justify-between rounded-xl bg-gradient-to-br from-fuchsia-600 to-indigo-700 p-2 text-center shadow-lg sm:w-28 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <p className="truncate text-[11px] font-semibold text-white/90">
        {card.artist}
      </p>
      <p className="text-3xl font-black text-white">{card.year}</p>
      <div>
        <p className="truncate text-[11px] text-white/90">{card.title}</p>
        {card.yearSource === "spotify" && (
          <p className="text-[9px] text-amber-200">≈ ungenau</p>
        )}
      </div>
    </div>
  );
}
