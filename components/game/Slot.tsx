export function Slot({
  index,
  selected,
  disabled = false,
  onSelect,
  label = "+",
}: {
  index: number;
  selected: boolean;
  disabled?: boolean;
  onSelect: (index: number) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={`Slot ${index}`}
      disabled={disabled}
      onClick={() => onSelect(index)}
      className={`flex h-28 min-w-[44px] shrink-0 items-center justify-center rounded-lg border-2 border-dashed text-xl transition sm:h-32 ${
        selected
          ? "border-green-400 bg-green-400/20 text-green-300"
          : "border-neutral-600 text-neutral-500"
      } disabled:opacity-25`}
    >
      {label}
    </button>
  );
}
