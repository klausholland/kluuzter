"use client";

import type { Card } from "@/lib/engine/types";
import { Dialog, DialogContent, IconButton, Box, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export function CardDetail({ card, onClose }: { card: Card; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} aria-label={`${card.artist} – ${card.title}`} maxWidth="xs" fullWidth>
      <DialogContent sx={{ textAlign: "center", position: "relative", pt: 5 }}>
        <IconButton aria-label="Schließen" onClick={onClose} sx={{ position: "absolute", top: 8, right: 8 }}>
          <CloseIcon />
        </IconButton>
        {card.coverUrl && (
          <Box component="img" src={card.coverUrl} alt="" sx={{ width: 160, height: 160, borderRadius: 2, objectFit: "cover", mx: "auto", mb: 2 }} />
        )}
        <Typography variant="h6" sx={{ fontWeight: 700 }}>{card.artist}</Typography>
        <Typography sx={{ color: "text.secondary" }}>{card.title}</Typography>
        <Typography sx={{ fontSize: 32, fontWeight: 900, mt: 1 }}>{card.year}</Typography>
        {card.yearSource === "spotify" && (
          <Typography sx={{ color: "warning.light", mt: 1 }}>≈ Jahr ungenau (Spotify-Quelle)</Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}
