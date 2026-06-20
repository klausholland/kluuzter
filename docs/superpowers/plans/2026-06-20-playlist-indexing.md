# Entkoppelte Playlist-Indizierung — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die MusicBrainz-Anreicherung vom Spielstart entkoppeln — in kleinen, browser-orchestrierten Batches indizieren, damit beliebig große Playlists ohne Vercel-Function-Timeout funktionieren und das Deck sofort aus dem Cache startet.

**Architecture:** Eine reine Batch-/Status-Logik (framework-frei, getestet) plus zwei neue API-Routes (`/api/playlist-status`, `/api/index`) und ein Umbau von `/api/deck` auf reinen Cache-Bau. Der Setup-Screen orchestriert die Indizierung über eine serielle Batch-Schleife im Browser mit Fortschrittsanzeige. Der `year_cache` (aus Plan 2) bleibt die gemeinsame Wahrheit.

**Tech Stack:** Next.js 16 Route Handlers, Drizzle/Neon `year_cache`, React 19, Vitest 4.1.9 (+ Testing Library/jsdom für UI).

## Global Constraints

- Node 24 (`nvm use 24` vor allen npm/node-Befehlen)
- `vitest@4.1.9`, TypeScript strict
- MusicBrainz Rate-Limit: max. 1 Anfrage/Sekunde (bestehender `createRateLimiter(1100)`)
- `INDEX_BATCH_SIZE = 20` (Tracks pro `/api/index`-Request; ~22 s, sicher unter 60 s)
- Jeder Request bleibt < 60 s (Vercel Hobby Function-Timeout)
- Jahres-Quelle pro Karte mitführen (`"musicbrainz" | "spotify"`)
- Cache bleibt global pro Spotify-Track-ID (kein Playlist-Bezug)
- Reine Logik ohne React-Importe in `lib/`; einzige `"use client"`-Änderung im Setup-Bereich

## Konsumierte Schnittstellen (bestehend)

```ts
// lib/musicbrainz/types.ts
export type TrackQuery = { spotifyTrackId: string; title: string; artist: string; spotifyReleaseYear: number };
export type ResolvedYear = { spotifyTrackId: string; year: number; source: "musicbrainz" | "spotify" };

// lib/musicbrainz/cache.ts
export function getCached(ids: string[]): Promise<ResolvedYear[]>;

// lib/musicbrainz/service.ts
export function enrichTracks(queries: TrackQuery[]): Promise<ResolvedYear[]>; // Cache→MB→Fallback→Cache-Write

// lib/spotify/api.ts
export function getPlaylistTracks(token, playlistId, fetchImpl?): Promise<SpotifyTrack[]>;
// lib/spotify/deck.ts
export function buildTrackQueries(tracks: SpotifyTrack[]): TrackQuery[];
export function buildCard(track: SpotifyTrack, resolved: ResolvedYear): Card;
export function shuffle<T>(items: T[], rng?): T[];
export function dedupeTracks(tracks: SpotifyTrack[]): SpotifyTrack[];
// lib/spotify/session-token.ts
export function getSessionAccessToken(): Promise<string | null>;
```

## File Structure

- `lib/musicbrainz/indexing.ts` — reine Helfer: `chunk`, `computeStatus`, `buildDeckFromCache` **(neu)**
- `app/api/playlist-status/route.ts` — Index-Status einer Playlist **(neu)**
- `app/api/index/route.ts` — einen Batch anreichern **(neu)**
- `app/api/deck/route.ts` — Umbau: nur aus Cache bauen **(modifizieren)**
- `lib/spotify/playlist-index.ts` — Client-Helfer: `indexPlaylist` (Batch-Schleife) **(neu)**
- `components/setup/PlaylistPicker.tsx` — Status-Badge + Indizieren-Button + Fortschritt **(modifizieren)**
- Tests unter `lib/musicbrainz/__tests__/`, `lib/spotify/__tests__/`, `components/setup/__tests__/`

## Shared Types (für spätere Tasks verbindlich)

