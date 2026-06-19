"use client";

import { useState } from "react";

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
  const [dragOver, setDragOver] = useState(false);
  const highlighted = selected || dragOver;

  return (
    <button
      type="button"
      aria-label={`Slot ${index}`}
      disabled={disabled}
      onClick={() => onSelect(index)}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault(); // erlaubt den Drop
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragOver(false);
        onSelect(index);
      }}
      className={`flex h-28 min-w-[44px] shrink-0 items-center justify-center rounded-lg border-2 border-dashed text-xl transition sm:h-32 ${
        highlighted
          ? "border-green-400 bg-green-400/20 text-green-300"
          : "border-neutral-600 text-neutral-500"
      } disabled:opacity-25`}
    >
      {label}
    </button>
  );
}
