"use client";

import type { Player } from "@/lib/engine/types";
import { scoredCardCount } from "@/lib/engine/timeline";
import { Button, Container, List, ListItem, Stack, Typography } from "@mui/material";

export function GameOverScreen({
  players,
  winnerId,
  onRestart,
}: {
  players: Player[];
  winnerId: string | null;
  onRestart: () => void;
}) {
  const ranked = [...players].sort(
    (a, b) => scoredCardCount(b) - scoredCardCount(a) || b.tokens - a.tokens,
  );
  return (
    <Container component="main" maxWidth="sm" sx={{ py: 6, textAlign: "center" }}>
      <Stack spacing={2}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Spiel beendet
        </Typography>
        <List sx={{ p: 0 }}>
          <Stack spacing={1}>
            {ranked.map((p) => (
              <ListItem
                key={p.id}
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                  bgcolor: p.id === winnerId ? "rgba(34, 197, 94, 0.3)" : "background.paper",
                  ...(p.id === winnerId && {
                    boxShadow: (theme) => `inset 0 0 0 1px ${theme.palette.success.light}`,
                  }),
                }}
              >
                <Typography sx={{ fontWeight: 600 }}>
                  {p.id === winnerId ? "🏆 " : ""}
                  {p.name}
                </Typography>
                <Typography>
                  {scoredCardCount(p)} Karten · {p.tokens} Token
                </Typography>
              </ListItem>
            ))}
          </Stack>
        </List>
        <Button onClick={onRestart} fullWidth size="large">
          Neue Runde
        </Button>
      </Stack>
    </Container>
  );
}
