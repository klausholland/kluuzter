# Hitster Webapp — Plan 5: UI / Screens (Setup, Gameplay, Konter, Reveal, Game Over)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle Spielbildschirme bauen und die Spiel-Engine (Plan 3) mit dem Spotify-Datenfluss/Playback (Plan 4) zu einem spielbaren, mobile-first responsiven Spiel verdrahten.

**Architecture:** Eine einzige Client-Komponente `GameApp` steuert die Szenen (Setup → „Deck wird vorbereitet" → Spiel inkl. Game Over) über React-State — kein Routenwechsel, damit Deck & Konfiguration ohne Persistenz von Szene zu Szene reichen. Die UI sendet ausschließlich Events in die Engine (`useGameEngine`) und rendert deren `context`/`phase`; die Wiedergabe läuft über `useSpotifyPlayer` + `playTrack`. Präsentationskomponenten (Card, Slot, Timeline, PlayerBar) sind dumm und konsumieren nur Props.

**Tech Stack:** React 19, Next.js 16 App Router, Tailwind CSS v4, @testing-library/react 16.3.2 + jsdom 29.1.1 + @vitejs/plugin-react 6.0.2 (Tests, bewusst minimal).

## Global Constraints

- Node 24 (`nvm use 24` vor allen npm/node-Befehlen; Dev-Server `next dev -H 127.0.0.1`)
- React 19 / Next 16 / Tailwind v4 (Versionen aus Plan 1)
- **Mobile-first & responsive** (Smartphone/Tablet/Desktop, Hoch- & Querformat). Einsetzen per **Tap auf einen Slot** (kein Drag); Touch-Trefferflächen ≥ ~44px; Timeline auf kleinen Screens horizontal scrollbar.
- UI-Tests bewusst minimal (Spec §9) — Komponenten konsumieren nur Engine-State.
- Karten im Hitster-Stil: **Interpret oben, großes Jahr in der Mitte, Songtitel unten**.
- Es wird **nichts persistiert** (kein Highscore/Spielstand).

## Konsumierte Schnittstellen aus früheren Plänen

```ts
// Plan 3 — lib/engine/types.ts
export type Card = { id: string; uri: string; title: string; artist: string; year: number; yearSource: "musicbrainz" | "spotify"; coverUrl: string | null };
export type GameMode = "targetCards" | "fixedRounds";
export type Player = { id: string; name: string; tokens: number; timeline: Card[] };
export type GameInput = { players: { id: string; name: string }[]; mode: GameMode; targetValue: number; startTokens: number; deck: Card[] };

// Plan 3 — lib/engine/useGameEngine.ts
export function useGameEngine(input: GameInput): { snapshot; send; context: GameContext; phase: Phase };
// Plan 3 — lib/engine/selectors.ts
export function activePlayer(context): Player;
export function currentCountererId(context): string | null;
export function availableSlots(context): number[];
// Plan 3 — lib/engine/timeline.ts
export function scoredCardCount(player: Player): number;

// Plan 4 — lib/spotify/useSpotifyPlayer.ts
export function useSpotifyPlayer(): { deviceId: string | null; ready: boolean; error: string | null; playback: PlaybackState | null; togglePlay: () => void };
// Plan 4 — lib/spotify/playback.ts
export function playTrack(token: string, deviceId: string, uri: string, fetchImpl?): Promise<void>;
// Plan 4 — Routes: GET /api/spotify/token, GET /api/spotify/playlists[?q=], POST /api/deck
```

## File Structure

- `components/game/Card.tsx` — Hitster-Karte (Interpret/Jahr/Titel), Mystery-Variante
- `components/game/Slot.tsx` — „+"-Einsetz-Slot (tappbar, ≥44px)
- `components/game/Timeline.tsx` — horizontale, scrollbare Timeline mit Slots
- `components/game/PlayerBar.tsx` — Mitspieler-Leiste oben
- `components/game/PlaybackControls.tsx` — Play/Pause + Fortschrittsbalken
- `components/game/CounterOverlay.tsx` — Konter-Fenster
- `components/game/RevealOverlay.tsx` — Aufdecken + Token-Selbstbestätigung
- `components/game/GameOverScreen.tsx` — Endstand
- `components/game/GameScreen.tsx` — verdrahtet Engine + Playback + Phasen
- `components/game/DeckLoading.tsx` — „Deck wird vorbereitet"
- `components/game/GameApp.tsx` — Szenen-Orchestrierung (`"use client"`)
- `components/game/game-setup.ts` — reine Helfer (`buildGameInput`, `minTracksNeeded`)
- `components/setup/SetupScreen.tsx` — Spieler/Modus/Token/Playlist-Auswahl
- `components/setup/PlaylistPicker.tsx` — Playlists laden/suchen/auswählen
- `app/play/page.tsx` — Server-Route (Auth/Premium-Gate) → rendert `GameApp`
- Modify: `app/page.tsx` — Link „Spiel starten" zu `/play`
- Modify: `vitest.config.ts` — jsdom/tsx-Tests aktivieren
- Tests unter `components/**/__tests__/`

## Lokale Typen

```ts
// components/game/game-setup.ts
import type { Card, GameInput, GameMode } from "@/lib/engine/types";

export type SetupConfig = {
  players: { id: string; name: string }[];
  mode: GameMode;
  targetValue: number;
  startTokens: number;
  playlistIds: string[];
};
```

---

## Task 1: Test-Infrastruktur (jsdom + Testing Library) + Card-Komponente

**Files:**
- Modify: `package.json` (devDeps `@testing-library/react`, `@testing-library/dom`, `jsdom`, `@vitejs/plugin-react`)
- Modify: `vitest.config.ts`
- Create: `components/game/Card.tsx`
- Test: `components/game/__tests__/Card.test.tsx`

**Interfaces:**
- Consumes: `Card` (Plan 3, `@/lib/engine/types`)
- Produces: `GameCard({ card, hideYear? }: { card: Card; hideYear?: boolean })`

- [ ] **Step 1: Test-Dependencies installieren**

```bash
nvm use 24
npm install -D @testing-library/react@16.3.2 @testing-library/dom@10.4.1 jsdom@29.1.1 @vitejs/plugin-react@6.0.2
```

- [ ] **Step 2: Vitest-Konfiguration für tsx/jsdom anpassen**

`vitest.config.ts` (ersetzt den bisherigen Inhalt):
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // Standard bleibt node; Komponententests setzen `// @vitest-environment jsdom` oben in der Datei.
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    globals: true,
  },
});
```

- [ ] **Step 3: Failing test schreiben**

`components/game/__tests__/Card.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GameCard } from "../Card";
import type { Card } from "@/lib/engine/types";

