# Three Gameplay Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a game-abort button (back to setup), a click-to-open card detail view, and count the anchor card toward each player's card total — including the win condition.

**Architecture:** Feature 3 changes the single counting helper `scoredCardCount` so display, win condition, and tiebreak stay consistent (no state-machine change). Features 1 and 2 add two small, isolated overlay components (`ConfirmDialog`, `CardDetail`) and wire them into `GameScreen` via local React state; the existing XState machine is untouched.

**Tech Stack:** Next 16 (App Router), React 19, TypeScript, Tailwind v4, XState 5, Vitest 4 + @testing-library/react (jsdom per-file).

## Global Constraints

- No changes to the XState machine (`lib/engine/machine.ts`) or its event/state shape.
- The face-down (mystery) card never opens a detail view.
- Drag-and-drop and slot logic stay untouched.
- The counting helper keeps its current name `scoredCardCount` (only its body changes).
- Component tests live in `components/game/__tests__/` and start with `// @vitest-environment jsdom`; the default Vitest environment is `node`.
- UI copy is German, matching existing components.
- Reference spec: `docs/superpowers/specs/2026-06-20-three-gameplay-features-design.md`.

---

## File Structure

**Feature 3 — anchor counting**
- Modify: `lib/engine/timeline.ts` — `scoredCardCount` body.
- Modify: `lib/engine/__tests__/timeline.test.ts` — expectations.
- Modify: `lib/engine/__tests__/win.test.ts` — two targetCards expectations.

**Feature 1 — abort**
- Create: `components/game/ConfirmDialog.tsx` — reusable confirm overlay.
- Create: `components/game/__tests__/ConfirmDialog.test.tsx`.
- Modify: `components/game/GameScreen.tsx` — abort button + dialog state.

**Feature 2 — card detail**
- Create: `components/game/CardDetail.tsx` — full-card overlay.
- Create: `components/game/__tests__/CardDetail.test.tsx`.
- Modify: `components/game/Card.tsx` — optional `onClick` on the revealed card.
- Modify: `components/game/Timeline.tsx` — thread `onCardClick`.
- Modify: `components/game/__tests__/Timeline.test.tsx` — click test.
- Modify: `components/game/__tests__/Card.test.tsx` — click test.
- Modify: `components/game/GameScreen.tsx` — `detailCard` state + render `CardDetail`.

---

## Task 1: Anchor counts toward card total and win condition

**Files:**
- Modify: `lib/engine/timeline.ts:32-34`
- Test: `lib/engine/__tests__/timeline.test.ts:72-81`
- Test: `lib/engine/__tests__/win.test.ts:44-63`

**Interfaces:**
- Consumes: nothing new.
- Produces: `scoredCardCount(player: Player): number` now returns `player.timeline.length` (anchor included). Consumed unchanged by `lib/engine/win.ts`, `components/game/PlayerBar.tsx`, `components/game/GameOverScreen.tsx`.

- [ ] **Step 1: Update the `scoredCardCount` tests to the new (anchor-inclusive) expectations**

In `lib/engine/__tests__/timeline.test.ts`, replace the whole `describe("scoredCardCount", ...)` block (lines 72-81) with:

```ts
describe("scoredCardCount", () => {
  it("includes the anchor card", () => {
    const p: Player = { id: "p", name: "P", tokens: 2, timeline: tl };
    expect(scoredCardCount(p)).toBe(3); // 3 Karten inkl. Anker
  });
  it("is 1 for a player with only the anchor", () => {
    const p: Player = { id: "p", name: "P", tokens: 2, timeline: [card("a", 1970)] };
    expect(scoredCardCount(p)).toBe(1);
  });
  it("is 0 for an empty timeline", () => {
    const p: Player = { id: "p", name: "P", tokens: 2, timeline: [] };
    expect(scoredCardCount(p)).toBe(0);
  });
});
```

- [ ] **Step 2: Update the two targetCards win tests to the new counting**

In `lib/engine/__tests__/win.test.ts`, replace the `describe("isGameOver — targetCards", ...)` block (lines 44-63) with:

