import type { Card } from "@/lib/engine/types";

export function GameCard({
  card,
  hideYear = false,
}: {
  card: Card;
  hideYear?: boolean;
}) {
  return (
    <div className="flex aspect-[3/4] w-24 shrink-0 flex-col justify-between rounded-xl bg-gradient-to-br from-fuchsia-600 to-indigo-700 p-2 text-center shadow-lg sm:w-28">
      <p className="truncate text-[11px] font-semibold text-white/90">
        {card.artist}
      </p>
      <p className="text-3xl font-black text-white">
        {hideYear ? "?" : card.year}
      </p>
      <div>
        <p className="truncate text-[11px] text-white/90">{card.title}</p>
        {!hideYear && card.yearSource === "spotify" && (
          <p className="text-[9px] text-amber-200">≈ ungenau</p>
        )}
      </div>
    </div>
  );
}
