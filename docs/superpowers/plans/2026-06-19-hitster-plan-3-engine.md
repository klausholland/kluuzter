# Hitster Webapp — Plan 3: Spiel-Engine (XState v5, rein & getestet)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die kompletten Spielregeln (Phasen, relative Platzierung, Token-/Konter-Auflösung, Scoring, Win-Conditions beider Modi) als reine, framework-freie XState-v5-State-Machine inklusive React-Hook für die UI.

**Architecture:** Alle Regeln leben in `lib/engine` ohne React-Import. Reine Hilfsfunktionen (Slot-Korrektheit, Sortier-Einfügen, Konter-Auswertung, Win-/Sieger-Bestimmung) sind einzeln getestet. Darüber liegt eine XState-Machine, die diese Funktionen in Actions/Guards verdrahtet. Ein dünner `@xstate/react`-Hook (`useGameEngine`) ist die einzige Datei mit `"use client"` — er ist die Schnittstelle, die Plan 5 (UI) konsumiert. Spotify/Playback liefert nur fertige `Card`-Objekte als `input`; die Engine kennt weder Netz noch DOM.

**Tech Stack:** XState 5.32.1, @xstate/react 6.1.0, Vitest 4.1.9, TypeScript strict.

## Global Constraints

- `xstate@5.32.1`, `@xstate/react@6.1.0`
- `vitest@4.1.9`, TypeScript strict
- Node 24 (`nvm use 24` vor allen npm/node-Befehlen; Dev-Server `next dev -H 127.0.0.1`)
- **Keine React-/Next-/DOM-/Netz-Importe** in `lib/engine/*` außer in `useGameEngine.ts` (der einzige `"use client"`-Hook).
- Die Engine ist für 1–N Spieler identisch. Solo (1 Spieler) überspringt die Konter-Phase.
- Die Anker-Startkarte zählt **nicht** zum Kartenziel: gewertete Karten = `timeline.length - 1`.
- Jahres-Quelle wird pro Karte mitgeführt (`"musicbrainz" | "spotify"`), damit die UI „ungenau" markieren kann.

## Spec-Phasen → Machine-States (Mapping)

Die Spec (§5.2) nennt `idle → playing → placing → countering → reveal → scoring → nextTurn|gameOver`. Diese Engine bildet das so ab:

| Spec-Phase   | Machine-State        | Anmerkung |
|--------------|----------------------|-----------|
| (Setup/Deal) | `dealing`            | Anker austeilen + erste Mystery-Karte ziehen |
| `playing` + `placing` | `playing`   | Song läuft; die Slot-Auswahl ist UI-lokal, committet per `PLACE`-Event |
| `countering` | `countering`         | reihum; entfällt bei 1 Spieler |
| `reveal`     | `reveal`             | `evaluateTurn` läuft beim Eintritt; Karte wandert zum Gewinner |
| `scoring` + Win-Check | `betweenTurns` | Token-Gutschrift + Zugwechsel + Rundenzählung, dann Win-Check |
| `nextTurn`   | `drawNext` → `playing` | nächste Mystery-Karte ziehen |
| `gameOver`   | `gameOver` (final)   | Sieger bestimmen |

## Shared Types (für Plan 4 & 5 verbindlich)

```ts
// lib/engine/types.ts
export type YearSource = "musicbrainz" | "spotify";

export type Card = {
  id: string; // Spotify-Track-ID
  uri: string; // "spotify:track:..." für die Wiedergabe
  title: string;
  artist: string;
  year: number;
  yearSource: YearSource;
  coverUrl: string | null;
};

export type GameMode = "targetCards" | "fixedRounds";

export type PlayerSetup = { id: string; name: string };

export type GameInput = {
  players: PlayerSetup[]; // in Zugreihenfolge
  mode: GameMode;
  targetValue: number; // X Karten bzw. N Runden
  startTokens: number;
  deck: Card[]; // bereits gemischt & angereichert
};

export type Player = {
  id: string;
  name: string;
  tokens: number;
  timeline: Card[]; // aufsteigend nach year sortiert; enthält genau 1 Anker
};

export type CounterPlacement = { playerId: string; slot: number };

export type Resolution = {
  card: Card;
  activePlayerId: string;
  activeSlot: number;
  activeCorrect: boolean;
  counters: Array<{ playerId: string; slot: number; correct: boolean }>;
  winnerId: string | null; // null = verworfen
};

export type GameContext = {
  mode: GameMode;
  targetValue: number;
  players: Player[];
  turnOrder: string[]; // player-ids, gleiche Reihenfolge wie players[]
  activeIndex: number; // Index in turnOrder/players
  deck: Card[]; // restlicher Ziehstapel
  currentCard: Card | null; // aktuelle Mystery-Karte
  placement: CounterPlacement | null; // Platzierung des aktiven Spielers
  counters: CounterPlacement[]; // Konter in Zugreihenfolge
  pendingCounterIds: string[]; // verbleibende Konter-Warteschlange
  resolution: Resolution | null; // letzte Auswertung (für Reveal-UI)
  roundsCompleted: number;
  turnsThisRound: number;
  winnerId: string | null;
};

export type GameEvent =
  | { type: "PLACE"; slot: number }
  | { type: "COUNTER"; slot: number }
  | { type: "PASS" }
  | { type: "CONTINUE"; claimedCorrect: boolean }
  | { type: "SKIP" }; // aktuelle Mystery-Karte verwerfen (z. B. in Region nicht spielbar), neue ziehen, gleicher Spieler
```

## File Structure

