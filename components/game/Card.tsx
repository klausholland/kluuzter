import type { Card } from "@/lib/engine/types";
import { Box, Paper, Typography } from "@mui/material";
import { gradients } from "@/lib/theme";

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
  const base = {
    width: { xs: 96, sm: 112 },
    aspectRatio: "3 / 4",
    flexShrink: 0,
    borderRadius: 3,
    p: 1,
    display: "flex",
    flexDirection: "column",
    textAlign: "center",
  } as const;

  if (faceDown) {
    return (
      <Paper
        elevation={6}
        draggable={draggable}
        onDragStart={onDragStart}
        sx={{
          ...base,
          alignItems: "center",
          justifyContent: "center",
          background: gradients.mystery,
          cursor: draggable ? "grab" : "default",
          "&:active": { cursor: draggable ? "grabbing" : "default" },
        }}
      >
        <Typography sx={{ fontSize: 40, fontWeight: 900, color: "#fff" }}>
          ?
        </Typography>
        <Typography
          sx={{ mt: 0.5, fontSize: 10, letterSpacing: 1, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}
        >
          Mystery-Song
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={8}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={onClick ? `Details: ${card.artist} – ${card.title}` : undefined}
      sx={{
        ...base,
        justifyContent: "space-between",
        background: gradients.cardFront,
        cursor: onClick ? "pointer" : "default",
        transition: "transform 120ms ease",
        "&:hover": onClick ? { transform: "translateY(-2px)" } : undefined,
      }}
    >
      <Typography noWrap sx={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
        {card.artist}
      </Typography>
      <Typography sx={{ fontSize: 28, fontWeight: 900, color: "#fff" }}>
        {card.year}
      </Typography>
      <Box>
        <Typography noWrap sx={{ fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
          {card.title}
        </Typography>
        {card.yearSource === "spotify" && (
          <Typography sx={{ fontSize: 9, color: "#fde68a" }}>≈ ungenau</Typography>
        )}
      </Box>
    </Paper>
  );
}