```ts
// lib/musicbrainz/indexing.ts
export type PlaylistStatus = {
  total: number;          // Tracks der Playlist mit parsbarem Jahr (= TrackQuery-fähig)
  indexed: number;        // davon bereits im year_cache
  missing: TrackQuery[];  // noch nicht gecachte Tracks als fertige Queries
};
```

---

## Task 1: Reine Indizierungs-Helfer (`chunk`, `computeStatus`, `buildDeckFromCache`)

**Files:**
- Create: `lib/musicbrainz/indexing.ts`
- Test: `lib/musicbrainz/__tests__/indexing.test.ts`

**Interfaces:**
- Consumes: `TrackQuery`, `ResolvedYear` (`@/lib/musicbrainz/types`); `SpotifyTrack` (`@/lib/spotify/types`); `Card` (`@/lib/engine/types`); `buildTrackQueries`, `buildCard`, `shuffle` (`@/lib/spotify/deck`)
- Produces:
  - `chunk<T>(items: T[], size: number): T[][]`
  - `computeStatus(tracks: SpotifyTrack[], cached: ResolvedYear[]): PlaylistStatus`
  - `buildDeckFromCache(tracks: SpotifyTrack[], cached: ResolvedYear[], rng?: () => number): Card[]`
  - Typ `PlaylistStatus`

- [ ] **Step 1: Failing tests schreiben**

`lib/musicbrainz/__tests__/indexing.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { chunk, computeStatus, buildDeckFromCache } from "../indexing";
import type { ResolvedYear } from "../types";
import type { SpotifyTrack } from "@/lib/spotify/types";

function track(id: string, releaseDate = "1990"): SpotifyTrack {
  return {
    id,
    uri: `spotify:track:${id}`,
    title: `Title ${id}`,
    artist: `Artist ${id}`,
    releaseDate,
    coverUrl: null,
  };
}
function cached(id: string, year = 1990): ResolvedYear {
  return { spotifyTrackId: id, year, source: "musicbrainz" };
}

describe("chunk", () => {
  it("splits into blocks of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("returns an empty array for an empty input", () => {
    expect(chunk([], 3)).toEqual([]);
  });
  it("keeps everything in one block when size exceeds length", () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });
});

describe("computeStatus", () => {
  it("counts indexed tracks and lists the missing ones as queries", () => {
    const tracks = [track("a"), track("b"), track("c")];
    const status = computeStatus(tracks, [cached("b")]);
    expect(status.total).toBe(3);
    expect(status.indexed).toBe(1);
    expect(status.missing.map((q) => q.spotifyTrackId)).toEqual(["a", "c"]);
    expect(status.missing[0]).toEqual({
      spotifyTrackId: "a",
      title: "Title a",
      artist: "Artist a",
      spotifyReleaseYear: 1990,
    });
  });

  it("ignores tracks without a parsable year (not indexable)", () => {
    const tracks = [track("a", "1990"), track("b", "")];
    const status = computeStatus(tracks, []);
    expect(status.total).toBe(1); // nur 'a' ist TrackQuery-fähig
    expect(status.missing.map((q) => q.spotifyTrackId)).toEqual(["a"]);
  });

  it("reports fully indexed when every query is cached", () => {
    const tracks = [track("a"), track("b")];
    const status = computeStatus(tracks, [cached("a"), cached("b")]);
    expect(status.total).toBe(2);
    expect(status.indexed).toBe(2);
    expect(status.missing).toEqual([]);
  });
});

describe("buildDeckFromCache", () => {
  it("builds cards only from cached tracks and skips uncached ones", () => {
    const tracks = [track("a"), track("b"), track("c")];
    const deck = buildDeckFromCache(tracks, [cached("a", 1985), cached("c", 2001)], () => 0);
    expect(deck.map((card) => card.id).sort()).toEqual(["a", "c"]);
    const a = deck.find((card) => card.id === "a")!;
    expect(a.year).toBe(1985);
    expect(a.yearSource).toBe("musicbrainz");
  });

  it("returns an empty deck when nothing is cached", () => {
    expect(buildDeckFromCache([track("a")], [], () => 0)).toEqual([]);
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/musicbrainz/__tests__/indexing.test.ts`
Expected: FAIL — `Cannot find module '../indexing'`.

- [ ] **Step 3: `indexing.ts` implementieren**

