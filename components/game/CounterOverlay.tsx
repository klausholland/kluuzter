"use client";

import type { Player } from "@/lib/engine/types";
import { Button, Paper, Stack, Typography } from "@mui/material";

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
    <Paper
      elevation={8}
      square
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (theme) => theme.zIndex.modal,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        p: 2,
      }}
    >
      <Stack spacing={1.5}>
        <Typography sx={{ textAlign: "center", fontWeight: 600 }}>
          {counterer.name}: Kontern? ({counterer.tokens} Token)
        </Typography>
        {canCounter ? (
          <>
            <Typography sx={{ textAlign: "center", fontSize: 14, color: "text.secondary" }}>
              1 Token einsetzen und einen freien Slot in der Timeline wählen:
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", justifyContent: "center" }}>
              {availableSlots.map((slot) => (
                <Button
                  key={slot}
                  onClick={() => onCounter(slot)}
                  color="secondary"
                  sx={{ minWidth: 44 }}
                >
                  Slot {slot}
                </Button>
              ))}
            </Stack>
          </>
        ) : (
          <Typography sx={{ textAlign: "center", fontSize: 14, color: "text.disabled" }}>
            Kein Token oder kein freier Slot — Konter nicht möglich.
          </Typography>
        )}
        <Button onClick={onPass} color="inherit" fullWidth>
          Passen
        </Button>
      </Stack>
    </Paper>
  );
}
