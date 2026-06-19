import type { Player } from "@/lib/engine/types";

export function CounterOverlay({
  counterer,
  availableSlots,
  onCounter,
  onPass,
}: {
  counterer: Player;
  availableSlots: number[];
  onCounter: (slot: number) => void;
  onPass: () => void;
}) {
  const canCounter = counterer.tokens >= 1 && availableSlots.length > 0;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 space-y-3 rounded-t-2xl bg-neutral-800 p-4 shadow-2xl">
      <p className="text-center font-semibold">
        {counterer.name}: Kontern? ({counterer.tokens} Token)
      </p>
      {canCounter ? (
        <>
          <p className="text-center text-sm text-neutral-300">
            1 Token einsetzen und einen freien Slot in der Timeline wählen:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {availableSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => onCounter(slot)}
                className="min-w-[44px] rounded-lg bg-fuchsia-600 px-3 py-2"
              >
                Slot {slot}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-center text-sm text-neutral-400">
          Kein Token oder kein freier Slot — Konter nicht möglich.
        </p>
      )}
      <button
        type="button"
        onClick={onPass}
        className="w-full rounded-lg bg-neutral-700 py-2"
      >
        Passen
      </button>
    </div>
  );
}
