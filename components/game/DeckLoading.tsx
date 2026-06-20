"use client";

import { useEffect, useState } from "react";
import type { Card } from "@/lib/engine/types";
import type { SetupConfig } from "./game-setup";
import { Box, Stack, Typography, Button, Alert, CircularProgress } from "@mui/material";

export function DeckLoading({
  config,
  onReady,
  onCancel,
}: {
  config: SetupConfig;
  onReady: (deck: Card[]) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/deck", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playlistIds: config.playlistIds }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`deck ${res.status}`);
        const data = (await res.json()) as { deck: Card[] };
        if (active) onReady(data.deck);
      })
      .catch(() => active && setError("Deck konnte nicht vorbereitet werden."));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box
      component="main"
      sx={{
        display: "flex",
        minHeight: "100vh",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        p: 3,
        textAlign: "center",
      }}
    >
      {error ? (
        <Stack spacing={2} sx={{ alignItems: "center" }}>
          <Alert severity="error">{error}</Alert>
          <Button color="inherit" onClick={onCancel}>
            Zurück
          </Button>
        </Stack>
      ) : (
        <>
          <CircularProgress color="success" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Deck wird vorbereitet…
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Erscheinungsjahre werden über MusicBrainz angereichert. Das kann je nach
            Playlist-Größe einen Moment dauern.
          </Typography>
        </>
      )}
    </Box>
  );
}