- `lib/engine/types.ts` — gemeinsame Typen (oben)
- `lib/engine/timeline.ts` — reine Helfer: `slotIsCorrect`, `insertSorted`, `freeSlots`, `scoredCardCount`
- `lib/engine/evaluate.ts` — `evaluateTurn` (Platzierungs-/Konter-Auswertung) + `applyResolution`
- `lib/engine/win.ts` — `isGameOver`, `determineWinner`
- `lib/engine/machine.ts` — XState-Machine (`gameMachine`) inkl. Actions/Guards
- `lib/engine/useGameEngine.ts` — `"use client"`-Hook (`@xstate/react`)
- Tests unter `lib/engine/__tests__/`

---

## Task 1: Dependencies + Typen + Timeline-Helfer (TDD)

**Files:**
- Modify: `package.json` (Dependencies `xstate`, `@xstate/react`)
- Create: `lib/engine/types.ts`
- Create: `lib/engine/timeline.ts`
- Test: `lib/engine/__tests__/timeline.test.ts`

**Interfaces:**
- Consumes: nichts (erste Engine-Task)
- Produces:
  - alle Typen aus „Shared Types"
  - `slotIsCorrect(timeline: Card[], slot: number, year: number): boolean`
  - `insertSorted(timeline: Card[], card: Card): Card[]`
  - `freeSlots(timelineLength: number, taken: number[]): number[]`
  - `scoredCardCount(player: Player): number`

- [ ] **Step 1: Dependencies installieren**

```bash
nvm use 24
npm install xstate@5.32.1 @xstate/react@6.1.0
```

Erwartung: `package.json` listet `xstate` und `@xstate/react` unter `dependencies`.

- [ ] **Step 2: Typen-Datei anlegen**

`lib/engine/types.ts` — exakt der Block aus „Shared Types" oben (ganzer Inhalt).

- [ ] **Step 3: Failing tests schreiben**

`lib/engine/__tests__/timeline.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  slotIsCorrect,
  insertSorted,
  freeSlots,
  scoredCardCount,
} from "../timeline";
import type { Card, Player } from "../types";

function card(id: string, year: number): Card {
  return {
    id,
    uri: `spotify:track:${id}`,
    title: `t${id}`,
    artist: `a${id}`,
    year,
    yearSource: "musicbrainz",
    coverUrl: null,
  };
}

// Timeline: [1970, 1985, 2000]; Slots: 0|1970|1|1985|2|2000|3
const tl = [card("a", 1970), card("b", 1985), card("c", 2000)];

describe("slotIsCorrect", () => {
  it("accepts a year inside the chosen gap", () => {
    expect(slotIsCorrect(tl, 1, 1979)).toBe(true); // zwischen 1970 und 1985
  });
  it("rejects a year outside the chosen gap", () => {
    expect(slotIsCorrect(tl, 1, 1990)).toBe(false);
  });
  it("accepts placement before the first card (slot 0)", () => {
    expect(slotIsCorrect(tl, 0, 1965)).toBe(true);
  });
  it("rejects slot 0 when year is too high", () => {
    expect(slotIsCorrect(tl, 0, 1972)).toBe(false);
  });
  it("accepts placement after the last card (slot length)", () => {
    expect(slotIsCorrect(tl, 3, 2010)).toBe(true);
  });
  it("treats a year equal to a boundary as correct on the adjacent slot", () => {
    expect(slotIsCorrect(tl, 1, 1985)).toBe(true);
    expect(slotIsCorrect(tl, 2, 1985)).toBe(true);
  });
  it("works for an empty timeline (only slot 0)", () => {
    expect(slotIsCorrect([], 0, 1999)).toBe(true);
  });
});

describe("insertSorted", () => {
  it("inserts into the correct chronological position", () => {
    const out = insertSorted(tl, card("x", 1990));
    expect(out.map((c) => c.year)).toEqual([1970, 1985, 1990, 2000]);
  });
  it("does not mutate the input array", () => {
    const before = [...tl];
    insertSorted(tl, card("x", 1990));
    expect(tl).toEqual(before);
  });
});

describe("freeSlots", () => {
  it("returns all slots minus taken ones", () => {
    // Timeline-Länge 3 → Slots 0..3; belegt: 1
    expect(freeSlots(3, [1])).toEqual([0, 2, 3]);
  });
  it("ignores invalid/negative taken markers", () => {
    expect(freeSlots(2, [-1])).toEqual([0, 1, 2]);
  });
});

describe("scoredCardCount", () => {
  it("excludes the anchor card", () => {
    const p: Player = { id: "p", name: "P", tokens: 2, timeline: tl };
    expect(scoredCardCount(p)).toBe(2); // 3 Karten - 1 Anker
  });
  it("is 0 for a player with only the anchor", () => {
    const p: Player = { id: "p", name: "P", tokens: 2, timeline: [card("a", 1970)] };
    expect(scoredCardCount(p)).toBe(0);
  });
});
```

- [ ] **Step 4: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/engine/__tests__/timeline.test.ts`
Expected: FAIL — `Cannot find module '../timeline'`.

- [ ] **Step 5: Timeline-Helfer implementieren**

`lib/engine/timeline.ts`:
```ts
import type { Card, Player } from "./types";

/**
 * Ein Slot i liegt zwischen timeline[i-1] und timeline[i].
 * Slot 0 = vor der ersten Karte, Slot timeline.length = nach der letzten.
 * Korrekt, wenn das Jahr in die Lücke passt (Gleichstand an Grenzen erlaubt).
 */
export function slotIsCorrect(
  timeline: Card[],
  slot: number,
  year: number,
): boolean {
  const lower = slot > 0 ? timeline[slot - 1].year : Number.NEGATIVE_INFINITY;
  const upper =
    slot < timeline.length ? timeline[slot].year : Number.POSITIVE_INFINITY;
  return lower <= year && year <= upper;
}