```ts
describe("isGameOver — targetCards", () => {
  it("is true when a player reached the card target (anchor counts)", () => {
    const c = ctx({
      mode: "targetCards",
      targetValue: 3,
      // A: 2 platzierte + 1 Anker = 3 = Ziel
      players: [player("A", 2, 1), player("B", 1, 2)],
      turnOrder: ["A", "B"],
    });
    expect(isGameOver(c)).toBe(true);
  });
  it("is false when nobody reached the target and deck has cards", () => {
    const c = ctx({
      mode: "targetCards",
      targetValue: 3,
      // beide: 1 platzierte + 1 Anker = 2 < 3
      players: [player("A", 1, 1), player("B", 1, 2)],
      turnOrder: ["A", "B"],
    });
    expect(isGameOver(c)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the engine tests to verify they fail**

Run: `npx vitest run lib/engine/__tests__/timeline.test.ts lib/engine/__tests__/win.test.ts`
Expected: FAIL — `scoredCardCount` still returns `length - 1`, so `expect(...).toBe(3)` and the targetCards boundary cases fail.

- [ ] **Step 4: Change the `scoredCardCount` body**

In `lib/engine/timeline.ts`, replace lines 32-34:

```ts
export function scoredCardCount(player: Player): number {
  return player.timeline.length;
}
```

- [ ] **Step 5: Run the full test suite to verify everything passes**

Run: `npx vitest run`
Expected: PASS — all engine and component tests green (confirms no other test depended on the old counting).

- [ ] **Step 6: Commit**

```bash
git add lib/engine/timeline.ts lib/engine/__tests__/timeline.test.ts lib/engine/__tests__/win.test.ts
git commit -m "feat: count anchor card toward player card total and win condition

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: ConfirmDialog component

**Files:**
- Create: `components/game/ConfirmDialog.tsx`
- Test: `components/game/__tests__/ConfirmDialog.test.tsx`

**Interfaces:**
- Produces: `ConfirmDialog({ title, message, confirmLabel?, cancelLabel?, onConfirm, onCancel })` — a fixed-position modal overlay. `confirmLabel` defaults to `"Bestätigen"`, `cancelLabel` to `"Abbrechen"`. Calls `onConfirm` on the confirm button, `onCancel` on the cancel button, on backdrop click, and on Escape.

- [ ] **Step 1: Write the failing test**

Create `components/game/__tests__/ConfirmDialog.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ConfirmDialog } from "../ConfirmDialog";

afterEach(cleanup);

function setup() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      title="Spiel abbrechen?"
      message="Der aktuelle Spielfortschritt geht verloren."
      confirmLabel="Abbrechen"
      cancelLabel="Weiterspielen"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("calls onConfirm when the confirm button is clicked", () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.click(screen.getByText("Abbrechen"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.click(screen.getByText("Weiterspielen"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onCancel when Escape is pressed", () => {
    const { onCancel } = setup();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/game/__tests__/ConfirmDialog.test.tsx`
Expected: FAIL — cannot resolve module `../ConfirmDialog`.

- [ ] **Step 3: Write the component**

Create `components/game/ConfirmDialog.tsx`:

```tsx
"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-xl bg-neutral-900 p-5 ring-1 ring-white/10"
      >
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="text-sm text-neutral-300">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg bg-neutral-700 py-2 font-semibold"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-600 py-2 font-semibold"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/game/__tests__/ConfirmDialog.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/game/ConfirmDialog.tsx components/game/__tests__/ConfirmDialog.test.tsx
git commit -m "feat: add reusable ConfirmDialog overlay

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Wire abort button into GameScreen

**Files:**
- Modify: `components/game/GameScreen.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` from Task 2; the existing `onRestart: () => void` prop of `GameScreen`.
- Produces: no new exported interface (internal wiring only).

GameScreen is not unit-tested (it depends on `useSpotifyPlayer` and network fetches); this task is verified by typecheck and manual smoke.

- [ ] **Step 1: Import ConfirmDialog and add abort state**

In `components/game/GameScreen.tsx`, add the import near the other component imports (after the `GameOverScreen` import on line 19):

```tsx
import { ConfirmDialog } from "./ConfirmDialog";
```

Then, inside the component, add a state next to the existing `selectedSlot` / `playError` states (around line 36-37):

```tsx
  const [showAbort, setShowAbort] = useState(false);