`lib/musicbrainz/indexing.ts`:
```ts
import type { ResolvedYear, TrackQuery } from "./types";
import type { SpotifyTrack } from "@/lib/spotify/types";
import type { Card } from "@/lib/engine/types";
import { buildTrackQueries, buildCard, shuffle } from "@/lib/spotify/deck";

export type PlaylistStatus = {
  total: number;
  indexed: number;
  missing: TrackQuery[];
};

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function computeStatus(
  tracks: SpotifyTrack[],
  cached: ResolvedYear[],
): PlaylistStatus {
  const queries = buildTrackQueries(tracks); // nur Tracks mit parsbarem Jahr
  const cachedIds = new Set(cached.map((c) => c.spotifyTrackId));
  const missing = queries.filter((q) => !cachedIds.has(q.spotifyTrackId));
  return {
    total: queries.length,
    indexed: queries.length - missing.length,
    missing,
  };
}

export function buildDeckFromCache(
  tracks: SpotifyTrack[],
  cached: ResolvedYear[],
  rng: () => number = Math.random,
): Card[] {
  const trackById = new Map(tracks.map((t) => [t.id, t]));
  const cards: Card[] = [];
  for (const r of cached) {
    const track = trackById.get(r.spotifyTrackId);
    if (track) cards.push(buildCard(track, r));
  }
  return shuffle(cards, rng);
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/musicbrainz/__tests__/indexing.test.ts`
Expected: PASS — alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add lib/musicbrainz/indexing.ts lib/musicbrainz/__tests__/indexing.test.ts
git commit -m "feat: add pure indexing helpers (chunk, status, deck-from-cache)"
```

---

## Task 2: API-Route `GET /api/playlist-status`

**Files:**
- Create: `app/api/playlist-status/route.ts`

**Interfaces:**
- Consumes: `getSessionAccessToken` (`@/lib/spotify/session-token`); `getPlaylistTracks` (`@/lib/spotify/api`); `getCached` (`@/lib/musicbrainz/cache`); `computeStatus` (`@/lib/musicbrainz/indexing`)
- Produces: `GET /api/playlist-status?id=<playlistId>` → `PlaylistStatus` (`{ total, indexed, missing }`) | 401 | 400

> Diese Route besteht aus dünner Verdrahtung getesteter Teile (Auth, Spotify-Fetch, `computeStatus`); die Logik selbst ist in Task 1 abgedeckt. Verifikation per Build + optionalem manuellem Check.

- [ ] **Step 1: Route implementieren**

`app/api/playlist-status/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getSessionAccessToken } from "@/lib/spotify/session-token";
import { getPlaylistTracks } from "@/lib/spotify/api";
import { getCached } from "@/lib/musicbrainz/cache";
import { computeStatus } from "@/lib/musicbrainz/indexing";

export const maxDuration = 60;

export async function GET(request: Request) {
  const token = await getSessionAccessToken();
  if (!token) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing playlist id" }, { status: 400 });
  }
  const tracks = await getPlaylistTracks(token, id);
  const cached = await getCached(tracks.map((t) => t.id));
  return NextResponse.json(computeStatus(tracks, cached));
}
```

- [ ] **Step 2: Build-Check**

Run: `npm run build`
Expected: erfolgreich; Route `/api/playlist-status` ist gelistet.

- [ ] **Step 3: Commit**

```bash
git add app/api/playlist-status/route.ts
git commit -m "feat: add /api/playlist-status route (index status per playlist)"
```

---

## Task 3: API-Route `POST /api/index` (ein Batch)

**Files:**
- Create: `app/api/index/route.ts`
- Test: `lib/musicbrainz/__tests__/index-route-guard.test.ts`

**Interfaces:**
- Consumes: `getSessionAccessToken`; `enrichTracks` (`@/lib/musicbrainz/service`); `TrackQuery` (`@/lib/musicbrainz/types`); `INDEX_BATCH_SIZE` (siehe unten)
- Produces:
  - `POST /api/index` Body `{ tracks: TrackQuery[] }` → `{ years: ResolvedYear[] }` | 401 | 400
  - Konstante `INDEX_BATCH_SIZE = 20` (exportiert aus `lib/musicbrainz/indexing.ts`)
  - reine Guard-Funktion `isValidBatch(tracks: unknown): tracks is TrackQuery[]` (exportiert aus `lib/musicbrainz/indexing.ts`)

- [ ] **Step 1: `INDEX_BATCH_SIZE` + `isValidBatch` in `indexing.ts` ergänzen (Failing test)**

In `lib/musicbrainz/__tests__/index-route-guard.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isValidBatch, INDEX_BATCH_SIZE } from "../indexing";