export function insertSorted(timeline: Card[], card: Card): Card[] {
  return [...timeline, card].sort((a, b) => a.year - b.year);
}

export function freeSlots(timelineLength: number, taken: number[]): number[] {
  const blocked = new Set(taken);
  const out: number[] = [];
  for (let i = 0; i <= timelineLength; i++) {
    if (!blocked.has(i)) out.push(i);
  }
  return out;
}

export function scoredCardCount(player: Player): number {
  return Math.max(0, player.timeline.length - 1);
}
```

- [ ] **Step 6: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/engine/__tests__/timeline.test.ts`
Expected: PASS — alle Tests grün.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/engine/types.ts lib/engine/timeline.ts lib/engine/__tests__/timeline.test.ts
git commit -m "feat: add engine types and timeline helpers"
```

---

## Task 2: Konter-/Platzierungs-Auswertung `evaluateTurn` (TDD)

**Files:**
- Create: `lib/engine/evaluate.ts`
- Test: `lib/engine/__tests__/evaluate.test.ts`

**Interfaces:**
- Consumes: `slotIsCorrect`, `insertSorted` (Task 1); Typen `Card`, `Player`, `CounterPlacement`, `Resolution`
- Produces:
  - `evaluateTurn(activeTimeline: Card[], activeSlot: number, counters: CounterPlacement[], card: Card, activePlayerId: string): Resolution`
  - `applyResolution(players: Player[], resolution: Resolution): Player[]`

- [ ] **Step 1: Failing tests schreiben**

`lib/engine/__tests__/evaluate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { evaluateTurn, applyResolution } from "../evaluate";
import type { Card, Player } from "../types";

function card(id: string, year: number): Card {
  return {
    id,
    uri: `spotify:track:${id}`,
    title: `t${id}`,
    artist: `a${id}`,
    year,
    yearSource: "musicbrainz",
    coverUrl: null,
  };
}

// A's Timeline: [1970, 2000]; Slots 0|1970|1|2000|2
const aTimeline = [card("a1", 1970), card("a2", 2000)];
const mystery = card("m", 1985); // gehört in Slot 1

describe("evaluateTurn", () => {
  it("active player correct → active wins", () => {
    const r = evaluateTurn(aTimeline, 1, [], mystery, "A");
    expect(r.activeCorrect).toBe(true);
    expect(r.winnerId).toBe("A");
    expect(r.counters).toEqual([]);
  });

  it("active wrong, no counters → discarded", () => {
    const r = evaluateTurn(aTimeline, 0, [], mystery, "A");
    expect(r.activeCorrect).toBe(false);
    expect(r.winnerId).toBeNull();
  });

  it("active wrong, a counter correct → counterer wins", () => {
    const r = evaluateTurn(
      aTimeline,
      0,
      [{ playerId: "B", slot: 1 }],
      mystery,
      "A",
    );
    expect(r.activeCorrect).toBe(false);
    expect(r.counters[0]).toEqual({ playerId: "B", slot: 1, correct: true });
    expect(r.winnerId).toBe("B");
  });

  it("active wrong, multiple counters: first correct in order wins", () => {
    const r = evaluateTurn(
      aTimeline,
      0,
      [
        { playerId: "B", slot: 2 }, // falsch (1985 < 2000)
        { playerId: "C", slot: 1 }, // korrekt
      ],
      mystery,
      "A",
    );
    expect(r.winnerId).toBe("C");
  });

  it("active correct takes precedence over a correct counter", () => {
    const r = evaluateTurn(
      aTimeline,
      1,
      [{ playerId: "B", slot: 1 }],
      mystery,
      "A",
    );
    expect(r.winnerId).toBe("A");
  });

  it("all slots wrong → discarded", () => {
    const r = evaluateTurn(
      aTimeline,
      0,
      [{ playerId: "B", slot: 2 }],
      mystery,
      "A",
    );
    expect(r.winnerId).toBeNull();
  });
});

