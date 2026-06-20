# Material UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the whole UI from Tailwind v4 to Material UI with a dark, playful ("party") theme, keeping all screens, flows, game logic and the XState machine unchanged.

**Architecture:** Add MUI + Emotion + a custom dark theme and wrap the App Router in `AppRouterCacheProvider → ThemeProvider → CssBaseline` (Task 1, Tailwind still present). Migrate components group-by-group, replacing Tailwind `className` styling with MUI components/`sx` while **preserving every accessible name, role, `data-testid`, and DnD behaviour the test suite depends on**. Remove Tailwind entirely in the final task once nothing uses it.

**Tech Stack:** Next.js 16 (App Router), React 19, MUI v6/v7 (`@mui/material`, `@mui/icons-material`, `@mui/material-nextjs`), Emotion, Vitest 4 + @testing-library/react.

## Global Constraints

- Tests and `tsc` MUST run under **Node 22**: prefix every command with `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null &&`. Default Node v20.12.2 crashes vitest/rolldown at startup.
- The existing test suite (163 tests) MUST stay green. Preserve these exact, test-relied accessible hooks (verbatim):
  - `aria-label="Slot ${index}"` on each slot (e.g. `Slot 1`); `disabled` state on disabled slots.
  - Clickable revealed card: `aria-label="Details: ${card.artist} – ${card.title}"` (en-dash `–`); face-down card shows `?` and the text `Mystery-Song`, hides artist/title/year, has **no** onClick.
  - Card shows artist, title, year as text; `spotify` year shows text matching `/ungenau/` (keep `≈`).
  - `ConfirmDialog` / `CardDetail`: reachable as `getByRole("dialog")`; close on close-button (`CardDetail` close button `aria-label="Schließen"`), backdrop, and Escape; button text labels unchanged (`Spiel beenden`, `Weiterspielen`, etc.).
  - `RevealOverlay`: keep `data-testid="verdict-banner"`; banner text matches `/richtig/i` or `/falsch|daneben/i`; song title/artist/year visible; confirm button name matches `/\+1 Token/i`.
  - `PlaylistPicker`: status text matches `/2\s*\/\s*5 indiziert/i` and `/indiziert ✓/i`; index button accessible name matches `/^indizieren$/i`; re-index button matches `/neu indizieren/i`.
  - `SetupScreen` remove-player button keeps `aria-label="Spieler entfernen"`.
- Component tests start with `// @vitest-environment jsdom` and use `@testing-library/react`.
- Do NOT change game logic, selectors, the engine, or `lib/engine/machine.ts`. Migration changes markup/styling only; component props/signatures stay the same unless this plan says otherwise.
- UI copy stays German.
- Work on branch `feat/mui-redesign` (already created off `main`).
- The Spotify player-lifecycle fixes live only on `feat/reindex` and are out of scope here.
- Styling values (exact colours/spacing) follow the theme and are at the implementer's discretion **within the theme**; the binding deliverable per component is: themed with MUI, preserved test hooks, `tsc` clean, suite green.

---

## File Structure

- Create: `lib/theme.ts` — the dark "party" MUI theme + exported gradient tokens.
- Create: `app/ThemeRegistry.tsx` — client component wrapping `AppRouterCacheProvider`, `ThemeProvider`, `CssBaseline`.
- Modify: `app/layout.tsx` — Inter font + wrap children in `ThemeRegistry`.
- Modify: `app/globals.css` — (final task) drop Tailwind import.
- Modify: `postcss.config.mjs`, `package.json` — (final task) remove Tailwind.
- Modify (migrations): `components/game/Card.tsx`, `Slot.tsx`, `Timeline.tsx`, `PlayerBar.tsx`, `PlaybackControls.tsx`, `ConfirmDialog.tsx`, `CardDetail.tsx`, `RevealOverlay.tsx`, `CounterOverlay.tsx`, `GameOverScreen.tsx`, `GameScreen.tsx`, `DeckLoading.tsx`, `components/setup/SetupScreen.tsx`, `components/setup/PlaylistPicker.tsx`, `app/page.tsx`, `app/login/page.tsx`.
- Touch tests only where MUI changes the interaction contract (dialogs): `components/game/__tests__/ConfirmDialog.test.tsx`, `CardDetail.test.tsx`.

