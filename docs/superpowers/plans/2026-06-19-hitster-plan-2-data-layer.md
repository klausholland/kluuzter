# Hitster Webapp — Plan 2: Datenschicht (Neon Postgres + MusicBrainz-Jahres-Anreicherung)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Echte Erstveröffentlichungsjahre für Spotify-Tracks ermitteln — über MusicBrainz, mit serverseitigem Postgres-Cache, Rate-Limit-Queue und Fallback auf das Spotify-Jahr.

**Architecture:** Eine reine Matching-/Extraktions-Logik (framework-frei, getestet) plus dünne Adapter für die MusicBrainz-HTTP-API und den Drizzle/Neon-Cache. Eine `resolveYears`-Funktion orchestriert: Cache-Lookup → MusicBrainz-Batch (serielle Queue ≥ 1 req/s) → Cache-Write → Fallback. Eine API-Route stellt das dem Client bereit.

**Tech Stack:** Drizzle ORM 0.45.2, drizzle-kit 0.31.10, @neondatabase/serverless 1.1.0, Vitest 4.1.9, Next.js 16 Route Handlers.

## Global Constraints

- `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `@neondatabase/serverless@1.1.0`
- `vitest@4.1.9`, TypeScript strict
- Node 24 (`nvm use 24` vor allen npm/node-Befehlen; `next dev -H 127.0.0.1`)
- MusicBrainz Rate-Limit: **maximal 1 Anfrage/Sekunde**; User-Agent-Header Pflicht (Format `Hitster/0.1 ( <kontakt> )`)
- DB-Verbindung nur über `DATABASE_URL` (env). Niemals committen.
- Reine Module unter `lib/musicbrainz/` und `db/` (keine React-Importe in der Logik)
- Jahres-Quelle wird immer mitgeführt: `"musicbrainz"` oder `"spotify"` (Fallback)

## Shared Types (für spätere Pläne verbindlich)

```ts
// lib/musicbrainz/types.ts
export type TrackQuery = {
  spotifyTrackId: string;
  title: string;
  artist: string;
  spotifyReleaseYear: number; // aus album.release_date abgeleitet (Fallback)
};

export type ResolvedYear = {
  spotifyTrackId: string;
  year: number;
  source: "musicbrainz" | "spotify";
};
```

`resolveYears(queries: TrackQuery[]): Promise<ResolvedYear[]>` ist die öffentliche Schnittstelle, die Plan 4 (Deck-Aufbau) konsumiert.

## File Structure

- `db/schema.ts` — Drizzle-Schema (`year_cache`)
- `db/client.ts` — Neon/Drizzle-Client (Singleton)
- `drizzle.config.ts` — drizzle-kit-Konfiguration
- `lib/musicbrainz/types.ts` — gemeinsame Typen
- `lib/musicbrainz/match.ts` — reine Matching-/Jahr-Extraktions-Logik
- `lib/musicbrainz/rate-limit.ts` — serielle Queue (≥ 1 req/s)
- `lib/musicbrainz/client.ts` — MusicBrainz-HTTP-Abfrage (nutzt match + rate-limit)
- `lib/musicbrainz/resolve.ts` — Orchestrierung Cache ↔ MusicBrainz ↔ Fallback
- `app/api/musicbrainz/route.ts` — POST-Endpoint (Batch-Anreicherung)
- Tests unter `**/__tests__/`
- `.env.example` ergänzt um `DATABASE_URL`, `MUSICBRAINZ_CONTACT`

---

## Task 1: Dependencies + Drizzle-Schema + Client

**Files:**
- Modify: `package.json` (Dependencies)
- Create: `db/schema.ts`, `db/client.ts`, `drizzle.config.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `DATABASE_URL` (env)
- Produces:
  - Tabelle `year_cache`
  - `db` (Drizzle-Client) aus `db/client.ts`
  - `yearCache` (Drizzle-Tabelle) aus `db/schema.ts`

- [ ] **Step 1: Dependencies installieren**

Run (Node 24 aktiv):
`npm install drizzle-orm@0.45.2 @neondatabase/serverless@1.1.0 && npm install -D drizzle-kit@0.31.10`
Expected: Installation erfolgreich.

- [ ] **Step 2: Schema anlegen**