function q(id: string) {
  return { spotifyTrackId: id, title: id, artist: id, spotifyReleaseYear: 1990 };
}

describe("INDEX_BATCH_SIZE", () => {
  it("is 20", () => expect(INDEX_BATCH_SIZE).toBe(20));
});

describe("isValidBatch", () => {
  it("accepts an array within the batch limit", () => {
    expect(isValidBatch([q("a"), q("b")])).toBe(true);
  });
  it("accepts an empty array", () => {
    expect(isValidBatch([])).toBe(true);
  });
  it("rejects a non-array", () => {
    expect(isValidBatch("nope")).toBe(false);
    expect(isValidBatch(null)).toBe(false);
  });
  it("rejects a batch larger than INDEX_BATCH_SIZE", () => {
    const big = Array.from({ length: INDEX_BATCH_SIZE + 1 }, (_, i) => q(String(i)));
    expect(isValidBatch(big)).toBe(false);
  });
  it("rejects entries missing required fields", () => {
    expect(isValidBatch([{ spotifyTrackId: "a" }])).toBe(false);
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/musicbrainz/__tests__/index-route-guard.test.ts`
Expected: FAIL — `isValidBatch`/`INDEX_BATCH_SIZE` nicht exportiert.

- [ ] **Step 3: In `lib/musicbrainz/indexing.ts` ergänzen**

Am Ende von `lib/musicbrainz/indexing.ts` anhängen:
```ts
export const INDEX_BATCH_SIZE = 20;

export function isValidBatch(tracks: unknown): tracks is TrackQuery[] {
  if (!Array.isArray(tracks)) return false;
  if (tracks.length > INDEX_BATCH_SIZE) return false;
  return tracks.every(
    (t) =>
      t != null &&
      typeof t.spotifyTrackId === "string" &&
      typeof t.title === "string" &&
      typeof t.artist === "string" &&
      typeof t.spotifyReleaseYear === "number",
  );
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/musicbrainz/__tests__/index-route-guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Route implementieren**

`app/api/index/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getSessionAccessToken } from "@/lib/spotify/session-token";
import { enrichTracks } from "@/lib/musicbrainz/service";
import { isValidBatch } from "@/lib/musicbrainz/indexing";

export const maxDuration = 60;

export async function POST(request: Request) {
  const token = await getSessionAccessToken();
  if (!token) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  let body: { tracks?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!isValidBatch(body.tracks)) {
    return NextResponse.json(
      { error: "tracks must be an array of at most 20 TrackQuery objects" },
      { status: 400 },
    );
  }
  const years = await enrichTracks(body.tracks);
  return NextResponse.json({ years });
}
```

> Hinweis: `enrichTracks` schreibt Treffer in den `year_cache` (bestehende Orchestrierung), daher ist der Batch nach erfolgreichem Aufruf dauerhaft indiziert.

- [ ] **Step 6: Build-Check**

Run: `npm run build`
Expected: erfolgreich; Route `/api/index` gelistet.

- [ ] **Step 7: Commit**

```bash
git add app/api/index/route.ts lib/musicbrainz/indexing.ts lib/musicbrainz/__tests__/index-route-guard.test.ts
git commit -m "feat: add /api/index route (enrich one batch, cached)"
```

---

## Task 4: `/api/deck` auf reinen Cache-Bau umstellen

**Files:**
- Modify: `app/api/deck/route.ts`

**Interfaces:**
- Consumes: `getSessionAccessToken`; `getPlaylistTracks`; `dedupeTracks` (`@/lib/spotify/deck`); `getCached` (`@/lib/musicbrainz/cache`); `buildDeckFromCache` (`@/lib/musicbrainz/indexing`)
- Produces: `POST /api/deck` Body `{ playlistIds: string[] }` → `{ deck: Card[] }` | 401 | 400 | 409 (keine indizierten Tracks)

> **Verhaltensänderung:** `/api/deck` ruft **kein** MusicBrainz mehr auf; es baut das Deck ausschließlich aus dem `year_cache`. Nicht indizierte Tracks werden übersprungen.

- [ ] **Step 1: Route ersetzen**

`app/api/deck/route.ts` (kompletter neuer Inhalt):
```ts
import { NextResponse } from "next/server";
import { getSessionAccessToken } from "@/lib/spotify/session-token";
import { getPlaylistTracks } from "@/lib/spotify/api";
import { dedupeTracks } from "@/lib/spotify/deck";
import { getCached } from "@/lib/musicbrainz/cache";
import { buildDeckFromCache } from "@/lib/musicbrainz/indexing";
import type { SpotifyTrack } from "@/lib/spotify/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const token = await getSessionAccessToken();
  if (!token) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  let body: { playlistIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.playlistIds) || body.playlistIds.length === 0) {
    return NextResponse.json(
      { error: "playlistIds must be a non-empty array" },
      { status: 400 },
    );
  }

  const all: SpotifyTrack[] = [];
  for (const id of body.playlistIds as string[]) {
    all.push(...(await getPlaylistTracks(token, id)));
  }
  const tracks = dedupeTracks(all);
  const cached = await getCached(tracks.map((t) => t.id));
  const deck = buildDeckFromCache(tracks, cached);

  if (deck.length === 0) {
    return NextResponse.json(
      { error: "no indexed tracks — please index the playlist first" },
      { status: 409 },
    );
  }
  return NextResponse.json({ deck });
}
```

- [ ] **Step 2: Voller Test-Lauf + Build**

Run: `npm test && npm run build`
Expected: alle Tests grün; Build erfolgreich (`/api/deck` weiterhin gelistet).

- [ ] **Step 3: Commit**

```bash
git add app/api/deck/route.ts
git commit -m "refactor: build deck only from cache (no MusicBrainz at game start)"
```

---

## Task 5: Client-Batch-Schleife `indexPlaylist`

**Files:**
- Create: `lib/spotify/playlist-index.ts`
- Test: `lib/spotify/__tests__/playlist-index.test.ts`

**Interfaces:**
- Consumes: `PlaylistStatus` (`@/lib/musicbrainz/indexing`); `chunk`, `INDEX_BATCH_SIZE` (`@/lib/musicbrainz/indexing`); `TrackQuery` (`@/lib/musicbrainz/types`)
- Produces:
  - `fetchStatus(playlistId: string, fetchImpl?: typeof fetch): Promise<PlaylistStatus>`
  - `indexPlaylist(playlistId: string, opts?: { onProgress?: (done: number, total: number) => void; fetchImpl?: typeof fetch }): Promise<void>`
    — holt Status, schickt `missing` in `INDEX_BATCH_SIZE`-Blöcken seriell an `/api/index`, meldet Fortschritt; wirft bei HTTP-Fehler nach 1 Retry pro Batch.

- [ ] **Step 1: Failing tests schreiben**

`lib/spotify/__tests__/playlist-index.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { indexPlaylist, fetchStatus } from "../playlist-index";
import type { TrackQuery } from "@/lib/musicbrainz/types";

function q(id: string): TrackQuery {
  return { spotifyTrackId: id, title: id, artist: id, spotifyReleaseYear: 1990 };
}
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("fetchStatus", () => {
  it("requests the status route and returns the parsed status", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toBe("/api/playlist-status?id=pl1");
      return jsonResponse({ total: 3, indexed: 1, missing: [q("a")] });
    }) as unknown as typeof fetch;
    const status = await fetchStatus("pl1", fetchImpl);
    expect(status.indexed).toBe(1);
    expect(status.missing).toHaveLength(1);
  });
});

describe("indexPlaylist", () => {
  it("posts missing tracks in batches and reports progress", async () => {
    // 25 fehlende Tracks → bei Batch 20 zwei Requests (20 + 5)
    const missing = Array.from({ length: 25 }, (_, i) => q(String(i)));
    const bodies: number[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/playlist-status")) {
        return jsonResponse({ total: 25, indexed: 0, missing });
      }
      // /api/index
      const parsed = JSON.parse(init!.body as string) as { tracks: TrackQuery[] };
      bodies.push(parsed.tracks.length);
      return jsonResponse({ years: [] });
    }) as unknown as typeof fetch;

    const progress: Array<[number, number]> = [];
    await indexPlaylist("pl1", {
      fetchImpl,
      onProgress: (done, total) => progress.push([done, total]),
    });

    expect(bodies).toEqual([20, 5]); // zwei Batches
    expect(progress.at(-1)).toEqual([25, 25]); // am Ende vollständig
  });

  it("does nothing when there are no missing tracks", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.startsWith("/api/playlist-status")) {
        return jsonResponse({ total: 2, indexed: 2, missing: [] });
      }
      throw new Error("should not call /api/index");
    }) as unknown as typeof fetch;
    await indexPlaylist("pl1", { fetchImpl });
    // nur der Status-Request
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries a failed batch once, then throws", async () => {
    const missing = [q("a")];
    let indexCalls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.startsWith("/api/playlist-status")) {
        return jsonResponse({ total: 1, indexed: 0, missing });
      }
      indexCalls++;
      return jsonResponse({ error: "boom" }, 500);
    }) as unknown as typeof fetch;

    await expect(indexPlaylist("pl1", { fetchImpl })).rejects.toThrow();
    expect(indexCalls).toBe(2); // 1 Versuch + 1 Retry
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/spotify/__tests__/playlist-index.test.ts`
Expected: FAIL — `Cannot find module '../playlist-index'`.

- [ ] **Step 3: `playlist-index.ts` implementieren**

`lib/spotify/playlist-index.ts`:
```ts
import type { PlaylistStatus } from "@/lib/musicbrainz/indexing";
import { chunk, INDEX_BATCH_SIZE } from "@/lib/musicbrainz/indexing";
import type { TrackQuery } from "@/lib/musicbrainz/types";

export async function fetchStatus(
  playlistId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PlaylistStatus> {
  const res = await fetchImpl(`/api/playlist-status?id=${playlistId}`);
  if (!res.ok) throw new Error(`playlist-status ${res.status}`);
  return (await res.json()) as PlaylistStatus;
}

async function postBatch(
  tracks: TrackQuery[],
  fetchImpl: typeof fetch,
): Promise<void> {
  let attempt = 0;
  // 1 Versuch + 1 Retry
  while (true) {
    attempt++;
    const res = await fetchImpl("/api/index", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tracks }),
    });
    if (res.ok) return;
    if (attempt >= 2) throw new Error(`index batch failed (${res.status})`);
  }
}

export async function indexPlaylist(
  playlistId: string,
  opts: {
    onProgress?: (done: number, total: number) => void;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<void> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const status = await fetchStatus(playlistId, fetchImpl);
  const total = status.missing.length;
  if (total === 0) {
    opts.onProgress?.(0, 0);
    return;
  }
  let done = 0;
  for (const batch of chunk(status.missing, INDEX_BATCH_SIZE)) {
    await postBatch(batch, fetchImpl);
    done += batch.length;
    opts.onProgress?.(done, total);
  }
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/spotify/__tests__/playlist-index.test.ts`
Expected: PASS — alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add lib/spotify/playlist-index.ts lib/spotify/__tests__/playlist-index.test.ts
git commit -m "feat: add client batch loop indexPlaylist (serial /api/index calls)"
```

---

## Task 6: Setup-UI — Status-Badge, Indizieren-Button, Fortschritt

**Files:**
- Modify: `components/setup/PlaylistPicker.tsx`
- Test: `components/setup/__tests__/PlaylistPicker.test.tsx`

**Interfaces:**
- Consumes: `fetchStatus`, `indexPlaylist` (`@/lib/spotify/playlist-index`); `SpotifyPlaylistSummary` (`@/lib/spotify/types`)
- Produces: erweiterte `PlaylistPicker`-Komponente — pro **ausgewählter** Playlist Status-Badge (`indiziert ✓` / `X/Y` / `nicht indiziert`) + „Indizieren"-Button mit Fortschritt.

> Die Indizierungs-Schleife (Task 5) ist bereits getestet. Hier wird nur die Verdrahtung getestet: Button löst `indexPlaylist` aus und Fortschritt/Status werden angezeigt.

- [ ] **Step 1: Failing test schreiben**

`components/setup/__tests__/PlaylistPicker.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { PlaylistPicker } from "../PlaylistPicker";

afterEach(cleanup);

// Module mit den Netz-Funktionen mocken
vi.mock("@/lib/spotify/playlist-index", () => ({
  fetchStatus: vi.fn(async () => ({ total: 5, indexed: 2, missing: [] })),
  indexPlaylist: vi.fn(async (_id: string, opts?: { onProgress?: (d: number, t: number) => void }) => {
    opts?.onProgress?.(3, 3);
  }),
}));

// Playlists-Fetch (globaler fetch) mocken
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify([
          { id: "pl1", name: "Oldies", imageUrl: null, trackCount: 5, owner: "me" },
        ]),
        { status: 200 },
      ),
    ),
  );
});