---

## Task 1: MUI infrastructure + theme (Tailwind kept)

**Files:**
- Create: `lib/theme.ts`
- Create: `app/ThemeRegistry.tsx`
- Modify: `app/layout.tsx`
- Modify: `package.json` (deps added by npm)

**Interfaces:**
- Produces: `theme` (default export of `lib/theme.ts`), `gradients` (named export: `{ cardFront: string; mystery: string; primary: string }`), and `ThemeRegistry` (default export, a client wrapper component taking `{ children }`).

- [ ] **Step 1: Install MUI + Emotion**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm install @mui/material @mui/icons-material @mui/material-nextjs @emotion/react @emotion/styled @emotion/cache
```
If npm reports a React 19 peer-dependency conflict, re-run with `--legacy-peer-deps`. Expected: packages added to `package.json` dependencies, no install error.

- [ ] **Step 2: Create the theme**

Create `lib/theme.ts`:
```ts
"use client";

import { createTheme } from "@mui/material/styles";

/** Wiederverwendbare Gradient-Tokens für Karten & Akzente. */
export const gradients = {
  cardFront: "linear-gradient(135deg, #d946ef 0%, #6366f1 100%)",
  mystery: "linear-gradient(135deg, #404040 0%, #171717 100%)",
  primary: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
};

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#22c55e" },
    secondary: { main: "#d946ef" },
    background: { default: "#0a0a0a", paper: "#171717" },
    success: { main: "#22c55e" },
    error: { main: "#ef4444" },
    warning: { main: "#f59e0b" },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: "var(--font-inter), system-ui, sans-serif",
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { variant: "contained" } },
  },
});