`db/schema.ts`:
```ts
import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const yearCache = pgTable("year_cache", {
  spotifyTrackId: text("spotify_track_id").primaryKey(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  resolvedYear: integer("resolved_year").notNull(),
  source: text("source", { enum: ["musicbrainz", "spotify"] }).notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export type YearCacheRow = typeof yearCache.$inferSelect;
```

- [ ] **Step 3: Client anlegen**

`db/client.ts`:
```ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(neon(url), { schema });
}

export const db = createDb();
```

- [ ] **Step 4: drizzle-kit-Konfiguration**

`drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 5: .env.example ergänzen**

In `.env.example` anhängen:
```
DATABASE_URL=postgres://user:pass@host/db?sslmode=require
MUSICBRAINZ_CONTACT=you@example.com
```

- [ ] **Step 6: Migration generieren**

Run: `npx drizzle-kit generate`
Expected: SQL-Migration unter `db/migrations/` erstellt (Tabelle `year_cache`).

- [ ] **Step 7: Build-Check + Commit**

Run: `npm run build`
Expected: erfolgreich (Client wird nicht zur Build-Zeit instanziiert? — `db/client.ts` ruft `createDb()` beim Import auf; stelle sicher, dass keine Seite es zur Build-Zeit importiert. Falls der Build wegen fehlender `DATABASE_URL` scheitert, setze in `.env.local` einen Dummy-Wert; nicht committen.)

```bash
git add package.json package-lock.json db/ drizzle.config.ts .env.example
git commit -m "feat: add Drizzle schema and Neon client for year_cache"
```

---

## Task 2: MusicBrainz-Matching + Jahr-Extraktion (reine Logik, TDD)

**Files:**
- Create: `lib/musicbrainz/types.ts`
- Create: `lib/musicbrainz/match.ts`
- Test: `lib/musicbrainz/__tests__/match.test.ts`

**Interfaces:**
- Produces:
  - `normalize(s: string): string` — lowercased, ohne Klammerzusätze/Akzente/Sonderzeichen
  - `bestRecordingYear(query: TrackQuery, recordings: MbRecording[]): number | null`
  - Typ `MbRecording = { title: string; firstReleaseDate?: string; artistCredit: string[] }`

- [ ] **Step 1: Failing tests schreiben**

`lib/musicbrainz/__tests__/match.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalize, bestRecordingYear } from "../match";

describe("normalize", () => {
  it("lowercases and strips bracketed suffixes", () => {
    expect(normalize("Sultans of Swing (Remastered 2018)")).toBe(
      "sultans of swing",
    );
  });
  it("removes 'feat.' segments and punctuation", () => {
    expect(normalize("Song (feat. Someone) - Live")).toBe("song");
  });
  it("strips accents", () => {
    expect(normalize("Café del Mar")).toBe("cafe del mar");
  });
});

