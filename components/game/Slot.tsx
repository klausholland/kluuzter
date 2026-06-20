"use client";

import { useState } from "react";
import { Button } from "@mui/material";

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
    <Button
      aria-label={`Slot ${index}`}
      disabled={disabled}
      onClick={() => onSelect(index)}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragOver(false);
        onSelect(index);
      }}
      sx={{
        height: { xs: 112, sm: 128 },
        minWidth: 44,
        flexShrink: 0,
        fontSize: 20,
        borderRadius: 2,
        border: "2px dashed",
        borderColor: highlighted ? "success.light" : "grey.700",
        bgcolor: highlighted ? "success.main" : "transparent",
        color: highlighted ? "success.contrastText" : "grey.500",
        opacity: disabled ? 0.25 : 1,
        "&:hover": { bgcolor: highlighted ? "success.main" : "action.hover" },
        "&.Mui-disabled": { opacity: 0.25 },
      }}
    >
      {label}
    </Button>
  );
}