export default theme;
```

- [ ] **Step 3: Create the ThemeRegistry**

Create `app/ThemeRegistry.tsx`:
```tsx
"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "@/lib/theme";

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppRouterCacheProvider options={{ key: "mui" }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
```

If the import `@mui/material-nextjs/v15-appRouter` fails to resolve at build time on this MUI version, check the installed package's `package.json` `exports` for the correct `*-appRouter` subpath (e.g. `v14-appRouter`) and use that path instead — the `AppRouterCacheProvider` API is the same.

- [ ] **Step 4: Wire layout with Inter font (keep Tailwind import for now)**

Replace `app/layout.tsx` with:
```tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ThemeRegistry from "./ThemeRegistry";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Kluuzter",
  description: "Musik-Ratespiel im Hitster-Stil",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={inter.variable}>
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
```
(The old `bg-neutral-900 text-neutral-100` body classes are dropped; `CssBaseline` + theme now own background/text. Individual components still carry their Tailwind classes until migrated — that is fine.)

- [ ] **Step 5: Typecheck, build, and run the suite**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx tsc --noEmit
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm run build
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx vitest run
```
Expected: `tsc` exit 0; `npm run build` succeeds (validates MUI + Emotion + Next 16 SSR integration — the key risk); suite 163/163 green.

- [ ] **Step 6: Commit**

```bash
git add lib/theme.ts app/ThemeRegistry.tsx app/layout.tsx package.json package-lock.json
git commit -m "feat(ui): add Material UI infrastructure and dark party theme"
```

---

## Task 2: Game-board primitives — Card + Slot

**Files:**
- Modify: `components/game/Card.tsx`
- Modify: `components/game/Slot.tsx`
- Test: `components/game/__tests__/Card.test.tsx` (must stay green, no edits expected)
- Test: `components/game/__tests__/Timeline.test.tsx` (covers Slot; must stay green)

**Interfaces:**
- Consumes: `theme`, `gradients` from Task 1.
- Produces: `GameCard` and `Slot` with **unchanged props** (`GameCard`: `card, faceDown?, draggable?, onDragStart?, onClick?`; `Slot`: `index, selected, disabled?, onSelect, label?`).

**Preserve (test-critical):** `GameCard` face-down shows `?` + `Mystery-Song`, hides artist/title/year, no onClick; revealed shows artist/title/year, `≈ ungenau` when `yearSource==="spotify"`, and when `onClick` is set carries `role="button"` + `aria-label={`Details: ${card.artist} – ${card.title}`}`. `Slot` keeps `aria-label={`Slot ${index}`}`, `disabled`, click + `onDragOver`/`onDragLeave`/`onDrop` (preventDefault) calling `onSelect(index)`.

- [ ] **Step 1: Rebuild `GameCard` with MUI**

Replace the markup in `components/game/Card.tsx` using MUI while keeping the exact props and the preserve-list above. Use `Card`/`Paper` from `@mui/material` with `sx`, keeping the `aspect-ratio: 3/4` and ~96–112px width. Reference implementation:
```tsx
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
  faceDown?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
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
```

- [ ] **Step 2: Rebuild `Slot` with MUI**

Replace `components/game/Slot.tsx` markup, keeping props, the `useState` dragOver, and all handlers. Use a MUI `Button` so `disabled`/role stay native:
```tsx
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
```

- [ ] **Step 3: Run Card + Timeline tests**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx vitest run components/game/__tests__/Card.test.tsx components/game/__tests__/Timeline.test.tsx
```
Expected: PASS (face-down/revealed/aria-label/slot-disabled/drag-drop all still green). If a query fails, fix the markup to restore the exact accessible name — do not edit the test.

- [ ] **Step 4: Typecheck + full suite**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx tsc --noEmit && npx vitest run
```
Expected: tsc exit 0, suite green.

- [ ] **Step 5: Commit**

```bash
git add components/game/Card.tsx components/game/Slot.tsx
git commit -m "feat(ui): migrate Card and Slot to MUI"
```

---

## Task 3: Timeline + PlayerBar + PlaybackControls

**Files:**
- Modify: `components/game/Timeline.tsx`, `components/game/PlayerBar.tsx`, `components/game/PlaybackControls.tsx`
- Test: `components/game/__tests__/Timeline.test.tsx` (stay green)

**Interfaces:**
- Consumes: `GameCard`, `Slot` (Task 2). Props of all three components unchanged.

**Preserve:** Timeline still renders `length+1` slots interleaved with cards in order, threads `onCardClick`, `availableSlots`/`selectedSlot`/`interactive`/`onSelectSlot` unchanged. PlaybackControls keeps `aria-label={paused ? "Abspielen" : "Pausieren"}` on the toggle button and `disabled`.

- [ ] **Step 1: Migrate Timeline**

In `components/game/Timeline.tsx`, replace the outer `div` with a horizontally scrollable MUI `Box` (`sx={{ display: "flex", alignItems: "center", gap: 0.5, overflowX: "auto", px: 1.5, py: 2 }}`). Keep the loop that pushes `Slot` and `GameCard` (with `onClick={onCardClick ? () => onCardClick(c) : undefined}`) exactly as-is.

- [ ] **Step 2: Migrate PlayerBar**

In `components/game/PlayerBar.tsx`, render a horizontally scrollable `Stack direction="row"` of MUI `Chip`s (one per player). Show `${scoredCardCount(p)} Karten · ${p.tokens} Token` (keep `scoredCardCount` import). Highlight the active player (`i === activeIndex`) with `color="success"` / filled variant; others `variant="outlined"`. Keep the player name visible as text.

- [ ] **Step 3: Migrate PlaybackControls**

Replace `components/game/PlaybackControls.tsx` markup, keeping props/`pct` math:
```tsx
import type { PlaybackState } from "@/lib/spotify/useSpotifyPlayer";
import { Box, IconButton, LinearProgress } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";

export function PlaybackControls({
  playback,
  onToggle,
  disabled = false,
}: {
  playback: PlaybackState | null;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const duration = playback?.duration ?? 0;
  const position = playback?.position ?? 0;
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const paused = playback?.paused ?? true;

  return (
    <Box sx={{ width: "100%", maxWidth: 448, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
      <IconButton
        onClick={onToggle}
        disabled={disabled}
        aria-label={paused ? "Abspielen" : "Pausieren"}
        sx={{ width: 56, height: 56, bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.dark" } }}
      >
        {paused ? <PlayArrowIcon /> : <PauseIcon />}
      </IconButton>
      <LinearProgress variant="determinate" value={pct} sx={{ width: "100%", height: 8, borderRadius: 4 }} />
    </Box>
  );
}
```

- [ ] **Step 4: Run Timeline test + typecheck + suite**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx vitest run components/game/__tests__/Timeline.test.tsx && npx tsc --noEmit && npx vitest run
```
Expected: Timeline test green; tsc exit 0; full suite green.

- [ ] **Step 5: Commit**

```bash
git add components/game/Timeline.tsx components/game/PlayerBar.tsx components/game/PlaybackControls.tsx
git commit -m "feat(ui): migrate Timeline, PlayerBar, PlaybackControls to MUI"
```

---

## Task 4: Dialogs — ConfirmDialog + CardDetail

**Files:**
- Modify: `components/game/ConfirmDialog.tsx`, `components/game/CardDetail.tsx`
- Test: `components/game/__tests__/ConfirmDialog.test.tsx`, `components/game/__tests__/CardDetail.test.tsx` (update for MUI Dialog semantics)

**Interfaces:** Both keep their current props (`ConfirmDialog`: `title, message, confirmLabel?, cancelLabel?, onConfirm, onCancel`; `CardDetail`: `card, onClose`).

**Preserve:** `getByRole("dialog")` works (MUI `Dialog` provides it). Confirm/cancel button text unchanged. `CardDetail` close button keeps `aria-label="Schließen"`. Full card text (artist/title/year, `/ungenau/`) shown. Escape and backdrop still cancel/close.

- [ ] **Step 1: Migrate ConfirmDialog to MUI Dialog**

Replace `components/game/ConfirmDialog.tsx` with a MUI `Dialog` (remove the manual Escape `useEffect`; MUI `onClose` fires for Escape and backdrop):
```tsx
"use client";

import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from "@mui/material";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open onClose={onCancel} aria-label={title}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} variant="text" color="inherit">
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} color="error">
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Update ConfirmDialog test for MUI semantics**

