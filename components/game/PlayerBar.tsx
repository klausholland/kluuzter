import type { Player } from "@/lib/engine/types";
import { scoredCardCount } from "@/lib/engine/timeline";
import { Chip, Stack } from "@mui/material";

export function PlayerBar({
  players,
  activeIndex,
}: {
  players: Player[];
  activeIndex: number;
}) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ overflowX: "auto", borderBottom: 1, borderColor: "divider", px: 1.5, py: 1 }}
    >
      {players.map((p, i) => (
        <Chip
          key={p.id}
          color={i === activeIndex ? "success" : undefined}
          variant={i === activeIndex ? "filled" : "outlined"}
          sx={{ flexShrink: 0, height: "auto", py: 0.5, "& .MuiChip-label": { display: "block" } }}
          label={
            <Stack sx={{ alignItems: "flex-start" }}>
              <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{p.name}</span>
              <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                {scoredCardCount(p)} Karten · {p.tokens} Token
              </span>
            </Stack>
          }
        />
      ))}
    </Stack>
  );
}