describe("bestRecordingYear", () => {
  const query = {
    spotifyTrackId: "x",
    title: "Sultans of Swing",
    artist: "Dire Straits",
    spotifyReleaseYear: 2010,
  };

  it("returns the earliest year of matching-title recordings", () => {
    const year = bestRecordingYear(query, [
      { title: "Sultans of Swing", firstReleaseDate: "1979-05-04", artistCredit: ["Dire Straits"] },
      { title: "Sultans of Swing (Live)", firstReleaseDate: "1984", artistCredit: ["Dire Straits"] },
    ]);
    expect(year).toBe(1979);
  });

  it("ignores recordings whose normalized title does not match", () => {
    const year = bestRecordingYear(query, [
      { title: "Completely Different", firstReleaseDate: "1970", artistCredit: ["Dire Straits"] },
      { title: "Sultans of Swing", firstReleaseDate: "1979", artistCredit: ["Dire Straits"] },
    ]);
    expect(year).toBe(1979);
  });

  it("requires the artist to match (normalized)", () => {
    const year = bestRecordingYear(query, [
      { title: "Sultans of Swing", firstReleaseDate: "1965", artistCredit: ["Other Band"] },
    ]);
    expect(year).toBeNull();
  });

  it("returns null when there are no recordings", () => {
    expect(bestRecordingYear(query, [])).toBeNull();
  });

  it("parses a bare year (YYYY) release date", () => {
    const year = bestRecordingYear(query, [
      { title: "Sultans of Swing", firstReleaseDate: "1979", artistCredit: ["Dire Straits"] },
    ]);
    expect(year).toBe(1979);
  });

  it("ignores empty/zero release dates", () => {
    const year = bestRecordingYear(query, [
      { title: "Sultans of Swing", firstReleaseDate: "", artistCredit: ["Dire Straits"] },
      { title: "Sultans of Swing", firstReleaseDate: "0000", artistCredit: ["Dire Straits"] },
      { title: "Sultans of Swing", firstReleaseDate: "1979-01-01", artistCredit: ["Dire Straits"] },
    ]);
    expect(year).toBe(1979);
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/musicbrainz/__tests__/match.test.ts`
Expected: FAIL — `Cannot find module '../match'`.

- [ ] **Step 3: Implementieren**

`lib/musicbrainz/match.ts`:
```ts
import type { TrackQuery } from "./types";

export type MbRecording = {
  title: string;
  firstReleaseDate?: string;
  artistCredit: string[];
};

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Akzente entfernen
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // Klammerzusätze (Remastered, feat., …)
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s-\s.*$/g, "") // " - Live", " - Remastered"
    .replace(/[^a-z0-9\s]/g, "") // Satzzeichen
    .replace(/\s+/g, " ")
    .trim();
}

function parseYear(date?: string): number | null {
  if (!date) return null;
  const match = date.match(/^(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  return year > 0 ? year : null;
}

export function bestRecordingYear(
  query: TrackQuery,
  recordings: MbRecording[],
): number | null {
  const wantTitle = normalize(query.title);
  const wantArtist = normalize(query.artist);

  const years = recordings
    .filter((r) => normalize(r.title) === wantTitle)
    .filter((r) =>
      r.artistCredit.some((a) => normalize(a) === wantArtist),
    )
    .map((r) => parseYear(r.firstReleaseDate))
    .filter((y): y is number => y !== null);

  if (years.length === 0) return null;
  return Math.min(...years);
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/musicbrainz/__tests__/match.test.ts`
Expected: PASS — alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add lib/musicbrainz/types.ts lib/musicbrainz/match.ts lib/musicbrainz/__tests__/match.test.ts
git commit -m "feat: add MusicBrainz title/artist matching and year extraction"
```

---

## Task 3: Rate-Limit-Queue (≥ 1 req/s, TDD)

**Files:**
- Create: `lib/musicbrainz/rate-limit.ts`
- Test: `lib/musicbrainz/__tests__/rate-limit.test.ts`

**Interfaces:**
- Produces: `createRateLimiter(minIntervalMs: number): <T>(fn: () => Promise<T>) => Promise<T>`
  — serialisiert Aufrufe und stellt sicher, dass zwischen Starts ≥ `minIntervalMs` liegen.

- [ ] **Step 1: Failing test schreiben**

`lib/musicbrainz/__tests__/rate-limit.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRateLimiter } from "../rate-limit";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createRateLimiter", () => {
  it("runs tasks serially spaced by at least minInterval", async () => {
    const limit = createRateLimiter(1000);
    const starts: number[] = [];
    const task = (i: number) =>
      limit(async () => {
        starts.push(i);
        return i;
      });

    const p = Promise.all([task(0), task(1), task(2)]);
    await vi.runAllTimersAsync();
    const results = await p;

    expect(results).toEqual([0, 1, 2]);
    expect(starts).toEqual([0, 1, 2]); // serielle Reihenfolge
  });

  it("propagates errors without breaking the queue", async () => {
    const limit = createRateLimiter(0);
    const ok1 = limit(async () => "a");
    const bad = limit(async () => {
      throw new Error("boom");
    });
    const ok2 = limit(async () => "b");
    await vi.runAllTimersAsync();

    await expect(ok1).resolves.toBe("a");
    await expect(bad).rejects.toThrow("boom");
    await expect(ok2).resolves.toBe("b");
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/musicbrainz/__tests__/rate-limit.test.ts`
Expected: FAIL — `Cannot find module '../rate-limit'`.

- [ ] **Step 3: Implementieren**

`lib/musicbrainz/rate-limit.ts`:
```ts
export function createRateLimiter(minIntervalMs: number) {
  let chain: Promise<unknown> = Promise.resolve();
  let lastStart = 0;

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const now = Date.now();
      const wait = Math.max(0, lastStart + minIntervalMs - now);
      if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait));
      }
      lastStart = Date.now();
      return fn();
    };
    // An die Kette hängen; Fehler eines Tasks darf die Kette nicht abreißen lassen.
    const result = chain.then(run, run);
    chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/musicbrainz/__tests__/rate-limit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/musicbrainz/rate-limit.ts lib/musicbrainz/__tests__/rate-limit.test.ts
git commit -m "feat: add serial rate limiter for MusicBrainz requests"
```

---

## Task 4: MusicBrainz-HTTP-Client (TDD mit injiziertem fetch)

**Files:**
- Create: `lib/musicbrainz/client.ts`
- Test: `lib/musicbrainz/__tests__/client.test.ts`

**Interfaces:**
- Consumes: `bestRecordingYear`, `MbRecording` (Task 2); `MUSICBRAINZ_CONTACT` (env)
- Produces: `lookupYear(query: TrackQuery, deps?: { fetchImpl?: typeof fetch }): Promise<number | null>`
  — fragt MusicBrainz `recording`-Suche ab, mappt das JSON auf `MbRecording[]`, gibt `bestRecordingYear` zurück.

- [ ] **Step 1: Failing tests schreiben**

`lib/musicbrainz/__tests__/client.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { lookupYear } from "../client";

beforeEach(() => vi.stubEnv("MUSICBRAINZ_CONTACT", "test@example.com"));

const query = {
  spotifyTrackId: "x",
  title: "Sultans of Swing",
  artist: "Dire Straits",
  spotifyReleaseYear: 2010,
};

function fakeFetch(status: number, body: unknown, capture?: (url: string, init?: RequestInit) => void): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    capture?.(url, init);
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

describe("lookupYear", () => {
  it("returns the earliest matching year from the MB response", async () => {
    const body = {
      recordings: [
        {
          title: "Sultans of Swing",
          "first-release-date": "1979-05-04",
          "artist-credit": [{ name: "Dire Straits" }],
        },
      ],
    };
    const year = await lookupYear(query, { fetchImpl: fakeFetch(200, body) });
    expect(year).toBe(1979);
  });

  it("sends a User-Agent header with the contact", async () => {
    let seen: RequestInit | undefined;
    await lookupYear(query, {
      fetchImpl: fakeFetch(200, { recordings: [] }, (_u, init) => (seen = init)),
    });
    const ua = new Headers(seen?.headers).get("User-Agent");
    expect(ua).toContain("test@example.com");
  });

  it("returns null on HTTP error", async () => {
    const year = await lookupYear(query, { fetchImpl: fakeFetch(503, {}) });
    expect(year).toBeNull();
  });

  it("returns null when the response has no recordings", async () => {
    const year = await lookupYear(query, { fetchImpl: fakeFetch(200, {}) });
    expect(year).toBeNull();
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/musicbrainz/__tests__/client.test.ts`
Expected: FAIL — `Cannot find module '../client'`.

- [ ] **Step 3: Implementieren**

`lib/musicbrainz/client.ts`:
```ts
import type { TrackQuery } from "./types";
import { bestRecordingYear, type MbRecording } from "./match";

type MbResponse = {
  recordings?: Array<{
    title?: string;
    "first-release-date"?: string;
    "artist-credit"?: Array<{ name?: string }>;
  }>;
};

function userAgent(): string {
  const contact = process.env.MUSICBRAINZ_CONTACT ?? "unknown";
  return `Hitster/0.1 ( ${contact} )`;
}

export async function lookupYear(
  query: TrackQuery,
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<number | null> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const q = `recording:"${query.title}" AND artist:"${query.artist}"`;
  const url =
    "https://musicbrainz.org/ws/2/recording/?" +
    new URLSearchParams({ query: q, fmt: "json", limit: "25" }).toString();

  try {
    const res = await fetchImpl(url, {
      headers: { "User-Agent": userAgent(), Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as MbResponse;
    if (!data.recordings || data.recordings.length === 0) return null;

    const recordings: MbRecording[] = data.recordings.map((r) => ({
      title: r.title ?? "",
      firstReleaseDate: r["first-release-date"],
      artistCredit: (r["artist-credit"] ?? []).map((a) => a.name ?? ""),
    }));

    return bestRecordingYear(query, recordings);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/musicbrainz/__tests__/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/musicbrainz/client.ts lib/musicbrainz/__tests__/client.test.ts
git commit -m "feat: add MusicBrainz HTTP client (recording search)"
```

---

## Task 5: Orchestrierung `resolveYears` (Cache ↔ MusicBrainz ↔ Fallback, TDD)

**Files:**
- Create: `lib/musicbrainz/resolve.ts`
- Test: `lib/musicbrainz/__tests__/resolve.test.ts`

**Interfaces:**
- Consumes: `TrackQuery`, `ResolvedYear` (Task 2-Typen); injizierbare Abhängigkeiten für Cache + Lookup + Rate-Limit (für Tests)
- Produces:
  - `resolveYears(queries: TrackQuery[], deps?: ResolveDeps): Promise<ResolvedYear[]>`
  - Typ `ResolveDeps = { getCached: (ids: string[]) => Promise<ResolvedYear[]>; putCached: (rows: Array<ResolvedYear & { title: string; artist: string }>) => Promise<void>; lookup: (q: TrackQuery) => Promise<number | null>; limit: <T>(fn: () => Promise<T>) => Promise<T>; }`
- **Logik:** (1) Cache-Treffer direkt übernehmen. (2) Für Misses je `limit(lookup)`; bei Treffer `source:"musicbrainz"`, sonst Fallback `spotifyReleaseYear` mit `source:"spotify"`. (3) Neue Ergebnisse cachen (Fehler beim Schreiben werden geschluckt). (4) Reihenfolge der Eingabe bleibt erhalten.

- [ ] **Step 1: Failing tests schreiben**

`lib/musicbrainz/__tests__/resolve.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { resolveYears } from "../resolve";
import type { TrackQuery, ResolvedYear } from "../types";

const q = (id: string, year = 2010): TrackQuery => ({
  spotifyTrackId: id,
  title: `t${id}`,
  artist: `a${id}`,
  spotifyReleaseYear: year,
});

describe("resolveYears", () => {
  it("returns cached entries without calling lookup", async () => {
    const lookup = vi.fn();
    const putCached = vi.fn().mockResolvedValue(undefined);
    const result = await resolveYears([q("1")], {
      getCached: async () => [{ spotifyTrackId: "1", year: 1985, source: "musicbrainz" }],
      putCached,
      lookup,
      limit: (fn) => fn(),
    });
    expect(result).toEqual([{ spotifyTrackId: "1", year: 1985, source: "musicbrainz" }]);
    expect(lookup).not.toHaveBeenCalled();
    expect(putCached).not.toHaveBeenCalled();
  });

  it("looks up misses via MusicBrainz and caches them", async () => {
    const putCached = vi.fn().mockResolvedValue(undefined);
    const result = await resolveYears([q("2")], {
      getCached: async () => [],
      putCached,
      lookup: async () => 1979,
      limit: (fn) => fn(),
    });
    expect(result).toEqual([{ spotifyTrackId: "2", year: 1979, source: "musicbrainz" }]);
    expect(putCached).toHaveBeenCalledWith([
      { spotifyTrackId: "2", year: 1979, source: "musicbrainz", title: "t2", artist: "a2" },
    ]);
  });

  it("falls back to the Spotify year when MusicBrainz has no match", async () => {
    const result = await resolveYears([q("3", 2004)], {
      getCached: async () => [],
      putCached: async () => {},
      lookup: async () => null,
      limit: (fn) => fn(),
    });
    expect(result).toEqual([{ spotifyTrackId: "3", year: 2004, source: "spotify" }]);
  });

  it("preserves input order across cached and looked-up entries", async () => {
    const result = await resolveYears([q("a"), q("b"), q("c")], {
      getCached: async () => [{ spotifyTrackId: "b", year: 1990, source: "musicbrainz" }],
      putCached: async () => {},
      lookup: async (query) => (query.spotifyTrackId === "a" ? 1970 : null),
      limit: (fn) => fn(),
    });
    expect(result.map((r) => r.spotifyTrackId)).toEqual(["a", "b", "c"]);
    expect(result[1]).toEqual({ spotifyTrackId: "b", year: 1990, source: "musicbrainz" });
  });

  it("does not fail the batch if caching throws", async () => {
    const result = await resolveYears([q("4", 2001)], {
      getCached: async () => [],
      putCached: async () => {
        throw new Error("db down");
      },
      lookup: async () => 1995,
      limit: (fn) => fn(),
    });
    expect(result).toEqual([{ spotifyTrackId: "4", year: 1995, source: "musicbrainz" }]);
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/musicbrainz/__tests__/resolve.test.ts`
Expected: FAIL — `Cannot find module '../resolve'`.

- [ ] **Step 3: Implementieren**

`lib/musicbrainz/resolve.ts`:
```ts
import type { TrackQuery, ResolvedYear } from "./types";

export type ResolveDeps = {
  getCached: (ids: string[]) => Promise<ResolvedYear[]>;
  putCached: (
    rows: Array<ResolvedYear & { title: string; artist: string }>,
  ) => Promise<void>;
  lookup: (q: TrackQuery) => Promise<number | null>;
  limit: <T>(fn: () => Promise<T>) => Promise<T>;
};

export async function resolveYears(
  queries: TrackQuery[],
  deps: ResolveDeps,
): Promise<ResolvedYear[]> {
  const cached = await deps.getCached(queries.map((q) => q.spotifyTrackId));
  const cachedById = new Map(cached.map((c) => [c.spotifyTrackId, c]));

  const misses = queries.filter((q) => !cachedById.has(q.spotifyTrackId));

  const fresh: Array<ResolvedYear & { title: string; artist: string }> = [];
  for (const q of misses) {
    const mbYear = await deps.limit(() => deps.lookup(q));
    const resolved: ResolvedYear & { title: string; artist: string } =
      mbYear !== null
        ? {
            spotifyTrackId: q.spotifyTrackId,
            year: mbYear,
            source: "musicbrainz",
            title: q.title,
            artist: q.artist,
          }
        : {
            spotifyTrackId: q.spotifyTrackId,
            year: q.spotifyReleaseYear,
            source: "spotify",
            title: q.title,
            artist: q.artist,
          };
    fresh.push(resolved);
  }

  if (fresh.length > 0) {
    try {
      await deps.putCached(fresh);
    } catch {
      // Cache-Schreibfehler sind nicht fatal.
    }
  }

  const freshById = new Map(fresh.map((f) => [f.spotifyTrackId, f]));
  return queries.map((q) => {
    const hit = cachedById.get(q.spotifyTrackId) ?? freshById.get(q.spotifyTrackId)!;
    return { spotifyTrackId: hit.spotifyTrackId, year: hit.year, source: hit.source };
  });
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/musicbrainz/__tests__/resolve.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/musicbrainz/resolve.ts lib/musicbrainz/__tests__/resolve.test.ts
git commit -m "feat: add resolveYears orchestration (cache + MusicBrainz + fallback)"
```

---

## Task 6: Cache-Adapter (Drizzle) + API-Route

**Files:**
- Create: `lib/musicbrainz/cache.ts` (Drizzle-Implementierung von getCached/putCached)
- Create: `lib/musicbrainz/service.ts` (verdrahtet resolveYears mit echten Deps)
- Create: `app/api/musicbrainz/route.ts`
- Test: `lib/musicbrainz/__tests__/cache.test.ts` (nur reine Mapping-Funktion)

**Interfaces:**
- Consumes: `db`, `yearCache` (Task 1); `resolveYears`, `createRateLimiter`, `lookupYear`
- Produces:
  - `rowsToResolved(rows: YearCacheRow[]): ResolvedYear[]` (rein, testbar)
  - `enrichTracks(queries: TrackQuery[]): Promise<ResolvedYear[]>` (production-Verdrahtung)
  - `POST /api/musicbrainz` — akzeptiert `{ tracks: TrackQuery[] }`, gibt `{ years: ResolvedYear[] }`

- [ ] **Step 1: Failing test für die reine Mapping-Funktion**

`lib/musicbrainz/__tests__/cache.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { rowsToResolved } from "../cache";

describe("rowsToResolved", () => {
  it("maps DB rows to ResolvedYear", () => {
    const out = rowsToResolved([
      {
        spotifyTrackId: "1",
        title: "t",
        artist: "a",
        resolvedYear: 1979,
        source: "musicbrainz",
        fetchedAt: new Date(),
      },
    ]);
    expect(out).toEqual([{ spotifyTrackId: "1", year: 1979, source: "musicbrainz" }]);
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/musicbrainz/__tests__/cache.test.ts`
Expected: FAIL — `Cannot find module '../cache'`.

- [ ] **Step 3: Cache-Adapter implementieren**

`lib/musicbrainz/cache.ts`:
```ts
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { yearCache, type YearCacheRow } from "@/db/schema";
import type { ResolvedYear } from "./types";

export function rowsToResolved(rows: YearCacheRow[]): ResolvedYear[] {
  return rows.map((r) => ({
    spotifyTrackId: r.spotifyTrackId,
    year: r.resolvedYear,
    source: r.source,
  }));
}

export async function getCached(ids: string[]): Promise<ResolvedYear[]> {
  if (ids.length === 0) return [];
  const rows = await db.select().from(yearCache).where(inArray(yearCache.spotifyTrackId, ids));
  return rowsToResolved(rows);
}

export async function putCached(
  rows: Array<ResolvedYear & { title: string; artist: string }>,
): Promise<void> {
  if (rows.length === 0) return;
  await db
    .insert(yearCache)
    .values(
      rows.map((r) => ({
        spotifyTrackId: r.spotifyTrackId,
        title: r.title,
        artist: r.artist,
        resolvedYear: r.year,
        source: r.source,
      })),
    )
    .onConflictDoNothing();
}
```

- [ ] **Step 4: Service verdrahten**

`lib/musicbrainz/service.ts`:
```ts
import type { TrackQuery, ResolvedYear } from "./types";
import { resolveYears } from "./resolve";
import { getCached, putCached } from "./cache";
import { lookupYear } from "./client";
import { createRateLimiter } from "./rate-limit";

const limit = createRateLimiter(1100); // ≥ 1 req/s mit Sicherheitsabstand

export function enrichTracks(queries: TrackQuery[]): Promise<ResolvedYear[]> {
  return resolveYears(queries, {
    getCached,
    putCached,
    lookup: (q) => lookupYear(q),
    limit,
  });
}
```

- [ ] **Step 5: API-Route**

`app/api/musicbrainz/route.ts`:
```ts
import { NextResponse } from "next/server";
import { enrichTracks } from "@/lib/musicbrainz/service";
import type { TrackQuery } from "@/lib/musicbrainz/types";

export async function POST(request: Request) {
  let body: { tracks?: TrackQuery[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.tracks)) {
    return NextResponse.json({ error: "tracks must be an array" }, { status: 400 });
  }
  const years = await enrichTracks(body.tracks);
  return NextResponse.json({ years });
}
```

- [ ] **Step 6: Tests + Build**

Run: `npm test && npm run build`
Expected: alle Tests grün, Build erfolgreich.

- [ ] **Step 7: Manuelle Verifikation (optional, erfordert DB + Netz)**

Mit gesetztem `DATABASE_URL` + `MUSICBRAINZ_CONTACT` und migrierter DB:
`curl -X POST http://127.0.0.1:3000/api/musicbrainz -H 'content-type: application/json' -d '{"tracks":[{"spotifyTrackId":"abc","title":"Sultans of Swing","artist":"Dire Straits","spotifyReleaseYear":2010}]}'`
Expected: `{"years":[{"spotifyTrackId":"abc","year":1979,"source":"musicbrainz"}]}` (zweiter Aufruf kommt aus dem Cache).
Hinweis: `/api/musicbrainz` ist durch das App-Gate geschützt (kein Eintrag in der Proxy-Ausnahmeliste) — im Browser zuerst einloggen, oder für den Test das Gate-Cookie mitsenden.

- [ ] **Step 8: Commit**

```bash
git add lib/musicbrainz/cache.ts lib/musicbrainz/service.ts lib/musicbrainz/__tests__/cache.test.ts app/api/musicbrainz/route.ts
git commit -m "feat: add year cache adapter and /api/musicbrainz route"
```

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung (Spec §6.2/§6.3):** Cache-Schema (Task 1), MusicBrainz-Lookup + Matching (Tasks 2,4), Rate-Limit ≥ 1 req/s (Task 3), Orchestrierung + Fallback „ungenau" via `source` (Task 5), serverseitiger Cache + Route (Task 6). ✓
- **Platzhalter:** keine; jeder Code-Step vollständig. ✓
- **Typ-Konsistenz:** `TrackQuery`/`ResolvedYear` (Task 2-Typen) durchgängig; `MbRecording` zwischen Task 2 und 4 identisch; `ResolveDeps`-Signaturen (Task 5) decken sich mit `getCached`/`putCached`/`lookupYear`/`createRateLimiter` (Tasks 3,4,6). `enrichTracks` ist die Schnittstelle, die Plan 4 konsumiert. ✓
- **Scope:** nur Datenschicht; Spotify-Track-Fetching/Deck-Aufbau ist Plan 4.