afterEach(cleanup);

const card: Card = {
  id: "t1",
  uri: "spotify:track:t1",
  title: "Sultans of Swing",
  artist: "Dire Straits",
  year: 1978,
  yearSource: "musicbrainz",
  coverUrl: null,
};

describe("GameCard", () => {
  it("shows artist, year and title when revealed", () => {
    render(<GameCard card={card} />);
    expect(screen.getByText("Dire Straits")).toBeTruthy();
    expect(screen.getByText("1978")).toBeTruthy();
    expect(screen.getByText("Sultans of Swing")).toBeTruthy();
  });

  it("hides the year when hideYear is set", () => {
    render(<GameCard card={card} hideYear />);
    expect(screen.queryByText("1978")).toBeNull();
    expect(screen.getByText("?")).toBeTruthy();
  });

  it("marks a spotify-sourced year as approximate", () => {
    render(<GameCard card={{ ...card, yearSource: "spotify" }} />);
    expect(screen.getByText(/ungenau/)).toBeTruthy();
  });
});
```

- [ ] **Step 4: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run components/game/__tests__/Card.test.tsx`
Expected: FAIL — `Cannot find module '../Card'`.

- [ ] **Step 5: Card-Komponente implementieren**

`components/game/Card.tsx`:
```tsx
import type { Card } from "@/lib/engine/types";

export function GameCard({
  card,
  hideYear = false,
}: {
  card: Card;
  hideYear?: boolean;
}) {
  return (
    <div className="flex aspect-[3/4] w-24 shrink-0 flex-col justify-between rounded-xl bg-gradient-to-br from-fuchsia-600 to-indigo-700 p-2 text-center shadow-lg sm:w-28">
      <p className="truncate text-[11px] font-semibold text-white/90">
        {card.artist}
      </p>
      <p className="text-3xl font-black text-white">
        {hideYear ? "?" : card.year}
      </p>
      <div>
        <p className="truncate text-[11px] text-white/90">{card.title}</p>
        {!hideYear && card.yearSource === "spotify" && (
          <p className="text-[9px] text-amber-200">≈ ungenau</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Test ausführen (muss bestehen)**

Run: `npx vitest run components/game/__tests__/Card.test.tsx`
Expected: PASS — alle Tests grün.

- [ ] **Step 7: Sicherstellen, dass die node-Tests weiterhin laufen**

Run: `npm test`
Expected: alle bisherigen Tests (engine, spotify, musicbrainz, app-auth) + Card-Test grün.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts components/game/Card.tsx components/game/__tests__/Card.test.tsx
git commit -m "feat: add component test infra and Hitster card component"
```

---

## Task 2: Slot- & Timeline-Komponenten

**Files:**
- Create: `components/game/Slot.tsx`
- Create: `components/game/Timeline.tsx`
- Test: `components/game/__tests__/Timeline.test.tsx`

**Interfaces:**
- Consumes: `GameCard` (Task 1); `Card` (Plan 3)
- Produces:
  - `Slot({ index, selected, disabled, onSelect, label? })`
  - `Timeline({ cards, availableSlots, selectedSlot, onSelectSlot, interactive })`

- [ ] **Step 1: Slot-Komponente implementieren**

`components/game/Slot.tsx`:
```tsx
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
  return (
    <button
      type="button"
      aria-label={`Slot ${index}`}
      disabled={disabled}
      onClick={() => onSelect(index)}
      className={`flex h-28 min-w-[44px] shrink-0 items-center justify-center rounded-lg border-2 border-dashed text-xl transition sm:h-32 ${
        selected
          ? "border-green-400 bg-green-400/20 text-green-300"
          : "border-neutral-600 text-neutral-500"
      } disabled:opacity-25`}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Failing test für die Timeline schreiben**

`components/game/__tests__/Timeline.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Timeline } from "../Timeline";
import type { Card } from "@/lib/engine/types";

afterEach(cleanup);

function card(id: string, year: number): Card {
  return { id, uri: `spotify:track:${id}`, title: id, artist: id, year, yearSource: "musicbrainz", coverUrl: null };
}

const cards = [card("a", 1970), card("b", 2000)];