describe("applyResolution", () => {
  const players: Player[] = [
    { id: "A", name: "A", tokens: 2, timeline: [...aTimeline] },
    { id: "B", name: "B", tokens: 2, timeline: [card("b1", 1990)] },
  ];

  it("adds the card to the winner's timeline, sorted", () => {
    const r = evaluateTurn(aTimeline, 0, [{ playerId: "B", slot: 1 }], mystery, "A");
    const next = applyResolution(players, r);
    const b = next.find((p) => p.id === "B")!;
    expect(b.timeline.map((c) => c.year)).toEqual([1985, 1990]);
  });

  it("leaves timelines unchanged when discarded", () => {
    const r = evaluateTurn(aTimeline, 0, [], mystery, "A");
    const next = applyResolution(players, r);
    expect(next).toEqual(players);
  });

  it("does not mutate the input players", () => {
    const r = evaluateTurn(aTimeline, 1, [], mystery, "A");
    const snapshot = JSON.parse(JSON.stringify(players));
    applyResolution(players, r);
    expect(players).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/engine/__tests__/evaluate.test.ts`
Expected: FAIL — `Cannot find module '../evaluate'`.

- [ ] **Step 3: `evaluate.ts` implementieren**

`lib/engine/evaluate.ts`:
```ts
import type { Card, CounterPlacement, Player, Resolution } from "./types";
import { insertSorted, slotIsCorrect } from "./timeline";

export function evaluateTurn(
  activeTimeline: Card[],
  activeSlot: number,
  counters: CounterPlacement[],
  card: Card,
  activePlayerId: string,
): Resolution {
  const activeCorrect = slotIsCorrect(activeTimeline, activeSlot, card.year);

  const evaluatedCounters = counters.map((c) => ({
    playerId: c.playerId,
    slot: c.slot,
    correct: slotIsCorrect(activeTimeline, c.slot, card.year),
  }));

  let winnerId: string | null = null;
  if (activeCorrect) {
    winnerId = activePlayerId;
  } else {
    const firstCorrect = evaluatedCounters.find((c) => c.correct);
    winnerId = firstCorrect ? firstCorrect.playerId : null;
  }

  return {
    card,
    activePlayerId,
    activeSlot,
    activeCorrect,
    counters: evaluatedCounters,
    winnerId,
  };
}

export function applyResolution(
  players: Player[],
  resolution: Resolution,
): Player[] {
  if (!resolution.winnerId) return players;
  return players.map((p) =>
    p.id === resolution.winnerId
      ? { ...p, timeline: insertSorted(p.timeline, resolution.card) }
      : p,
  );
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/engine/__tests__/evaluate.test.ts`
Expected: PASS — alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add lib/engine/evaluate.ts lib/engine/__tests__/evaluate.test.ts
git commit -m "feat: add turn evaluation (placement + counter resolution)"
```

---

## Task 3: Win-Conditions & Sieger-Bestimmung (TDD)

**Files:**
- Create: `lib/engine/win.ts`
- Test: `lib/engine/__tests__/win.test.ts`

**Interfaces:**
- Consumes: `scoredCardCount` (Task 1); Typ `GameContext`
- Produces:
  - `isGameOver(context: GameContext): boolean`
  - `determineWinner(context: GameContext): string | null`

- [ ] **Step 1: Failing tests schreiben**

`lib/engine/__tests__/win.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isGameOver, determineWinner } from "../win";
import type { Card, GameContext, Player } from "../types";

function card(id: string, year: number): Card {
  return {
    id,
    uri: `spotify:track:${id}`,
    title: id,
    artist: id,
    year,
    yearSource: "musicbrainz",
    coverUrl: null,
  };
}

// erstellt einen Spieler mit `scored` gewerteten Karten (+ 1 Anker)
function player(id: string, scored: number, tokens: number): Player {
  const timeline: Card[] = [card(`${id}-anchor`, 1900)];
  for (let i = 0; i < scored; i++) timeline.push(card(`${id}-${i}`, 1950 + i));
  return { id, name: id, tokens, timeline };
}

function ctx(partial: Partial<GameContext>): GameContext {
  return {
    mode: "targetCards",
    targetValue: 3,
    players: [],
    turnOrder: [],
    activeIndex: 0,
    deck: [card("d", 1999)],
    currentCard: null,
    placement: null,
    counters: [],
    pendingCounterIds: [],
    resolution: null,
    roundsCompleted: 0,
    turnsThisRound: 0,
    winnerId: null,
    ...partial,
  };
}

describe("isGameOver — targetCards", () => {
  it("is true when a player reached the card target", () => {
    const c = ctx({
      mode: "targetCards",
      targetValue: 3,
      players: [player("A", 3, 1), player("B", 1, 2)],
      turnOrder: ["A", "B"],
    });
    expect(isGameOver(c)).toBe(true);
  });
  it("is false when nobody reached the target and deck has cards", () => {
    const c = ctx({
      mode: "targetCards",
      targetValue: 3,
      players: [player("A", 2, 1), player("B", 1, 2)],
      turnOrder: ["A", "B"],
    });
    expect(isGameOver(c)).toBe(false);
  });
});

describe("isGameOver — fixedRounds", () => {
  it("is true once the configured rounds are completed", () => {
    const c = ctx({
      mode: "fixedRounds",
      targetValue: 5,
      roundsCompleted: 5,
      players: [player("A", 1, 1)],
      turnOrder: ["A"],
    });
    expect(isGameOver(c)).toBe(true);
  });
  it("is false before the rounds are completed", () => {
    const c = ctx({
      mode: "fixedRounds",
      targetValue: 5,
      roundsCompleted: 4,
      players: [player("A", 1, 1)],
      turnOrder: ["A"],
    });
    expect(isGameOver(c)).toBe(false);
  });
});

describe("isGameOver — empty deck", () => {
  it("is true when the draw pile is empty", () => {
    const c = ctx({
      mode: "fixedRounds",
      targetValue: 99,
      deck: [],
      players: [player("A", 1, 1)],
      turnOrder: ["A"],
    });
    expect(isGameOver(c)).toBe(true);
  });
});

describe("determineWinner", () => {
  it("picks the player with the most scored cards", () => {
    const c = ctx({
      players: [player("A", 1, 0), player("B", 3, 0)],
      turnOrder: ["A", "B"],
    });
    expect(determineWinner(c)).toBe("B");
  });
  it("breaks card ties by remaining tokens", () => {
    const c = ctx({
      players: [player("A", 2, 1), player("B", 2, 3)],
      turnOrder: ["A", "B"],
    });
    expect(determineWinner(c)).toBe("B");
  });
  it("breaks card+token ties by turn order", () => {
    const c = ctx({
      players: [player("A", 2, 2), player("B", 2, 2)],
      turnOrder: ["A", "B"],
    });
    expect(determineWinner(c)).toBe("A");
  });
  it("returns null when there are no players", () => {
    expect(determineWinner(ctx({ players: [], turnOrder: [] }))).toBeNull();
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/engine/__tests__/win.test.ts`
Expected: FAIL — `Cannot find module '../win'`.

- [ ] **Step 3: `win.ts` implementieren**

`lib/engine/win.ts`:
```ts
import type { GameContext } from "./types";
import { scoredCardCount } from "./timeline";

export function isGameOver(context: GameContext): boolean {
  if (context.mode === "targetCards") {
    const reached = context.players.some(
      (p) => scoredCardCount(p) >= context.targetValue,
    );
    if (reached) return true;
  } else {
    if (context.roundsCompleted >= context.targetValue) return true;
  }
  return context.deck.length === 0;
}

export function determineWinner(context: GameContext): string | null {
  if (context.players.length === 0) return null;
  const orderIndex = (id: string) => context.turnOrder.indexOf(id);
  const ranked = [...context.players].sort((a, b) => {
    const cards = scoredCardCount(b) - scoredCardCount(a);
    if (cards !== 0) return cards;
    if (b.tokens !== a.tokens) return b.tokens - a.tokens;
    return orderIndex(a.id) - orderIndex(b.id);
  });
  return ranked[0].id;
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/engine/__tests__/win.test.ts`
Expected: PASS — alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add lib/engine/win.ts lib/engine/__tests__/win.test.ts
git commit -m "feat: add win conditions and winner determination"
```

---

## Task 4: XState-Machine `gameMachine` (TDD mit `createActor`)

**Files:**
- Create: `lib/engine/machine.ts`
- Test: `lib/engine/__tests__/machine.test.ts`

**Interfaces:**
- Consumes: `evaluateTurn`, `applyResolution` (Task 2); `isGameOver`, `determineWinner` (Task 3); `freeSlots` (Task 1); Typen `GameContext`, `GameEvent`, `GameInput`
- Produces:
  - `gameMachine` — XState-Machine (`setup(...).createMachine(...)`), States: `dealing`, `playing`, `countering`, `reveal`, `betweenTurns`, `drawNext`, `gameOver`
  - States-Werte sind die Strings oben; `context` entspricht `GameContext`.

- [ ] **Step 1: Failing tests schreiben**

`lib/engine/__tests__/machine.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createActor } from "xstate";
import { gameMachine } from "../machine";
import type { Card, GameInput } from "../types";

function card(id: string, year: number): Card {
  return {
    id,
    uri: `spotify:track:${id}`,
    title: `t-${id}`,
    artist: `a-${id}`,
    year,
    yearSource: "musicbrainz",
    coverUrl: null,
  };
}

// Deck: erst Anker (1 pro Spieler), dann Mystery-Karten in Ziehreihenfolge.
function soloInput(): GameInput {
  return {
    players: [{ id: "A", name: "Anna" }],
    mode: "targetCards",
    targetValue: 2,
    startTokens: 2,
    deck: [
      card("anchorA", 1980), // Anker A
      card("m1", 1970), // 1. Mystery (gehört vor 1980 → Slot 0)
      card("m2", 1990), // 2. Mystery
      card("m3", 2000), // Reserve
    ],
  };
}

function start(input: GameInput) {
  const actor = createActor(gameMachine, { input });
  actor.start();
  return actor;
}

describe("dealing", () => {
  it("deals one anchor per player and draws the first mystery card", () => {
    const actor = start(soloInput());
    const s = actor.getSnapshot();
    expect(s.value).toBe("playing");
    expect(s.context.players[0].timeline.map((c) => c.id)).toEqual(["anchorA"]);
    expect(s.context.currentCard?.id).toBe("m1");
  });
});

describe("solo turn (no countering)", () => {
  it("goes playing → reveal on PLACE (skips countering for 1 player)", () => {
    const actor = start(soloInput());
    actor.send({ type: "PLACE", slot: 0 }); // 1970 vor 1980 → korrekt
    const s = actor.getSnapshot();
    expect(s.value).toBe("reveal");
    expect(s.context.resolution?.winnerId).toBe("A");
  });

  it("CONTINUE applies a token claim and starts the next turn", () => {
    const actor = start(soloInput());
    actor.send({ type: "PLACE", slot: 0 });
    actor.send({ type: "CONTINUE", claimedCorrect: true });
    const s = actor.getSnapshot();
    expect(s.context.players[0].tokens).toBe(3); // 2 + 1
    expect(s.value).toBe("playing");
    expect(s.context.currentCard?.id).toBe("m2");
    // A hat jetzt 1 gewertete Karte (m1) + Anker
    expect(s.context.players[0].timeline.length).toBe(2);
  });

  it("reaches gameOver when the card target is met", () => {
    const actor = start(soloInput()); // targetValue 2
    // Zug 1: m1 (1970) vor Anker 1980 → Slot 0 korrekt
    actor.send({ type: "PLACE", slot: 0 });
    actor.send({ type: "CONTINUE", claimedCorrect: false });
    // Zug 2: m2 (1990); Timeline [1970,1980] → Slot 2 (nach 1980) korrekt
    actor.send({ type: "PLACE", slot: 2 });
    actor.send({ type: "CONTINUE", claimedCorrect: false });
    const s = actor.getSnapshot();
    expect(s.value).toBe("gameOver");
    expect(s.context.winnerId).toBe("A");
    expect(s.status).toBe("done");
  });
});

describe("skip (unplayable track)", () => {
  it("draws a new card for the same player without advancing the turn", () => {
    const actor = start(soloInput());
    expect(actor.getSnapshot().context.currentCard?.id).toBe("m1");
    actor.send({ type: "SKIP" });
    const s = actor.getSnapshot();
    expect(s.value).toBe("playing");
    expect(s.context.currentCard?.id).toBe("m2"); // nächste Karte
    expect(s.context.activeIndex).toBe(0); // gleicher Spieler
    expect(s.context.turnsThisRound).toBe(0); // kein Zug verbraucht
  });
});

describe("two-player turn (countering)", () => {
  function duoInput(): GameInput {
    return {
      players: [
        { id: "A", name: "Anna" },
        { id: "B", name: "Ben" },
      ],
      mode: "targetCards",
      targetValue: 10,
      startTokens: 2,
      deck: [
        card("anchorA", 1980),
        card("anchorB", 1995),
        card("m1", 1970), // Mystery für A; A-Timeline [1980] → Slot 0 korrekt
        card("m2", 2010),
        card("m3", 1960),
      ],
    };
  }

  it("enters countering after PLACE and lets B counter, then reveals", () => {
    const actor = start(duoInput());
    actor.send({ type: "PLACE", slot: 1 }); // falsch: 1970 nicht nach 1980
    expect(actor.getSnapshot().value).toBe("countering");
    expect(actor.getSnapshot().context.pendingCounterIds).toEqual(["B"]);

    actor.send({ type: "COUNTER", slot: 0 }); // B: 1970 vor 1980 → korrekt
    const s = actor.getSnapshot();
    expect(s.value).toBe("reveal");
    expect(s.context.resolution?.winnerId).toBe("B");
    // B hat einen Token ausgegeben
    expect(s.context.players.find((p) => p.id === "B")!.tokens).toBe(1);
  });

  it("PASS skips the counter and reveals with discard if active was wrong", () => {
    const actor = start(duoInput());
    actor.send({ type: "PLACE", slot: 1 }); // A falsch
    actor.send({ type: "PASS" });
    const s = actor.getSnapshot();
    expect(s.value).toBe("reveal");
    expect(s.context.resolution?.winnerId).toBeNull();
  });

  it("rotates the active player and counts rounds after CONTINUE", () => {
    const actor = start(duoInput());
    actor.send({ type: "PLACE", slot: 0 }); // A korrekt
    actor.send({ type: "PASS" }); // B kontert nicht
    actor.send({ type: "CONTINUE", claimedCorrect: false });
    const s = actor.getSnapshot();
    expect(s.value).toBe("playing");
    expect(s.context.activeIndex).toBe(1); // jetzt B am Zug
    expect(s.context.turnsThisRound).toBe(1);
    expect(s.context.currentCard?.id).toBe("m2");
  });
});

describe("counter guard", () => {
  it("ignores a COUNTER from a player without tokens", () => {
    const input: GameInput = {
      players: [
        { id: "A", name: "A" },
        { id: "B", name: "B" },
      ],
      mode: "targetCards",
      targetValue: 10,
      startTokens: 0, // niemand hat Token
      deck: [card("anchorA", 1980), card("anchorB", 1995), card("m1", 1970), card("x", 2001)],
    };
    const actor = start(input);
    actor.send({ type: "PLACE", slot: 1 });
    actor.send({ type: "COUNTER", slot: 0 }); // ungültig (kein Token)
    // Queue unverändert, weiterhin in countering
    expect(actor.getSnapshot().value).toBe("countering");
    expect(actor.getSnapshot().context.counters).toEqual([]);
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/engine/__tests__/machine.test.ts`
Expected: FAIL — `Cannot find module '../machine'`.

- [ ] **Step 3: Machine implementieren**

`lib/engine/machine.ts`:
```ts
import { setup, assign, assertEvent } from "xstate";
import type { GameContext, GameEvent, GameInput } from "./types";
import { evaluateTurn, applyResolution } from "./evaluate";
import { isGameOver, determineWinner } from "./win";

function initialContext(input: GameInput): GameContext {
  return {
    mode: input.mode,
    targetValue: input.targetValue,
    players: input.players.map((p) => ({
      id: p.id,
      name: p.name,
      tokens: input.startTokens,
      timeline: [],
    })),
    turnOrder: input.players.map((p) => p.id),
    activeIndex: 0,
    deck: [...input.deck],
    currentCard: null,
    placement: null,
    counters: [],
    pendingCounterIds: [],
    resolution: null,
    roundsCompleted: 0,
    turnsThisRound: 0,
    winnerId: null,
  };
}

export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
    input: {} as GameInput,
  },
  actions: {
    dealAndStart: assign(({ context }) => {
      const deck = [...context.deck];
      const players = context.players.map((p) => {
        const anchor = deck.shift();
        return { ...p, timeline: anchor ? [anchor] : [] };
      });
      const currentCard = deck.shift() ?? null;
      return { deck, players, currentCard };
    }),

    recordPlacement: assign(({ context, event }) => {
      assertEvent(event, "PLACE");
      return {
        placement: {
          playerId: context.turnOrder[context.activeIndex],
          slot: event.slot,
        },
      };
    }),

    setupCounterQueue: assign(({ context }) => {
      const n = context.turnOrder.length;
      const order: string[] = [];
      for (let i = 1; i < n; i++) {
        order.push(context.turnOrder[(context.activeIndex + i) % n]);
      }
      return { pendingCounterIds: order, counters: [] };
    }),

    recordCounter: assign(({ context, event }) => {
      assertEvent(event, "COUNTER");
      const counterer = context.pendingCounterIds[0];
      return {
        players: context.players.map((p) =>
          p.id === counterer ? { ...p, tokens: p.tokens - 1 } : p,
        ),
        counters: [...context.counters, { playerId: counterer, slot: event.slot }],
        pendingCounterIds: context.pendingCounterIds.slice(1),
      };
    }),

    skipCounter: assign(({ context }) => ({
      pendingCounterIds: context.pendingCounterIds.slice(1),
    })),

    evaluate: assign(({ context }) => {
      const active = context.players[context.activeIndex];
      const card = context.currentCard!;
      const resolution = evaluateTurn(
        active.timeline,
        context.placement!.slot,
        context.counters,
        card,
        active.id,
      );
      return {
        resolution,
        players: applyResolution(context.players, resolution),
      };
    }),

    applyTokenClaim: assign(({ context, event }) => {
      assertEvent(event, "CONTINUE");
      if (!event.claimedCorrect) return {};
      const activeId = context.turnOrder[context.activeIndex];
      return {
        players: context.players.map((p) =>
          p.id === activeId ? { ...p, tokens: p.tokens + 1 } : p,
        ),
      };
    }),

    advanceTurn: assign(({ context }) => {
      const turnsThisRound = context.turnsThisRound + 1;
      const completedRound = turnsThisRound >= context.turnOrder.length;
      return {
        activeIndex: (context.activeIndex + 1) % context.turnOrder.length,
        turnsThisRound: completedRound ? 0 : turnsThisRound,
        roundsCompleted: completedRound
          ? context.roundsCompleted + 1
          : context.roundsCompleted,
        placement: null,
        counters: [],
        pendingCounterIds: [],
        resolution: null,
      };
    }),

    drawCard: assign(({ context }) => {
      const deck = [...context.deck];
      const currentCard = deck.shift() ?? null;
      return { deck, currentCard };
    }),

    setWinner: assign(({ context }) => ({
      winnerId: determineWinner(context),
    })),
  },
  guards: {
    hasOtherPlayers: ({ context }) => context.turnOrder.length > 1,
    counterQueueEmpty: ({ context }) => context.pendingCounterIds.length === 0,
    isGameOver: ({ context }) => isGameOver(context),
    canCounter: ({ context, event }) => {
      if (event.type !== "COUNTER") return false;
      const counterer = context.pendingCounterIds[0];
      if (!counterer) return false;
      const player = context.players.find((p) => p.id === counterer);
      if (!player || player.tokens < 1) return false;
      const active = context.players[context.activeIndex];
      const len = active.timeline.length;
      if (event.slot < 0 || event.slot > len) return false;
      const taken = new Set<number>([
        context.placement?.slot ?? -1,
        ...context.counters.map((c) => c.slot),
      ]);
      return !taken.has(event.slot);
    },
  },
}).createMachine({
  id: "hitster",
  context: ({ input }) => initialContext(input),
  initial: "dealing",
  states: {
    dealing: {
      entry: "dealAndStart",
      always: "playing",
    },
    playing: {
      on: {
        PLACE: [
          {
            guard: "hasOtherPlayers",
            target: "countering",
            actions: "recordPlacement",
          },
          { target: "reveal", actions: "recordPlacement" },
        ],
        // Unspielbare Karte (§8): verwerfen und neue ziehen, gleicher Spieler bleibt am Zug
        SKIP: { target: "drawNext" },
      },
    },
    countering: {
      entry: "setupCounterQueue",
      always: { guard: "counterQueueEmpty", target: "reveal" },
      on: {
        COUNTER: { guard: "canCounter", actions: "recordCounter" },
        PASS: { actions: "skipCounter" },
      },
    },
    reveal: {
      entry: "evaluate",
      on: {
        CONTINUE: { target: "betweenTurns", actions: "applyTokenClaim" },
      },
    },
    betweenTurns: {
      entry: "advanceTurn",
      always: [
        { guard: "isGameOver", target: "gameOver" },
        { target: "drawNext" },
      ],
    },
    drawNext: {
      entry: "drawCard",
      always: "playing",
    },
    gameOver: {
      entry: "setWinner",
      type: "final",
    },
  },
});
```

> **Hinweis zum Konter-Queue-Eintritt:** `setupCounterQueue` läuft beim Eintritt in `countering`, danach wird `always` ausgewertet. Bei `hasOtherPlayers` ist die Queue zu diesem Zeitpunkt nicht leer, also greift `always` erst, nachdem die letzte `COUNTER`/`PASS`-Transition die Queue geleert hat. Eventless-Transitions werden in XState v5 nach jeder Transition neu geprüft.

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/engine/__tests__/machine.test.ts`
Expected: PASS — alle Tests grün.

- [ ] **Step 5: Voller Engine-Test-Lauf**

Run: `npx vitest run lib/engine`
Expected: alle Engine-Tests (timeline, evaluate, win, machine) grün.

- [ ] **Step 6: Commit**

```bash
git add lib/engine/machine.ts lib/engine/__tests__/machine.test.ts
git commit -m "feat: add XState game machine (turn loop, countering, scoring, win)"
```

---

## Task 5: React-Hook `useGameEngine` + Selektoren

**Files:**
- Create: `lib/engine/useGameEngine.ts`
- Create: `lib/engine/selectors.ts`
- Test: `lib/engine/__tests__/selectors.test.ts`

**Interfaces:**
- Consumes: `gameMachine` (Task 4); Typen `GameContext`, `GameEvent`, `GameInput`
- Produces:
  - `useGameEngine(input: GameInput)` → `{ snapshot, send, context, phase }`
  - Typ `Phase = "playing" | "countering" | "reveal" | "gameOver" | "dealing" | "betweenTurns" | "drawNext"`
  - Selektoren (rein, ohne React): `activePlayer(context)`, `currentCountererId(context)`, `availableSlots(context)`

> Der Hook ist die **einzige** `"use client"`-Datei in `lib/engine`. Selektoren sind rein und damit testbar; die UI (Plan 5) nutzt sie zusammen mit `context`.

- [ ] **Step 1: Failing tests für Selektoren schreiben**

`lib/engine/__tests__/selectors.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { activePlayer, currentCountererId, availableSlots } from "../selectors";
import type { Card, GameContext, Player } from "../types";

function card(id: string, year: number): Card {
  return { id, uri: `spotify:track:${id}`, title: id, artist: id, year, yearSource: "musicbrainz", coverUrl: null };
}
function player(id: string, years: number[]): Player {
  return { id, name: id, tokens: 2, timeline: years.map((y, i) => card(`${id}-${i}`, y)) };
}
function ctx(p: Partial<GameContext>): GameContext {
  return {
    mode: "targetCards", targetValue: 10,
    players: [], turnOrder: [], activeIndex: 0,
    deck: [], currentCard: null, placement: null, counters: [],
    pendingCounterIds: [], resolution: null,
    roundsCompleted: 0, turnsThisRound: 0, winnerId: null, ...p,
  };
}

describe("activePlayer", () => {
  it("returns the player at activeIndex", () => {
    const c = ctx({ players: [player("A", [1980]), player("B", [1990])], turnOrder: ["A", "B"], activeIndex: 1 });
    expect(activePlayer(c).id).toBe("B");
  });
});

describe("currentCountererId", () => {
  it("returns the head of the counter queue, or null", () => {
    expect(currentCountererId(ctx({ pendingCounterIds: ["B", "C"] }))).toBe("B");
    expect(currentCountererId(ctx({ pendingCounterIds: [] }))).toBeNull();
  });
});

describe("availableSlots", () => {
  it("lists all slots of the active timeline minus taken ones", () => {
    const c = ctx({
      players: [player("A", [1980, 2000])], // Timeline-Länge 2 → Slots 0..2
      turnOrder: ["A"],
      activeIndex: 0,
      placement: { playerId: "A", slot: 1 },
    });
    expect(availableSlots(c)).toEqual([0, 2]);
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/engine/__tests__/selectors.test.ts`
Expected: FAIL — `Cannot find module '../selectors'`.

- [ ] **Step 3: Selektoren implementieren**

`lib/engine/selectors.ts`:
```ts
import type { GameContext, Player } from "./types";
import { freeSlots } from "./timeline";

export function activePlayer(context: GameContext): Player {
  return context.players[context.activeIndex];
}

export function currentCountererId(context: GameContext): string | null {
  return context.pendingCounterIds[0] ?? null;
}

/** Freie Slots in der Timeline des aktiven Spielers (für Platzierung/Konter). */
export function availableSlots(context: GameContext): number[] {
  const active = activePlayer(context);
  const taken = [
    context.placement?.slot ?? -1,
    ...context.counters.map((c) => c.slot),
  ];
  return freeSlots(active.timeline.length, taken);
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/engine/__tests__/selectors.test.ts`
Expected: PASS — alle Tests grün.

- [ ] **Step 5: Hook implementieren**

`lib/engine/useGameEngine.ts`:
```ts
"use client";

import { useMachine } from "@xstate/react";
import { gameMachine } from "./machine";
import type { GameInput } from "./types";

export type Phase =
  | "dealing"
  | "playing"
  | "countering"
  | "reveal"
  | "betweenTurns"
  | "drawNext"
  | "gameOver";

export function useGameEngine(input: GameInput) {
  const [snapshot, send] = useMachine(gameMachine, { input });
  return {
    snapshot,
    send,
    context: snapshot.context,
    phase: snapshot.value as Phase,
  };
}
```

- [ ] **Step 6: Typecheck + voller Test-Lauf + Build**

Run: `npm test && npm run build`
Expected: alle Tests grün; Build erfolgreich (der `"use client"`-Hook compiliert sauber).

- [ ] **Step 7: Commit**

```bash
git add lib/engine/useGameEngine.ts lib/engine/selectors.ts lib/engine/__tests__/selectors.test.ts
git commit -m "feat: add useGameEngine hook and engine selectors"
```

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung (§5):** Setup via `GameInput` (§5.1); Anker-Austeilen ohne Kartenziel-Wertung (`scoredCardCount`, Task 1/3); Phasen `playing/countering/reveal/scoring/nextTurn/gameOver` (Task 4 + Mapping-Tabelle); relative Platzierung (`slotIsCorrect`, Task 1); Konter mit Token reihum, Slot-Eindeutigkeit, Auswertung A→Konter→Verwerfen (`evaluateTurn` Task 2, `canCounter`/`setupCounterQueue` Task 4); Token-Verdienen per Selbstbestätigung (`applyTokenClaim`/`CONTINUE`, Task 4); Solo überspringt Konter (`hasOtherPlayers`-Guard); beide Win-Modi inkl. Gleichstand-Tiebreak (`win.ts`, Task 3); unspielbare Karte überspringen (`SKIP`, §8 — gleiche Spieler-Zugfortsetzung, Task 4). ✓
- **Platzhalter:** keine; jeder Code-Step enthält vollständigen Code. ✓
- **Typ-Konsistenz:** `Card`/`Player`/`GameContext`/`GameInput`/`Resolution` zentral in `types.ts`; `evaluateTurn`-Signatur identisch zwischen Task 2 (Definition) und Task 4 (Aufruf in `evaluate`-Action); `slotIsCorrect`/`insertSorted`/`freeSlots`/`scoredCardCount` konsistent benannt über Tasks 1–5; State-Strings (`playing`,`countering`,`reveal`,`gameOver`) decken sich mit dem `Phase`-Typ in Task 5. ✓
- **Scope:** nur Engine + Hook. `Card`-Erzeugung (Spotify+MusicBrainz) ist Plan 4; das Rendern und Verdrahten der Phasen ist Plan 5. Die `GameInput`-Schnittstelle ist der Übergabepunkt zu Plan 4/5.
```