In `components/game/__tests__/ConfirmDialog.test.tsx`, the button-click and Escape tests still work. The backdrop test must target MUI's backdrop. Replace the backdrop-click test body with:
```tsx
  it("calls onCancel when the backdrop is clicked", () => {
    const { onCancel } = setup();
    fireEvent.click(document.querySelector(".MuiBackdrop-root")!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
```
Keep the confirm/cancel/Escape tests. (MUI fires `onClose` on `keydown` Escape; `fireEvent.keyDown(window, { key: "Escape" })` may need to target the dialog — if the Escape test fails, change it to `fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })`.)

- [ ] **Step 3: Migrate CardDetail to MUI Dialog**

Replace `components/game/CardDetail.tsx` with a MUI `Dialog` (keep `aria-label="Schließen"` on the close `IconButton`, cover via `<Box component="img">` guarded by `card.coverUrl`):
```tsx
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
        <Typography variant="h6" fontWeight={700}>{card.artist}</Typography>
        <Typography sx={{ color: "text.secondary" }}>{card.title}</Typography>
        <Typography sx={{ fontSize: 32, fontWeight: 900, mt: 1 }}>{card.year}</Typography>
        {card.yearSource === "spotify" && (
          <Typography sx={{ color: "warning.light", mt: 1 }}>≈ Jahr ungenau (Spotify-Quelle)</Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Update CardDetail test for MUI semantics**

In `components/game/__tests__/CardDetail.test.tsx`: keep the full-text, close-button (`getByLabelText("Schließen")`), and spotify-hint tests. Replace the backdrop test to click `.MuiBackdrop-root` (as in Step 2). If the Escape test targets `window`, retarget to `screen.getByRole("dialog")` if it fails.

- [ ] **Step 5: Run both dialog tests + typecheck + suite**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx vitest run components/game/__tests__/ConfirmDialog.test.tsx components/game/__tests__/CardDetail.test.tsx && npx tsc --noEmit && npx vitest run
```
Expected: both dialog tests green; tsc exit 0; full suite green.

- [ ] **Step 6: Commit**