describe("Timeline", () => {
  it("renders length+1 slots for the given cards", () => {
    render(
      <Timeline cards={cards} availableSlots={[0, 1, 2]} selectedSlot={null} onSelectSlot={() => {}} interactive />,
    );
    // 2 Karten → 3 Slots
    expect(screen.getAllByLabelText(/^Slot /)).toHaveLength(3);
  });

  it("calls onSelectSlot with the slot index on tap", () => {
    const onSelect = vi.fn();
    render(
      <Timeline cards={cards} availableSlots={[0, 1, 2]} selectedSlot={null} onSelectSlot={onSelect} interactive />,
    );
    fireEvent.click(screen.getByLabelText("Slot 1"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("disables slots that are not available", () => {
    render(
      <Timeline cards={cards} availableSlots={[0, 2]} selectedSlot={null} onSelectSlot={() => {}} interactive />,
    );
    expect((screen.getByLabelText("Slot 1") as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 3: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run components/game/__tests__/Timeline.test.tsx`
Expected: FAIL — `Cannot find module '../Timeline'`.

- [ ] **Step 4: Timeline-Komponente implementieren**

`components/game/Timeline.tsx`:
```tsx
import type { Card } from "@/lib/engine/types";
import { GameCard } from "./Card";
import { Slot } from "./Slot";

export function Timeline({
  cards,
  availableSlots,
  selectedSlot,
  onSelectSlot,
  interactive,
}: {
  cards: Card[];
  availableSlots: number[];
  selectedSlot: number | null;
  onSelectSlot: (slot: number) => void;
  interactive: boolean;
}) {
  const free = new Set(availableSlots);
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i <= cards.length; i++) {
    nodes.push(
      <Slot
        key={`slot-${i}`}
        index={i}
        selected={selectedSlot === i}
        disabled={!interactive || !free.has(i)}
        onSelect={onSelectSlot}
      />,
    );
    if (i < cards.length) {
      nodes.push(<GameCard key={cards[i].id} card={cards[i]} />);
    }
  }
  return (
    <div className="flex items-center gap-1 overflow-x-auto px-3 py-4">
      {nodes}
    </div>
  );
}
```

- [ ] **Step 5: Test ausführen (muss bestehen)**

Run: `npx vitest run components/game/__tests__/Timeline.test.tsx`
Expected: PASS — alle Tests grün.

- [ ] **Step 6: Commit**

```bash
git add components/game/Slot.tsx components/game/Timeline.tsx components/game/__tests__/Timeline.test.tsx
git commit -m "feat: add slot and timeline components"
```

---

## Task 3: PlayerBar & PlaybackControls

**Files:**
- Create: `components/game/PlayerBar.tsx`
- Create: `components/game/PlaybackControls.tsx`

**Interfaces:**
- Consumes: `Player` + `scoredCardCount` (Plan 3); `PlaybackState` (Plan 4)
- Produces:
  - `PlayerBar({ players, activeIndex })`
  - `PlaybackControls({ playback, onToggle, disabled })`

- [ ] **Step 1: PlayerBar implementieren**

`components/game/PlayerBar.tsx`:
```tsx
import type { Player } from "@/lib/engine/types";
import { scoredCardCount } from "@/lib/engine/timeline";

export function PlayerBar({
  players,
  activeIndex,
}: {
  players: Player[];
  activeIndex: number;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-neutral-800 px-3 py-2">
      {players.map((p, i) => (
        <div
          key={p.id}
          className={`flex shrink-0 flex-col rounded-lg px-3 py-1 text-sm ${
            i === activeIndex
              ? "bg-green-600/30 ring-1 ring-green-400"
              : "bg-neutral-800"
          }`}
        >
          <span className="font-semibold">{p.name}</span>
          <span className="text-xs text-neutral-300">
            {scoredCardCount(p)} Karten · {p.tokens} Token
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: PlaybackControls implementieren**

`components/game/PlaybackControls.tsx`:
```tsx
import type { PlaybackState } from "@/lib/spotify/useSpotifyPlayer";

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
    <div className="flex w-full max-w-md flex-col items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={paused ? "Abspielen" : "Pausieren"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-2xl disabled:opacity-40"
      >
        {paused ? "▶" : "⏸"}
      </button>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-700">
        <div
          className="h-full bg-green-500 transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build-Check**

Run: `npm run build`
Expected: erfolgreich.

- [ ] **Step 4: Commit**

```bash
git add components/game/PlayerBar.tsx components/game/PlaybackControls.tsx
git commit -m "feat: add player bar and playback controls"
```

---

## Task 4: Setup-Helfer + SetupScreen + PlaylistPicker

**Files:**
- Create: `components/game/game-setup.ts`
- Create: `components/setup/PlaylistPicker.tsx`
- Create: `components/setup/SetupScreen.tsx`
- Test: `components/game/__tests__/game-setup.test.ts`

**Interfaces:**
- Consumes: `SpotifyPlaylistSummary` (Plan 4, `@/lib/spotify/types`); `GameInput`/`Card` (Plan 3)
- Produces:
  - `SetupConfig` (Typ, siehe oben)
  - `buildGameInput(config: SetupConfig, deck: Card[]): GameInput`
  - `minTracksNeeded(config: SetupConfig): number`
  - `SetupScreen({ onStart }: { onStart: (config: SetupConfig) => void })`
  - `PlaylistPicker({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[], totalTracks: number) => void })`

- [ ] **Step 1: Failing test für die reinen Helfer schreiben**

`components/game/__tests__/game-setup.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildGameInput, minTracksNeeded } from "../game-setup";
import type { SetupConfig } from "../game-setup";
import type { Card } from "@/lib/engine/types";

const config: SetupConfig = {
  players: [
    { id: "1", name: "Anna" },
    { id: "2", name: "Ben" },
  ],
  mode: "targetCards",
  targetValue: 10,
  startTokens: 2,
  playlistIds: ["pl1"],
};

const deck: Card[] = [
  { id: "c1", uri: "spotify:track:c1", title: "x", artist: "y", year: 1990, yearSource: "musicbrainz", coverUrl: null },
];

describe("buildGameInput", () => {
  it("combines config and deck into a GameInput", () => {
    expect(buildGameInput(config, deck)).toEqual({
      players: config.players,
      mode: "targetCards",
      targetValue: 10,
      startTokens: 2,
      deck,
    });
  });
});

describe("minTracksNeeded", () => {
  it("accounts for anchors plus target cards times players", () => {
    // 2 Anker + 10 * 2 = 22
    expect(minTracksNeeded(config)).toBe(22);
  });
  it("accounts for anchors plus rounds times players in fixedRounds", () => {
    // 2 Anker + 5 Runden * 2 = 12
    expect(minTracksNeeded({ ...config, mode: "fixedRounds", targetValue: 5 })).toBe(12);
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run components/game/__tests__/game-setup.test.ts`
Expected: FAIL — `Cannot find module '../game-setup'`.

- [ ] **Step 3: Setup-Helfer implementieren**

`components/game/game-setup.ts`:
```ts
import type { Card, GameInput, GameMode } from "@/lib/engine/types";

export type SetupConfig = {
  players: { id: string; name: string }[];
  mode: GameMode;
  targetValue: number;
  startTokens: number;
  playlistIds: string[];
};

export function buildGameInput(config: SetupConfig, deck: Card[]): GameInput {
  return {
    players: config.players,
    mode: config.mode,
    targetValue: config.targetValue,
    startTokens: config.startTokens,
    deck,
  };
}

/** Konservative Mindestanzahl an Tracks: 1 Anker je Spieler + 1 Mystery-Karte je Zug. */
export function minTracksNeeded(config: SetupConfig): number {
  const anchors = config.players.length;
  return anchors + config.targetValue * config.players.length;
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run components/game/__tests__/game-setup.test.ts`
Expected: PASS — beide describe-Blöcke grün.

- [ ] **Step 5: PlaylistPicker implementieren**

`components/setup/PlaylistPicker.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import type { SpotifyPlaylistSummary } from "@/lib/spotify/types";

async function fetchPlaylists(query: string): Promise<SpotifyPlaylistSummary[]> {
  const url = query
    ? `/api/spotify/playlists?q=${encodeURIComponent(query)}`
    : "/api/spotify/playlists";
  const res = await fetch(url);
  if (!res.ok) throw new Error("playlists fetch failed");
  return (await res.json()) as SpotifyPlaylistSummary[];
}

export function PlaylistPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[], totalTracks: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchPlaylists(query)
      .then((p) => active && setPlaylists(p))
      .catch(() => active && setError("Playlists konnten nicht geladen werden."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query]);

  function toggle(p: SpotifyPlaylistSummary) {
    const next = selectedIds.includes(p.id)
      ? selectedIds.filter((id) => id !== p.id)
      : [...selectedIds, p.id];
    const total = playlists
      .filter((pl) => next.includes(pl.id))
      .reduce((sum, pl) => sum + pl.trackCount, 0);
    onChange(next, total);
  }

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Öffentliche Playlists suchen…"
        className="w-full rounded-lg bg-neutral-700 px-3 py-2 outline-none"
      />
      {loading && <p className="text-sm text-neutral-400">Lädt…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {playlists.map((p) => {
          const selected = selectedIds.includes(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggle(p)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left ${
                  selected ? "bg-green-600/30 ring-1 ring-green-400" : "bg-neutral-800"
                }`}
              >
                <span className="truncate">
                  {p.name}
                  <span className="ml-2 text-xs text-neutral-400">
                    {p.trackCount} Tracks · {p.owner}
                  </span>
                </span>
                {selected && <span className="text-green-300">✓</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: SetupScreen implementieren**

`components/setup/SetupScreen.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { GameMode } from "@/lib/engine/types";
import { PlaylistPicker } from "./PlaylistPicker";
import { minTracksNeeded, type SetupConfig } from "@/components/game/game-setup";

type DraftPlayer = { id: string; name: string };

function newPlayer(): DraftPlayer {
  return { id: crypto.randomUUID(), name: "" };
}

export function SetupScreen({
  onStart,
}: {
  onStart: (config: SetupConfig) => void;
}) {
  const [players, setPlayers] = useState<DraftPlayer[]>([
    { id: crypto.randomUUID(), name: "Spieler 1" },
  ]);
  const [mode, setMode] = useState<GameMode>("targetCards");
  const [targetValue, setTargetValue] = useState(10);
  const [startTokens, setStartTokens] = useState(2);
  const [playlistIds, setPlaylistIds] = useState<string[]>([]);
  const [availableTracks, setAvailableTracks] = useState(0);

  const namedPlayers = players
    .map((p) => ({ id: p.id, name: p.name.trim() }))
    .filter((p) => p.name.length > 0);

  const config: SetupConfig = {
    players: namedPlayers,
    mode,
    targetValue,
    startTokens,
    playlistIds,
  };

  const needed = minTracksNeeded(config);
  const tooFewTracks = playlistIds.length > 0 && availableTracks < needed;
  const canStart =
    namedPlayers.length >= 1 && playlistIds.length > 0 && targetValue > 0;

  return (
    <main className="mx-auto max-w-lg space-y-6 p-4">
      <h1 className="text-2xl font-bold">Neues Spiel</h1>

      <section className="space-y-2">
        <h2 className="font-semibold">Spieler (Zugreihenfolge)</h2>
        {players.map((p, i) => (
          <div key={p.id} className="flex gap-2">
            <input
              value={p.name}
              onChange={(e) =>
                setPlayers((prev) =>
                  prev.map((q) => (q.id === p.id ? { ...q, name: e.target.value } : q)),
                )
              }
              placeholder={`Spieler ${i + 1}`}
              className="flex-1 rounded-lg bg-neutral-700 px-3 py-2 outline-none"
            />
            {players.length > 1 && (
              <button
                type="button"
                onClick={() => setPlayers((prev) => prev.filter((q) => q.id !== p.id))}
                className="rounded-lg bg-neutral-700 px-3"
                aria-label="Spieler entfernen"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPlayers((prev) => [...prev, newPlayer()])}
          className="rounded-lg bg-neutral-700 px-3 py-1 text-sm"
        >
          + Spieler hinzufügen
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Modus</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("targetCards")}
            className={`flex-1 rounded-lg px-3 py-2 ${mode === "targetCards" ? "bg-green-600" : "bg-neutral-700"}`}
          >
            X Karten erreichen
          </button>
          <button
            type="button"
            onClick={() => setMode("fixedRounds")}
            className={`flex-1 rounded-lg px-3 py-2 ${mode === "fixedRounds" ? "bg-green-600" : "bg-neutral-700"}`}
          >
            Feste Rundenzahl
          </button>
        </div>
        <label className="block text-sm">
          {mode === "targetCards" ? "Karten zum Sieg" : "Anzahl Runden"}
          <input
            type="number"
            min={1}
            value={targetValue}
            onChange={(e) => setTargetValue(Math.max(1, Number(e.target.value)))}
            className="ml-2 w-20 rounded bg-neutral-700 px-2 py-1"
          />
        </label>
        <label className="block text-sm">
          Start-Token je Spieler
          <input
            type="number"
            min={0}
            value={startTokens}
            onChange={(e) => setStartTokens(Math.max(0, Number(e.target.value)))}
            className="ml-2 w-20 rounded bg-neutral-700 px-2 py-1"
          />
        </label>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Playlists</h2>
        <PlaylistPicker
          selectedIds={playlistIds}
          onChange={(ids, total) => {
            setPlaylistIds(ids);
            setAvailableTracks(total);
          }}
        />
        {tooFewTracks && (
          <p className="text-sm text-amber-400">
            Achtung: ~{availableTracks} Tracks gewählt, empfohlen sind ≥ {needed} für
            diesen Modus.
          </p>
        )}
      </section>

      <button
        type="button"
        disabled={!canStart}
        onClick={() => onStart(config)}
        className="w-full rounded-xl bg-green-600 py-3 text-lg font-semibold disabled:opacity-40"
      >
        Deck vorbereiten & starten
      </button>
    </main>
  );
}
```

- [ ] **Step 7: Build-Check**

Run: `npm run build`
Expected: erfolgreich.

- [ ] **Step 8: Commit**

```bash
git add components/game/game-setup.ts components/setup/PlaylistPicker.tsx components/setup/SetupScreen.tsx components/game/__tests__/game-setup.test.ts
git commit -m "feat: add setup screen, playlist picker and setup helpers"
```

---

## Task 5: GameApp-Orchestrierung + DeckLoading + `/play`-Route

**Files:**
- Create: `components/game/DeckLoading.tsx`
- Create: `components/game/GameApp.tsx`
- Create: `app/play/page.tsx`
- Modify: `app/page.tsx` (Link „Spiel starten")

**Interfaces:**
- Consumes: `SetupScreen`/`SetupConfig` (Task 4); `buildGameInput` (Task 4); `Card`/`GameInput` (Plan 3); `auth` + `fetchProfile`/`isPremium` (Plan 1)
- Produces:
  - `DeckLoading({ config, onReady, onCancel })`
  - `GameApp()` — Szenen-Orchestrierung
  - Route `/play` (Auth- & Premium-Gate)

> **Hinweis:** `GameScreen` (Task 6) existiert beim Bau dieser Task noch nicht. In Schritt 3 wird `GameApp` zunächst mit einem Platzhalter für die „game"-Szene gebaut; Task 6 ersetzt den Platzhalter durch `GameScreen`.

- [ ] **Step 1: DeckLoading implementieren**

`components/game/DeckLoading.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import type { Card } from "@/lib/engine/types";
import type { SetupConfig } from "./game-setup";

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      {error ? (
        <>
          <p className="text-red-400">{error}</p>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-neutral-700 px-4 py-2"
          >
            Zurück
          </button>
        </>
      ) : (
        <>
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-neutral-600 border-t-green-500" />
          <p className="text-lg font-semibold">Deck wird vorbereitet…</p>
          <p className="text-sm text-neutral-400">
            Erscheinungsjahre werden über MusicBrainz angereichert. Das kann je nach
            Playlist-Größe einen Moment dauern.
          </p>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: GameApp mit Platzhalter-Spielszene implementieren**

`components/game/GameApp.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { Card, GameInput } from "@/lib/engine/types";
import { SetupScreen } from "@/components/setup/SetupScreen";
import { DeckLoading } from "./DeckLoading";
import { buildGameInput, type SetupConfig } from "./game-setup";

type Scene =
  | { name: "setup" }
  | { name: "preparing"; config: SetupConfig }
  | { name: "game"; input: GameInput };

export function GameApp() {
  const [scene, setScene] = useState<Scene>({ name: "setup" });

  if (scene.name === "setup") {
    return (
      <SetupScreen
        onStart={(config) => setScene({ name: "preparing", config })}
      />
    );
  }

  if (scene.name === "preparing") {
    return (
      <DeckLoading
        config={scene.config}
        onReady={(deck: Card[]) =>
          setScene({ name: "game", input: buildGameInput(scene.config, deck) })
        }
        onCancel={() => setScene({ name: "setup" })}
      />
    );
  }

  // Platzhalter — wird in Task 6 durch <GameScreen> ersetzt.
  return (
    <main className="p-6">
      <p>Deck bereit: {scene.input.deck.length} Karten.</p>
      <button
        type="button"
        onClick={() => setScene({ name: "setup" })}
        className="mt-4 rounded-lg bg-neutral-700 px-4 py-2"
      >
        Neues Spiel
      </button>
    </main>
  );
}
```

- [ ] **Step 3: `/play`-Route implementieren**

`app/play/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { fetchProfile, isPremium } from "@/lib/spotify/profile";
import { GameApp } from "@/components/game/GameApp";

export default async function PlayPage() {
  const session = await auth();
  if (!session?.accessToken) {
    redirect("/");
  }
  const profile = await fetchProfile(session.accessToken);
  if (!isPremium(profile)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-red-400">
          Spotify Premium ist für die Wiedergabe erforderlich.
        </p>
      </main>
    );
  }
  return <GameApp />;
}
```

- [ ] **Step 4: Link auf der Startseite ergänzen**

In `app/page.tsx` im angemeldeten + Premium-Zweig (nach der Premium-Statuszeile) einen Link einfügen:
```tsx
import Link from "next/link";
// ...
{premium && (
  <Link
    href="/play"
    className="rounded-xl bg-green-600 px-6 py-3 text-lg font-semibold"
  >
    Spiel starten
  </Link>
)}
```

- [ ] **Step 5: Build-Check**

Run: `npm run build`
Expected: erfolgreich; `/play` ist als Route gelistet.

- [ ] **Step 6: Manuelle Verifikation**

Run: `npm run dev` → App-Login + Spotify-Login (Premium) → „Spiel starten" → Setup ausfüllen, Playlist wählen → „Deck vorbereiten" → Ladescreen → Platzhalter „Deck bereit: N Karten."
Expected: Flow bis zur Deck-Bereitschaft funktioniert.

- [ ] **Step 7: Commit**

```bash
git add components/game/DeckLoading.tsx components/game/GameApp.tsx app/play/page.tsx app/page.tsx
git commit -m "feat: add game app scene orchestration, deck loading and /play route"
```

---

## Task 6: GameScreen (Engine + Playback) + Konter/Reveal/Game-Over

**Files:**
- Create: `components/game/CounterOverlay.tsx`
- Create: `components/game/RevealOverlay.tsx`
- Create: `components/game/GameOverScreen.tsx`
- Create: `components/game/GameScreen.tsx`
- Modify: `components/game/GameApp.tsx` (Platzhalter → `GameScreen`)

**Interfaces:**
- Consumes: `useGameEngine`/Selektoren (Plan 3); `useSpotifyPlayer`/`playTrack` (Plan 4); `PlayerBar`/`Timeline`/`PlaybackControls`/`GameCard` (Tasks 1–3); `Player`/`Resolution`/`Card` (Plan 3)
- Produces:
  - `GameScreen({ input, onRestart }: { input: GameInput; onRestart: () => void })`
  - `CounterOverlay`, `RevealOverlay`, `GameOverScreen`

- [ ] **Step 1: CounterOverlay implementieren**

`components/game/CounterOverlay.tsx`:
```tsx
import type { Player } from "@/lib/engine/types";

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
    <div className="fixed inset-x-0 bottom-0 z-20 space-y-3 rounded-t-2xl bg-neutral-800 p-4 shadow-2xl">
      <p className="text-center font-semibold">
        {counterer.name}: Kontern? ({counterer.tokens} Token)
      </p>
      {canCounter ? (
        <>
          <p className="text-center text-sm text-neutral-300">
            1 Token einsetzen und einen freien Slot in der Timeline wählen:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {availableSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => onCounter(slot)}
                className="min-w-[44px] rounded-lg bg-fuchsia-600 px-3 py-2"
              >
                Slot {slot}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-center text-sm text-neutral-400">
          Kein Token oder kein freier Slot — Konter nicht möglich.
        </p>
      )}
      <button
        type="button"
        onClick={onPass}
        className="w-full rounded-lg bg-neutral-700 py-2"
      >
        Passen
      </button>
    </div>
  );
}
```

- [ ] **Step 2: RevealOverlay implementieren**

`components/game/RevealOverlay.tsx`:
```tsx
import type { Player, Resolution } from "@/lib/engine/types";
import { GameCard } from "./Card";

export function RevealOverlay({
  resolution,
  players,
  activePlayerId,
  onContinue,
}: {
  resolution: Resolution;
  players: Player[];
  activePlayerId: string;
  onContinue: (claimedCorrect: boolean) => void;
}) {
  const winner = resolution.winnerId
    ? players.find((p) => p.id === resolution.winnerId)
    : null;

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/80 p-6 text-center">
      <GameCard card={resolution.card} />
      <p className="text-lg font-semibold">
        {resolution.card.title} — {resolution.card.artist} ({resolution.card.year})
      </p>
      <p
        className={
          resolution.activeCorrect ? "text-green-400" : "text-red-400"
        }
      >
        Platzierung des aktiven Spielers:{" "}
        {resolution.activeCorrect ? "richtig" : "falsch"}
      </p>
      {resolution.counters.map((c) => (
        <p key={c.playerId} className={c.correct ? "text-green-400" : "text-red-400"}>
          Konter {players.find((p) => p.id === c.playerId)?.name} (Slot {c.slot}):{" "}
          {c.correct ? "richtig" : "falsch"}
        </p>
      ))}
      <p className="font-bold">
        {winner ? `${winner.name} gewinnt die Karte!` : "Karte wird verworfen."}
      </p>

      <div className="mt-2 w-full max-w-sm space-y-2">
        <p className="text-sm text-neutral-300">
          Hat der aktive Spieler Titel & Interpret laut richtig genannt? (+1 Token)
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onContinue(true)}
            className="flex-1 rounded-lg bg-green-600 py-2"
          >
            Ja, +1 Token
          </button>
          <button
            type="button"
            onClick={() => onContinue(false)}
            className="flex-1 rounded-lg bg-neutral-700 py-2"
          >
            Nein
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: GameOverScreen implementieren**

`components/game/GameOverScreen.tsx`:
```tsx
import type { Player } from "@/lib/engine/types";
import { scoredCardCount } from "@/lib/engine/timeline";

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
    <main className="mx-auto max-w-md space-y-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Spiel beendet</h1>
      <ul className="space-y-2">
        {ranked.map((p) => (
          <li
            key={p.id}
            className={`flex justify-between rounded-lg px-4 py-2 ${
              p.id === winnerId ? "bg-green-600/30 ring-1 ring-green-400" : "bg-neutral-800"
            }`}
          >
            <span className="font-semibold">
              {p.id === winnerId ? "🏆 " : ""}
              {p.name}
            </span>
            <span>
              {scoredCardCount(p)} Karten · {p.tokens} Token
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onRestart}
        className="w-full rounded-xl bg-green-600 py-3 text-lg font-semibold"
      >
        Neue Runde
      </button>
    </main>
  );
}
```

- [ ] **Step 4: GameScreen implementieren**

`components/game/GameScreen.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import type { GameInput } from "@/lib/engine/types";
import { useGameEngine } from "@/lib/engine/useGameEngine";
import {
  activePlayer,
  availableSlots,
  currentCountererId,
} from "@/lib/engine/selectors";
import { useSpotifyPlayer } from "@/lib/spotify/useSpotifyPlayer";
import { playTrack } from "@/lib/spotify/playback";
import { PlayerBar } from "./PlayerBar";
import { Timeline } from "./Timeline";
import { PlaybackControls } from "./PlaybackControls";
import { GameCard } from "./Card";
import { CounterOverlay } from "./CounterOverlay";
import { RevealOverlay } from "./RevealOverlay";
import { GameOverScreen } from "./GameOverScreen";

async function getAccessToken(): Promise<string> {
  const res = await fetch("/api/spotify/token");
  if (!res.ok) throw new Error("token fetch failed");
  return ((await res.json()) as { accessToken: string }).accessToken;
}

export function GameScreen({
  input,
  onRestart,
}: {
  input: GameInput;
  onRestart: () => void;
}) {
  const { send, context, phase } = useGameEngine(input);
  const { deviceId, ready, error, playback, togglePlay } = useSpotifyPlayer();
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const card = context.currentCard;

  // Wiedergabe starten, sobald eine neue Mystery-Karte in der playing-Phase anliegt.
  useEffect(() => {
    if (phase !== "playing" || !deviceId || !card) return;
    let active = true;
    setPlayError(null);
    (async () => {
      try {
        const token = await getAccessToken();
        await playTrack(token, deviceId, card.uri);
      } catch {
        if (active) setPlayError("Track konnte nicht abgespielt werden.");
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, deviceId, card?.id]);

  if (phase === "gameOver") {
    return (
      <GameOverScreen
        players={context.players}
        winnerId={context.winnerId}
        onRestart={onRestart}
      />
    );
  }

  const active = activePlayer(context);
  const slots = availableSlots(context);

  return (
    <div className="flex min-h-screen flex-col">
      <PlayerBar players={context.players} activeIndex={context.activeIndex} />

      {error && (
        <p className="bg-red-900/50 px-3 py-1 text-center text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="flex-1">
        <p className="px-4 pt-3 text-sm text-neutral-400">
          {active.name} ist am Zug — wo gehört der Song hin?
        </p>
        <Timeline
          cards={active.timeline}
          availableSlots={slots}
          selectedSlot={selectedSlot}
          onSelectSlot={(s) => setSelectedSlot(s)}
          interactive={phase === "playing"}
        />
      </div>

      {phase === "playing" && (
        <div className="flex flex-col items-center gap-3 border-t border-neutral-800 p-4">
          {card && <GameCard card={card} hideYear />}
          <PlaybackControls
            playback={playback}
            onToggle={togglePlay}
            disabled={!ready}
          />
          {playError && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-amber-400">{playError}</p>
              <button
                type="button"
                onClick={() => {
                  setPlayError(null);
                  setSelectedSlot(null);
                  send({ type: "SKIP" });
                }}
                className="rounded-lg bg-neutral-700 px-4 py-2 text-sm"
              >
                Karte überspringen
              </button>
            </div>
          )}
          <button
            type="button"
            disabled={selectedSlot === null}
            onClick={() => {
              send({ type: "PLACE", slot: selectedSlot! });
              setSelectedSlot(null);
            }}
            className="w-full max-w-md rounded-xl bg-green-600 py-3 font-semibold disabled:opacity-40"
          >
            Hier einsetzen
          </button>
        </div>
      )}

      {phase === "countering" && (() => {
        const counterId = currentCountererId(context);
        const counterer = context.players.find((p) => p.id === counterId);
        if (!counterer) return null;
        return (
          <CounterOverlay
            counterer={counterer}
            availableSlots={slots}
            onCounter={(slot) => send({ type: "COUNTER", slot })}
            onPass={() => send({ type: "PASS" })}
          />
        );
      })()}

      {phase === "reveal" && context.resolution && (
        <RevealOverlay
          resolution={context.resolution}
          players={context.players}
          activePlayerId={active.id}
          onContinue={(claimedCorrect) =>
            send({ type: "CONTINUE", claimedCorrect })
          }
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Platzhalter in GameApp durch GameScreen ersetzen**

In `components/game/GameApp.tsx` den Import ergänzen und die „game"-Szene ersetzen:
```tsx
import { GameScreen } from "./GameScreen";
```
Den Platzhalter-Block (`// Platzhalter …` bis Ende der Funktion) ersetzen durch:
```tsx
  return (
    <GameScreen
      input={scene.input}
      onRestart={() => setScene({ name: "setup" })}
    />
  );
```

- [ ] **Step 6: Voller Test-Lauf + Build**

Run: `npm test && npm run build`
Expected: alle Tests grün; Build erfolgreich.

- [ ] **Step 7: Manuelle Verifikation (End-to-End, erfordert Premium + Login)**

Run: `npm run dev`
1. App-Login → Spotify-Login (Premium) → „Spiel starten".
2. Setup: 2 Spieler, Modus „X Karten", Playlist wählen → „Deck vorbereiten".
3. Gameplay: Song läuft (Play/Pause + Fortschritt funktionieren), Slot antippen → „Hier einsetzen".
4. Konter-Fenster: zweiter Spieler kann Token einsetzen + Slot wählen oder passen.
5. Reveal: Karte zeigt Jahr/Interpret/Titel, korrekte/falsche Slots markiert, Token-Selbstbestätigung.
6. Spielende: Endstand mit hervorgehobenem Sieger, „Neue Runde" → zurück ins Setup.
Expected: durchgehend spielbar auf Smartphone (Hoch-/Querformat) und Desktop; Timeline horizontal scrollbar; Tap-Trefferflächen ≥ 44px.

- [ ] **Step 8: Commit**

```bash
git add components/game/CounterOverlay.tsx components/game/RevealOverlay.tsx components/game/GameOverScreen.tsx components/game/GameScreen.tsx components/game/GameApp.tsx
git commit -m "feat: wire game screen (engine + playback, countering, reveal, game over)"
```

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung (§7):** App-/Spotify-Login (Plan 1, hier Link auf `/play`, Task 5); Setup mit Spielern/Reihenfolge, Modus + Zielwert, Start-Token, Playlist-Auswahl eigene + Suche, „zu wenige Tracks"-Warnung (Task 4); „Deck wird vorbereitet"-Ladescreen mit MusicBrainz-Batch (Task 5); Gameplay-Fokus-Layout mit Mitspieler-Leiste, horizontaler Timeline im Hitster-Stil (Interpret oben/Jahr mitte/Titel unten), „+"-Slots mit Hervorhebung, Mystery-Karte + Play/Pause + Fortschrittsbalken, „Hier einsetzen", Tap statt Drag, ≥44px (Tasks 1–3, 6); Konter-Overlay reihum (Task 6); Reveal mit Jahr/Interpret/Titel, Slot-Markierung, Token-Selbstbestätigung (Task 6); Game Over mit Endstand + Sieger + „Neue Runde", nichts persistiert (Task 6). ✓
- **Fehlerbehandlung (§8):** Premium-Gate auf `/play` (Task 5); SDK-Fehler als Banner (`useSpotifyPlayer.error`); unspielbarer Track → „Karte überspringen" via `SKIP` (Task 6 + Plan-3-Ergänzung); Deck-Vorbereitung-Fehler mit Zurück-Button (Task 5); Playlist „zu wenige Tracks"-Warnung im Setup (Task 4). ✓
- **Platzhalter:** keine offenen TODO/TBD; jeder Code-Step vollständig. Der bewusste GameApp-Platzhalter in Task 5 wird in Task 6 ersetzt (explizit dokumentiert). ✓
- **Typ-Konsistenz:** `SetupConfig`/`buildGameInput`/`minTracksNeeded` konsistent zwischen Tasks 4–6; `GameInput`/`Card`/`Player`/`Resolution` aus Plan 3 unverändert; `PlaybackState`/`useSpotifyPlayer`-Rückgabe aus Plan 4 (paused/position/duration/togglePlay) exakt in `PlaybackControls`/`GameScreen` genutzt; Engine-Events `PLACE`/`COUNTER`/`PASS`/`CONTINUE`/`SKIP` decken sich mit Plan 3 `GameEvent`; Selektoren `activePlayer`/`availableSlots`/`currentCountererId` wie in Plan 3 definiert. ✓
- **Tests bewusst minimal (§9):** reine Helfer (`game-setup`) + zwei Präsentationskomponenten (Card, Timeline) getestet; Engine-Logik ist bereits in Plan 3 vollständig getestet, die UI sendet nur Events. ✓
- **Scope:** UI komplett. Regeln (Plan 3), Daten/Wiedergabe (Plan 4), Auth/Gate (Plan 1), Jahres-Cache (Plan 2) sind separate Pläne.
```