describe("PlaylistPicker indexing", () => {
  it("shows an index status badge for a selected playlist", async () => {
    render(<PlaylistPicker selectedIds={["pl1"]} onChange={() => {}} />);
    // Status wird nach Auswahl geladen
    expect(await screen.findByText(/2\s*\/\s*5 indiziert/i)).toBeTruthy();
  });

  it("runs indexPlaylist when the index button is clicked", async () => {
    const { indexPlaylist } = await import("@/lib/spotify/playlist-index");
    render(<PlaylistPicker selectedIds={["pl1"]} onChange={() => {}} />);
    const btn = await screen.findByRole("button", { name: /indizieren/i });
    fireEvent.click(btn);
    await waitFor(() => expect(indexPlaylist).toHaveBeenCalledWith("pl1", expect.any(Object)));
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run components/setup/__tests__/PlaylistPicker.test.tsx`
Expected: FAIL — Status-Badge/Indizieren-Button existieren noch nicht.

- [ ] **Step 3: `PlaylistPicker.tsx` erweitern**

`components/setup/PlaylistPicker.tsx` (kompletter neuer Inhalt):
```tsx
"use client";

import { useEffect, useState } from "react";
import type { SpotifyPlaylistSummary } from "@/lib/spotify/types";
import { fetchStatus, indexPlaylist } from "@/lib/spotify/playlist-index";

async function fetchPlaylists(query: string): Promise<SpotifyPlaylistSummary[]> {
  const url = query
    ? `/api/spotify/playlists?q=${encodeURIComponent(query)}`
    : "/api/spotify/playlists";
  const res = await fetch(url);
  if (!res.ok) throw new Error("playlists fetch failed");
  return (await res.json()) as SpotifyPlaylistSummary[];
}

type IndexState =
  | { kind: "loading" }
  | { kind: "ready"; total: number; indexed: number }
  | { kind: "indexing"; done: number; total: number }
  | { kind: "error" };

function IndexControls({ playlistId }: { playlistId: string }) {
  const [state, setState] = useState<IndexState>({ kind: "loading" });

  async function loadStatus() {
    setState({ kind: "loading" });
    try {
      const s = await fetchStatus(playlistId);
      setState({ kind: "ready", total: s.total, indexed: s.indexed });
    } catch {
      setState({ kind: "error" });
    }
  }

  useEffect(() => {
    let active = true;
    fetchStatus(playlistId)
      .then((s) => active && setState({ kind: "ready", total: s.total, indexed: s.indexed }))
      .catch(() => active && setState({ kind: "error" }));
    return () => {
      active = false;
    };
  }, [playlistId]);

  async function runIndex() {
    setState({ kind: "indexing", done: 0, total: 0 });
    try {
      await indexPlaylist(playlistId, {
        onProgress: (done, total) => setState({ kind: "indexing", done, total }),
      });
      await loadStatus();
    } catch {
      setState({ kind: "error" });
    }
  }

  if (state.kind === "loading") {
    return <p className="text-xs text-neutral-400">Status wird geladen…</p>;
  }
  if (state.kind === "error") {
    return (
      <button type="button" onClick={loadStatus} className="text-xs text-red-400 underline">
        Status-Fehler — erneut versuchen
      </button>
    );
  }
  if (state.kind === "indexing") {
    const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;
    return (
      <p className="text-xs text-amber-300">
        Indiziere… {state.done}/{state.total} ({pct}%)
      </p>
    );
  }
  // ready
  const fully = state.indexed >= state.total && state.total > 0;
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs ${fully ? "text-green-400" : "text-neutral-300"}`}>
        {fully ? "indiziert ✓" : `${state.indexed} / ${state.total} indiziert`}
      </span>
      {!fully && (
        <button
          type="button"
          onClick={runIndex}
          className="rounded bg-fuchsia-600 px-2 py-1 text-xs font-semibold"
        >
          Indizieren
        </button>
      )}
    </div>
  );
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
            <li key={p.id} className="space-y-1">
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
              {selected && (
                <div className="px-3">
                  <IndexControls playlistId={p.id} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run components/setup/__tests__/PlaylistPicker.test.tsx`
Expected: PASS — beide Tests grün.

- [ ] **Step 5: Voller Test-Lauf + Build**

Run: `npm test && npm run build`
Expected: alle Tests grün; Build erfolgreich; Routen `/api/index`, `/api/playlist-status`, `/api/deck` gelistet.

- [ ] **Step 6: Manuelle Verifikation (lokal, erfordert DB + Login)**

Run: `npm run dev` → App-/Spotify-Login → „Neues Spiel".
1. Playlist (auch > 50 Songs) auswählen → Status-Badge „X / Y indiziert".
2. „Indizieren" klicken → Fortschritt „done/total" zählt hoch (in 20er-Schritten); danach „indiziert ✓".
3. „Deck vorbereiten & starten" → Deck baut **sofort** (keine Wartezeit, da aus Cache).
4. Seite neu laden, gleiche Playlist erneut wählen → sofort „indiziert ✓" (Cache).
Expected: Verhalten wie beschrieben; kein langer Request, große Playlists funktionieren.

- [ ] **Step 7: Commit**

```bash
git add components/setup/PlaylistPicker.tsx components/setup/__tests__/PlaylistPicker.test.tsx
git commit -m "feat: add index status badge, index button and progress to playlist picker"
```

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung:**
  - §4.1 `/api/playlist-status` → Task 2 (+ `computeStatus` Task 1). ✓
  - §4.2 `/api/index` (Batch, `INDEX_BATCH_SIZE`, maxDuration, Validierung) → Task 3. ✓
  - §4.3 `/api/deck` nur aus Cache, 409 bei leer → Task 4 (+ `buildDeckFromCache` Task 1). ✓
  - §4.4 Setup-UI (Badge, Button, Fortschritt) → Task 6 (+ `indexPlaylist` Task 5). ✓
  - §5 Fehlerbehandlung: 400 zu großer Batch (Task 3), 409 leeres Deck (Task 4), Batch-Retry + Stopp (Task 5), Status-Fehler-Retry (Task 6). ✓
  - §6 Vercel: `maxDuration=60` in allen Routes, neon-http-Pfad unverändert. ✓
  - §7 Teststrategie: reine Logik (Task 1/3/5), Route-Guard (Task 3), UI minimal (Task 6). ✓
- **Platzhalter:** keine; jeder Code-Step vollständig. ✓
- **Typ-Konsistenz:** `PlaylistStatus` (Task 1) wird in Task 2/5/6 identisch genutzt; `INDEX_BATCH_SIZE`/`isValidBatch` (Task 3) in Task 5; `buildDeckFromCache` (Task 1) in Task 4; `fetchStatus`/`indexPlaylist`-Signaturen (Task 5) in Task 6. `chunk`/`computeStatus`/`buildCard`/`buildTrackQueries`/`shuffle` konsistent benannt. ✓
- **Scope:** Eine in sich abgeschlossene Einheit (Indizierung entkoppeln); berührt MusicBrainz-Matching/Schema/Engine/Playback nicht.
```