```bash
git add components/game/ConfirmDialog.tsx components/game/CardDetail.tsx components/game/__tests__/ConfirmDialog.test.tsx components/game/__tests__/CardDetail.test.tsx
git commit -m "feat(ui): migrate ConfirmDialog and CardDetail to MUI Dialog"
```

---

## Task 5: Reveal + Counter + GameOver

**Files:**
- Modify: `components/game/RevealOverlay.tsx`, `components/game/CounterOverlay.tsx`, `components/game/GameOverScreen.tsx`
- Test: `components/game/__tests__/RevealOverlay.test.tsx` (stay green)

**Interfaces:** Props unchanged for all three. `RevealOverlay` still renders `GameCard` (Task 2).

**Preserve (RevealOverlay):** keep `data-testid="verdict-banner"` on the banner element; banner text matches `/richtig/i` (correct) or `/falsch|daneben/i` (wrong); song `title`, `artist`, `year` visible as text; confirm button accessible name matches `/\+1 Token/i`.

- [ ] **Step 1: Migrate RevealOverlay**

Rebuild `components/game/RevealOverlay.tsx` as a full-screen MUI overlay (`Box` with `position: fixed, inset: 0, zIndex: theme.zIndex.modal`, success/error tinted background). Keep the verdict banner as a `Paper`/`Box` with `data-testid="verdict-banner"` and the exact texts `✓ RICHTIG!` / `✗ DANEBEN!`. Keep the `GameCard` render, the `title — artist (year)` line, the counters list, the winner/discard line, and the two `Button`s; the "+1 Token" button keeps that text. Use MUI `Button`/`Typography`/`Stack`.

- [ ] **Step 2: Migrate CounterOverlay**

Rebuild `components/game/CounterOverlay.tsx` as a bottom sheet (`Paper` with `position: fixed, bottom: 0, left: 0, right: 0`, rounded top). Keep the heading, the per-slot `Button`s labelled `Slot {slot}`, the "Passen" `Button`, and the no-counter message. Props unchanged.

- [ ] **Step 3: Migrate GameOverScreen**

Rebuild `components/game/GameOverScreen.tsx` with `Container` + MUI `List` (or `Stack`) of ranked players (keep `scoredCardCount` sort and the `${scoredCardCount(p)} Karten · ${p.tokens} Token` text, winner marked with 🏆) and a `Button` "Neue Runde" calling `onRestart`.

- [ ] **Step 4: Run RevealOverlay test + typecheck + suite**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx vitest run components/game/__tests__/RevealOverlay.test.tsx && npx tsc --noEmit && npx vitest run
```
Expected: RevealOverlay test green (banner testid + texts + +1 Token button); tsc exit 0; full suite green.

- [ ] **Step 5: Commit**

```bash
git add components/game/RevealOverlay.tsx components/game/CounterOverlay.tsx components/game/GameOverScreen.tsx
git commit -m "feat(ui): migrate Reveal, Counter and GameOver to MUI"
```

---

## Task 6: GameScreen + DeckLoading

**Files:**
- Modify: `components/game/GameScreen.tsx`, `components/game/DeckLoading.tsx`
- No test files (neither is unit-tested).

**Interfaces:** Props unchanged. GameScreen still uses `useSpotifyPlayer`, `useGameEngine`, the phase rendering, the abort `ConfirmDialog` (`confirmLabel="Spiel beenden"`), `CardDetail`, and `Timeline onCardClick`.

- [ ] **Step 1: Migrate GameScreen chrome**

In `components/game/GameScreen.tsx`, replace the outer container + top bar with MUI: an `AppBar position="static"` + `Toolbar` holding a `Typography` title ("Kluuzter") and an "Abbrechen" `Button` (`onClick={() => setShowAbort(true)}`). Use `Box`/`Stack` for the body. Replace the error/`playError` `<p>` banners with MUI `Alert severity="error"`/`"warning"`. Keep all logic, the `phase` branches, `PlayerBar`, `Timeline` (with `onCardClick`), the face-down `GameCard` (no onClick), `PlaybackControls`, the "Hier einsetzen" `Button` (keep `disabled={selectedSlot === null}`), the "Karte überspringen" button, and the `ConfirmDialog`/`CardDetail` blocks unchanged in behaviour.

- [ ] **Step 2: Migrate DeckLoading**

Rebuild `components/game/DeckLoading.tsx` keeping the fetch effect/props. Use a centered MUI layout: error branch → `Alert severity="error"` + "Zurück" `Button`; loading branch → `CircularProgress` + the two `Typography` lines ("Deck wird vorbereitet…" + the MusicBrainz note).

- [ ] **Step 3: Typecheck + build + suite**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx tsc --noEmit && npm run build && npx vitest run
```
Expected: tsc exit 0; build OK; suite green.