```

- [ ] **Step 2: Add the abort top bar above the PlayerBar**

In the returned JSX, replace the opening of the main container and the `<PlayerBar .../>` line (lines 73-75):

```tsx
  return (
    <div className="flex min-h-screen flex-col">
      <PlayerBar players={context.players} activeIndex={context.activeIndex} />
```

with:

```tsx
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Kluuzter
        </span>
        <button
          type="button"
          onClick={() => setShowAbort(true)}
          className="rounded-lg bg-neutral-800 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
        >
          Abbrechen
        </button>
      </div>
      <PlayerBar players={context.players} activeIndex={context.activeIndex} />
```

- [ ] **Step 3: Render the confirm dialog**

In the same file, just before the final closing `</div>` of the main container (after the `phase === "reveal"` block, around line 169), add:

```tsx
      {showAbort && (
        <ConfirmDialog
          title="Spiel abbrechen?"
          message="Der aktuelle Spielfortschritt geht verloren."
          confirmLabel="Abbrechen"
          cancelLabel="Weiterspielen"
          onConfirm={onRestart}
          onCancel={() => setShowAbort(false)}
        />
      )}
```

(The `gameOver` phase returns early at line 60, so the abort bar only appears during active play.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `GameScreen.tsx` or `ConfirmDialog`.

- [ ] **Step 5: Run the full test suite (no regressions)**

Run: `npx vitest run`
Expected: PASS (all existing tests still green).

- [ ] **Step 6: Commit**

```bash
git add components/game/GameScreen.tsx
git commit -m "feat: allow aborting a running game back to setup

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: CardDetail component

**Files:**
- Create: `components/game/CardDetail.tsx`
- Test: `components/game/__tests__/CardDetail.test.tsx`

**Interfaces:**
- Consumes: `Card` from `@/lib/engine/types`.
- Produces: `CardDetail({ card, onClose })` — a fixed-position modal showing the full artist, title, year, cover (if any), and the `≈ ungenau` hint when `card.yearSource === "spotify"`. Calls `onClose` on the close button, backdrop click, and Escape.

- [ ] **Step 1: Write the failing test**

Create `components/game/__tests__/CardDetail.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CardDetail } from "../CardDetail";
import type { Card } from "@/lib/engine/types";

afterEach(cleanup);

const card: Card = {
  id: "t1",
  uri: "spotify:track:t1",
  title: "A Very Long Song Title That Gets Truncated On The Card",
  artist: "An Artist With A Long Name",
  year: 1991,
  yearSource: "musicbrainz",
  coverUrl: null,
};

describe("CardDetail", () => {
  it("shows the full artist, title and year", () => {
    render(<CardDetail card={card} onClose={() => {}} />);
    expect(screen.getByText("An Artist With A Long Name")).toBeTruthy();
    expect(
      screen.getByText("A Very Long Song Title That Gets Truncated On The Card"),
    ).toBeTruthy();
    expect(screen.getByText("1991")).toBeTruthy();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<CardDetail card={card} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Schließen"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the approximate-year hint for spotify-sourced years", () => {
    render(<CardDetail card={{ ...card, yearSource: "spotify" }} onClose={() => {}} />);
    expect(screen.getByText(/ungenau/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/game/__tests__/CardDetail.test.tsx`
Expected: FAIL — cannot resolve module `../CardDetail`.

- [ ] **Step 3: Write the component**

Create `components/game/CardDetail.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import type { Card } from "@/lib/engine/types";

export function CardDetail({
  card,
  onClose,
}: {
  card: Card;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${card.artist} – ${card.title}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-3 rounded-2xl bg-neutral-900 p-6 text-center ring-1 ring-white/10"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="ml-auto block text-neutral-400 hover:text-white"
        >
          ✕
        </button>
        {card.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.coverUrl}
            alt=""
            className="mx-auto h-40 w-40 rounded-lg object-cover"
          />
        )}
        <p className="text-xl font-bold text-white">{card.artist}</p>
        <p className="text-base text-neutral-200">{card.title}</p>
        <p className="text-3xl font-black text-white">{card.year}</p>
        {card.yearSource === "spotify" && (
          <p className="text-sm text-amber-300">≈ Jahr ungenau (Spotify-Quelle)</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/game/__tests__/CardDetail.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/game/CardDetail.tsx components/game/__tests__/CardDetail.test.tsx
git commit -m "feat: add CardDetail overlay for full song/artist names

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Make revealed cards clickable through the Timeline

**Files:**
- Modify: `components/game/Card.tsx`
- Modify: `components/game/Timeline.tsx`
- Test: `components/game/__tests__/Card.test.tsx`
- Test: `components/game/__tests__/Timeline.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `GameCard` gains optional `onClick?: () => void`. When set, the revealed card renders `role="button"`, `aria-label={`Details: ${card.artist} – ${card.title}`}`, `cursor-pointer`, and calls `onClick`. The face-down branch ignores `onClick`.
  - `Timeline` gains optional `onCardClick?: (card: Card) => void`, invoked with the clicked revealed card.

- [ ] **Step 1: Write the failing tests**

In `components/game/__tests__/Card.test.tsx`, add inside the `describe("GameCard", ...)` block:

```tsx
  it("calls onClick when a revealed card is clicked", () => {
    const onClick = vi.fn();
    render(<GameCard card={card} onClick={onClick} />);
    fireEvent.click(screen.getByLabelText("Details: Dire Straits – Sultans of Swing"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
```

Update that file's import line (line 3) to include `fireEvent` and `vi`:

```tsx
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
```

In `components/game/__tests__/Timeline.test.tsx`, add inside the `describe("Timeline", ...)` block:

```tsx
  it("calls onCardClick with the card when a revealed card is clicked", () => {
    const onCardClick = vi.fn();
    render(
      <Timeline cards={cards} availableSlots={[0, 1, 2]} selectedSlot={null} onSelectSlot={() => {}} interactive onCardClick={onCardClick} />,
    );
    fireEvent.click(screen.getByLabelText("Details: a – a"));
    expect(onCardClick).toHaveBeenCalledWith(cards[0]);
  });
```

(The Timeline test helper builds cards with `artist === title === id`, so card `"a"` has aria-label `Details: a – a`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/game/__tests__/Card.test.tsx components/game/__tests__/Timeline.test.tsx`
Expected: FAIL — no element with label `Details: ...` exists yet (and `onCardClick` is not a prop).

- [ ] **Step 3: Add `onClick` to the revealed GameCard**

In `components/game/Card.tsx`, update the props (lines 3-15) to add `onClick`:

```tsx
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
```

Then replace the revealed return block (lines 33-50) with:

```tsx
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={onClick ? `Details: ${card.artist} – ${card.title}` : undefined}
      className={`flex aspect-[3/4] w-24 shrink-0 flex-col justify-between rounded-xl bg-gradient-to-br from-fuchsia-600 to-indigo-700 p-2 text-center shadow-lg sm:w-28 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <p className="truncate text-[11px] font-semibold text-white/90">
        {card.artist}
      </p>
      <p className="text-3xl font-black text-white">{card.year}</p>
      <div>
        <p className="truncate text-[11px] text-white/90">{card.title}</p>
        {card.yearSource === "spotify" && (
          <p className="text-[9px] text-amber-200">≈ ungenau</p>
        )}
      </div>
    </div>
  );
```

- [ ] **Step 4: Thread `onCardClick` through the Timeline**

In `components/game/Timeline.tsx`, add the prop to the signature (after `interactive`):

```tsx
export function Timeline({
  cards,
  availableSlots,
  selectedSlot,
  onSelectSlot,
  interactive,
  onCardClick,
}: {
  cards: Card[];
  availableSlots: number[];
  selectedSlot: number | null;
  onSelectSlot: (slot: number) => void;
  interactive: boolean;
  onCardClick?: (card: Card) => void;
}) {
```

Then replace the card-pushing branch (lines 30-32):

```tsx
    if (i < cards.length) {
      const c = cards[i];
      nodes.push(
        <GameCard
          key={c.id}
          card={c}
          onClick={onCardClick ? () => onCardClick(c) : undefined}
        />,
      );
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run components/game/__tests__/Card.test.tsx components/game/__tests__/Timeline.test.tsx`
Expected: PASS — including the existing face-down test (face-down branch has no `onClick`, so no `Details:` label appears).

- [ ] **Step 6: Commit**

```bash
git add components/game/Card.tsx components/game/Timeline.tsx components/game/__tests__/Card.test.tsx components/game/__tests__/Timeline.test.tsx
git commit -m "feat: make revealed timeline cards clickable

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Open CardDetail from GameScreen on card click

**Files:**
- Modify: `components/game/GameScreen.tsx`

**Interfaces:**
- Consumes: `CardDetail` from Task 4; `Timeline`'s `onCardClick` from Task 5; `Card` from `@/lib/engine/types`.
- Produces: no new exported interface.

Verified by typecheck and the full suite (GameScreen itself is not unit-tested).

- [ ] **Step 1: Add imports and detail state**

In `components/game/GameScreen.tsx`, extend the types import (line 4) to include `Card`:

```tsx
import type { Card, GameInput } from "@/lib/engine/types";
```

Add the `CardDetail` import after the `ConfirmDialog` import added in Task 3:

```tsx
import { CardDetail } from "./CardDetail";
```

Add the state next to `showAbort`:

```tsx
  const [detailCard, setDetailCard] = useState<Card | null>(null);
```

- [ ] **Step 2: Pass `onCardClick` to the Timeline**

In the same file, update the `<Timeline ... />` usage (lines 88-94) to add the handler:

```tsx
        <Timeline
          cards={active.timeline}
          availableSlots={slots}
          selectedSlot={selectedSlot}
          onSelectSlot={(s) => setSelectedSlot(s)}
          interactive={phase === "playing"}
          onCardClick={(c) => setDetailCard(c)}
        />
```

- [ ] **Step 3: Render the CardDetail overlay**

Just before the closing `</div>` of the main container (alongside the `showAbort` block from Task 3), add:

```tsx
      {detailCard && (
        <CardDetail card={detailCard} onClose={() => setDetailCard(null)} />
      )}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `GameScreen.tsx`, `CardDetail`, or `Timeline`.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all tests green.

- [ ] **Step 6: Commit**

```bash
git add components/game/GameScreen.tsx
git commit -m "feat: open card detail view when tapping a timeline card

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Manual Verification (after all tasks)

Run the dev server (`npm run dev:http`) and confirm:

1. **Abort:** During play, the "Abbrechen" button (top-right) opens the confirm dialog. "Weiterspielen" closes it; "Abbrechen" returns to the setup screen. Escape and backdrop click also close it.
2. **Card detail:** Tapping a revealed timeline card opens the detail overlay with full (untruncated) artist/title and the year; the mystery card at the bottom does NOT open anything. Close via ✕, backdrop, or Escape.
3. **Anchor counting:** A fresh player shows "1 Karten" before placing anything; the PlayerBar, GameOver list, and win condition all reflect the anchor (a "X Karten" game ends one placement earlier than before).

---

## Self-Review Notes

- **Spec coverage:** Feature 1 → Tasks 2-3; Feature 2 → Tasks 4-6; Feature 3 → Task 1. All three covered.
- **Out-of-scope items** (machine unchanged, mystery card excluded, `scoredCardCount` name kept, `minTracksNeeded` untouched) are respected — no task modifies `machine.ts` or `game-setup.ts`.
- **Type consistency:** `onClick` (Card), `onCardClick` (Timeline), `onConfirm`/`onCancel` (ConfirmDialog), `onClose` (CardDetail), `detailCard`/`setDetailCard` and `showAbort`/`setShowAbort` (GameScreen) are used consistently across the tasks that define and consume them.