- [ ] **Step 4: Commit**

```bash
git add components/game/GameScreen.tsx components/game/DeckLoading.tsx
git commit -m "feat(ui): migrate GameScreen and DeckLoading to MUI"
```

---

## Task 7: SetupScreen + PlaylistPicker

**Files:**
- Modify: `components/setup/SetupScreen.tsx`, `components/setup/PlaylistPicker.tsx`
- Test: `components/setup/__tests__/PlaylistPicker.test.tsx` (stay green)

**Interfaces:** Props unchanged. SetupScreen still calls `minTracksNeeded`, builds `SetupConfig`, calls `onStart`. PlaylistPicker keeps `selectedIds`/`onChange` and the embedded `IndexControls`.

**Preserve (PlaylistPicker):** status text matches `/2\s*\/\s*5 indiziert/i` and `/indiziert ✓/i`; index button accessible name matches `/^indizieren$/i`; re-index button matches `/neu indizieren/i`. **Preserve (SetupScreen):** remove-player button keeps `aria-label="Spieler entfernen"`.

- [ ] **Step 1: Migrate SetupScreen**

Rebuild `components/setup/SetupScreen.tsx` with `Container` + `Stack` sections, keeping all state/logic. Players: `TextField`s + an `IconButton` `aria-label="Spieler entfernen"` (keep!) + an "+ Spieler hinzufügen" `Button`. Mode: `ToggleButtonGroup` with values `targetCards`/`fixedRounds` (labels "X Karten erreichen"/"Feste Rundenzahl"). Number inputs: `TextField type="number"` for `targetValue`/`startTokens` with the same min/clamping. Playlists: render `PlaylistPicker` + an `Alert severity="warning"` for `tooFewTracks`. The start `Button` keeps `disabled={!canStart}` and text "Deck vorbereiten & starten".

- [ ] **Step 2: Migrate PlaylistPicker + IndexControls**

Rebuild `components/setup/PlaylistPicker.tsx` keeping all fetch/state logic. Search `TextField type="search"`. Results: MUI `List`/`ListItemButton` (selected highlighted, `✓` shown) with `IndexControls` under selected items. In `IndexControls`, keep the status text formats verbatim: loading → "Status wird geladen…"; indexing → `Indiziere… {done}/{total} ({pct}%)` (consider MUI `LinearProgress` alongside); ready partial → `{indexed} / {total} indiziert` with an **"Indizieren"** `Button` (name must match `/^indizieren$/i`); ready full → `indiziert ✓` text with a **"Neu indizieren"** `Button` (matches `/neu indizieren/i`); error → retry button. Keep `runIndex(force)` wiring (`force: false` for "Indizieren", `true` for "Neu indizieren").

- [ ] **Step 3: Run PlaylistPicker test + typecheck + suite**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx vitest run components/setup/__tests__/PlaylistPicker.test.tsx && npx tsc --noEmit && npx vitest run
```
Expected: PlaylistPicker test green (status badges + indizieren/neu-indizieren buttons + force flags); tsc exit 0; full suite green. If a button query fails, fix the label text — do not weaken the test.

- [ ] **Step 4: Commit**

```bash
git add components/setup/SetupScreen.tsx components/setup/PlaylistPicker.tsx
git commit -m "feat(ui): migrate SetupScreen and PlaylistPicker to MUI"
```

---

## Task 8: Home + Login pages

**Files:**
- Modify: `app/page.tsx` (Server Component — keep server actions), `app/login/page.tsx` (Client Component)

**Interfaces:** No prop changes. `app/page.tsx` stays a Server Component using `auth`, `signIn`, `signOut`, `fetchProfile`, `isPremium`; MUI components render fine as children of a Server Component, and `<Button type="submit">` works inside `<form action={serverAction}>`.

- [ ] **Step 1: Migrate Home**

In `app/page.tsx`, keep all server logic and the `<form action={...}>` server-action wrappers. Replace markup with MUI: `Container` + `Stack` centered, `Typography` title "Kluuzter", a `Typography` line for the logged-in profile + premium status (green/red via `color`/`Chip`), a `Button component={Link} href="/play"` "Spiel starten" when premium, a `Button type="submit"` "Spotify trennen" in the sign-out form, and a `Button type="submit"` "Mit Spotify anmelden" in the sign-in form.

- [ ] **Step 2: Migrate Login**

In `app/login/page.tsx`, keep `useActionState(login, {})` and `formAction`. Replace markup with `Container`/`Paper` + `TextField type="password" name="password" autoFocus`, an `Alert severity="error"` for `state.error`, and a submit `Button` (`disabled={pending}`, text `pending ? "..." : "Weiter"`).

- [ ] **Step 3: Typecheck + build + suite**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx tsc --noEmit && npm run build && npx vitest run
```
Expected: tsc exit 0; build OK (validates Server Component + MUI + server actions); suite green.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/login/page.tsx
git commit -m "feat(ui): migrate Home and Login pages to MUI"
```

---

## Task 9: Remove Tailwind + final verification

**Files:**
- Modify: `app/globals.css`, `postcss.config.mjs`, `package.json`

**Interfaces:** None.

- [ ] **Step 1: Confirm no Tailwind utility classes remain**

Run:
```bash
grep -rnE 'className="[^"]*(bg-|text-|flex|rounded|p-|px-|py-|m-|gap-|grid|w-|h-|min-|max-|space-|ring-|border-|shadow|aspect-|overflow-|tracking-|font-|items-|justify-)' app components | grep -v node_modules
```
Expected: no output. If any line appears, migrate that leftover to MUI `sx` before continuing.

- [ ] **Step 2: Strip Tailwind from globals.css**

Replace `app/globals.css` contents with minimal globals (Tailwind import removed):
```css
html,
body {
  height: 100%;
}
```

- [ ] **Step 3: Remove the Tailwind PostCSS plugin**

Delete `postcss.config.mjs` (no other PostCSS plugins are configured):
```bash
git rm postcss.config.mjs
```

- [ ] **Step 4: Uninstall Tailwind packages**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm uninstall tailwindcss @tailwindcss/postcss
```
Expected: both removed from `package.json` devDependencies.

- [ ] **Step 5: Final typecheck, build, and suite**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx tsc --noEmit && npm run build && npx vitest run
```
Expected: tsc exit 0; `npm run build` succeeds with no Tailwind; suite 163/163 green.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css package.json package-lock.json
git commit -m "chore(ui): remove Tailwind now that the UI is fully on MUI"
```

---

## Manual Verification (after all tasks)

Run `npm run dev` and visually confirm the dark party theme across: Home/Login, Setup (players/mode/numbers/playlist search + index buttons), DeckLoading spinner, GameScreen (AppBar + abort, player chips, timeline + slots + mystery card, playback controls), Counter/Reveal/GameOver overlays, ConfirmDialog and CardDetail. Confirm drag-and-drop still places cards and tapping a timeline card opens its detail.

## Self-Review Notes

- **Spec coverage:** Infra/theme/Tailwind-removal → Tasks 1 & 9; component map → Tasks 2–8 (every file in the spec's table has a task); test strategy → preserve-lists in each task + dialog-test updates in Task 4. All spec sections covered.
- **Out of scope respected:** no engine/machine/selector changes; DnD technique unchanged; no new flows; player fixes excluded.
- **Type/name consistency:** `theme` default export + `gradients` named export (Task 1) are consumed in Tasks 2/3; component props are unchanged across all tasks, so consumers (GameScreen, GameApp) keep compiling.
