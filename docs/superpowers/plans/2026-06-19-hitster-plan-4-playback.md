# Hitster Webapp — Plan 4: Spotify-Datenfluss (Playlists, Deck-Aufbau, Web Playback SDK)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eigene & gesuchte Playlists laden, daraus ein gemischtes, MusicBrainz-angereichertes `Card[]`-Deck bauen und Tracks über das Spotify Web Playback SDK im Browser abspielen.

**Architecture:** Serverseitige, reine Wrapper um die Spotify-Web-API (Playlists/Tracks) mit getrennten, getesteten Mapping-Funktionen. Der Deck-Aufbau kombiniert Spotify-Tracks mit `enrichTracks` aus Plan 2 (Cache ↔ MusicBrainz ↔ Fallback) und erzeugt den `Card`-Typ aus Plan 3. API-Routes stellen das dem Client bereit. Die Wiedergabe läuft über reine Transport-Funktionen (`playTrack`/`pause`, mit injizierbarem `fetch` getestet) plus einen dünnen `"use client"`-Hook, der das Web Playback SDK lädt und eine Device-ID liefert.

**Tech Stack:** Spotify Web API + Web Playback SDK, @types/spotify-web-playback-sdk 0.1.19, Next.js 16 Route Handlers, Vitest 4.1.9.

## Global Constraints

- Node 24 (`nvm use 24` vor allen npm/node-Befehlen; Dev-Server `next dev -H 127.0.0.1`)
- `vitest@4.1.9`, TypeScript strict
- **Premium erforderlich** (in Plan 1 geprüft) — das Web Playback SDK spielt nur mit Premium.
- Spotify-Scopes (in Plan 1 gesetzt): `streaming user-read-email user-read-private playlist-read-private playlist-read-collaborative`.
- Access-Token kommt **immer** aus der Auth.js-Session (`auth()` serverseitig); niemals Client-seitig hartkodiert. Auth.js refresht automatisch (Plan 1, Task 4/5).
- Reine Logik (`lib/spotify/api.ts`, `deck.ts`, `playback.ts`) ohne React-/DOM-Import; einziger `"use client"`: `useSpotifyPlayer.ts`.
- Jahres-Quelle pro Karte mitführen (`yearSource`), damit die UI „ungenau" markieren kann.

## Konsumierte Schnittstellen aus früheren Plänen

```ts
// aus Plan 3 — lib/engine/types.ts
export type Card = {
  id: string; uri: string; title: string; artist: string;
  year: number; yearSource: "musicbrainz" | "spotify"; coverUrl: string | null;
};

// aus Plan 2 — lib/musicbrainz/types.ts
export type TrackQuery = {
  spotifyTrackId: string; title: string; artist: string; spotifyReleaseYear: number;
};
export type ResolvedYear = {
  spotifyTrackId: string; year: number; source: "musicbrainz" | "spotify";
};

// aus Plan 2 — lib/musicbrainz/service.ts
export function enrichTracks(queries: TrackQuery[]): Promise<ResolvedYear[]>;
```

## Shared Types (für Plan 5 verbindlich)

```ts
// lib/spotify/types.ts
export type SpotifyPlaylistSummary = {
  id: string;
  name: string;
  imageUrl: string | null;
  trackCount: number;
  owner: string;
};

export type SpotifyTrack = {
  id: string;
  uri: string;
  title: string;
  artist: string; // primärer Interpret
  releaseDate: string; // album.release_date (z. B. "1979", "1979-05", "1979-05-12")
  coverUrl: string | null;
};
```

## File Structure

- `lib/spotify/types.ts` — `SpotifyPlaylistSummary`, `SpotifyTrack`
- `lib/spotify/api.ts` — Web-API-Fetcher + Mapping (Playlists, Suche, Tracks)
- `lib/spotify/deck.ts` — `parseReleaseYear`, `buildTrackQueries`, `buildCard`, `shuffle`, `buildDeck`
- `lib/spotify/playback.ts` — reine Transport-Funktionen (`playTrack`, `pausePlayback`, `transferPlayback`)
- `lib/spotify/useSpotifyPlayer.ts` — `"use client"`-Hook (SDK-Loader, Device-ID)
- `app/api/spotify/token/route.ts` — gibt aktuelles Access-Token aus der Session
- `app/api/spotify/playlists/route.ts` — eigene Playlists / Suche
- `app/api/spotify/playlist-tracks/route.ts` — Tracks einer Playlist
- `app/api/deck/route.ts` — Deck-Aufbau (Tracks → enrich → `Card[]`)
- Tests unter `lib/spotify/__tests__/`

---

## Task 1: Spotify-API-Typen + reine Mapping-Funktionen (TDD)

**Files:**
- Modify: `package.json` (devDependency `@types/spotify-web-playback-sdk`)
- Create: `lib/spotify/types.ts`
- Create: `lib/spotify/api.ts` (nur die Mapping-Funktionen in dieser Task)
- Test: `lib/spotify/__tests__/api-mapping.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  - Typen `SpotifyPlaylistSummary`, `SpotifyTrack`
  - `mapPlaylistSummaries(items: unknown[]): SpotifyPlaylistSummary[]`
  - `mapPlaylistTrackItems(items: unknown[]): SpotifyTrack[]` (filtert `null`-Tracks & lokale Tracks)

- [ ] **Step 1: Dev-Dependency installieren**

```bash
nvm use 24
npm install -D @types/spotify-web-playback-sdk@0.1.19
```

- [ ] **Step 2: Typen-Datei anlegen**

`lib/spotify/types.ts` — exakt der Block aus „Shared Types" oben.

- [ ] **Step 3: Failing tests schreiben**

`lib/spotify/__tests__/api-mapping.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mapPlaylistSummaries, mapPlaylistTrackItems } from "../api";

describe("mapPlaylistSummaries", () => {
  it("maps the Spotify playlist shape", () => {
    const out = mapPlaylistSummaries([
      {
        id: "pl1",
        name: "Oldies",
        images: [{ url: "http://img/1" }],
        tracks: { total: 42 },
        owner: { display_name: "Anna" },
      },
    ]);
    expect(out).toEqual([
      { id: "pl1", name: "Oldies", imageUrl: "http://img/1", trackCount: 42, owner: "Anna" },
    ]);
  });

  it("tolerates missing images and owner name", () => {
    const out = mapPlaylistSummaries([
      { id: "pl2", name: "Empty", images: [], tracks: { total: 0 }, owner: {} },
    ]);
    expect(out[0].imageUrl).toBeNull();
    expect(out[0].owner).toBe("");
  });

  it("skips null entries (Spotify returns them in search)", () => {
    const out = mapPlaylistSummaries([null, { id: "p", name: "n", images: [], tracks: { total: 1 }, owner: {} }]);
    expect(out).toHaveLength(1);
  });
});

describe("mapPlaylistTrackItems", () => {
  const item = {
    track: {
      id: "t1",
      uri: "spotify:track:t1",
      name: "Sultans of Swing",
      is_local: false,
      artists: [{ name: "Dire Straits" }, { name: "Other" }],
      album: { release_date: "1978-10-20", images: [{ url: "http://cover/1" }] },
    },
  };

  it("maps a track item to SpotifyTrack with the primary artist", () => {
    expect(mapPlaylistTrackItems([item])).toEqual([
      {
        id: "t1",
        uri: "spotify:track:t1",
        title: "Sultans of Swing",
        artist: "Dire Straits",
        releaseDate: "1978-10-20",
        coverUrl: "http://cover/1",
      },
    ]);
  });

  it("skips items with a null track (removed songs)", () => {
    expect(mapPlaylistTrackItems([{ track: null }, item])).toHaveLength(1);
  });

  it("skips local tracks (not playable via SDK)", () => {
    const local = { track: { ...item.track, id: "t2", is_local: true } };
    expect(mapPlaylistTrackItems([local])).toHaveLength(0);
  });

  it("skips tracks without an id", () => {
    const noId = { track: { ...item.track, id: null } };
    expect(mapPlaylistTrackItems([noId])).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/spotify/__tests__/api-mapping.test.ts`
Expected: FAIL — `Cannot find module '../api'`.

- [ ] **Step 5: Mapping-Funktionen implementieren**

`lib/spotify/api.ts` (erste Fassung — nur Mapping; Fetcher folgen in Task 2):
```ts
import type { SpotifyPlaylistSummary, SpotifyTrack } from "./types";

type RawPlaylist = {
  id: string;
  name: string;
  images?: Array<{ url: string }>;
  tracks?: { total?: number };
  owner?: { display_name?: string };
};

type RawTrackItem = {
  track: {
    id: string | null;
    uri: string;
    name: string;
    is_local?: boolean;
    artists?: Array<{ name: string }>;
    album?: { release_date?: string; images?: Array<{ url: string }> };
  } | null;
};

export function mapPlaylistSummaries(items: unknown[]): SpotifyPlaylistSummary[] {
  return (items as (RawPlaylist | null)[])
    .filter((p): p is RawPlaylist => p != null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.images?.[0]?.url ?? null,
      trackCount: p.tracks?.total ?? 0,
      owner: p.owner?.display_name ?? "",
    }));
}

export function mapPlaylistTrackItems(items: unknown[]): SpotifyTrack[] {
  return (items as RawTrackItem[])
    .map((i) => i.track)
    .filter((t): t is NonNullable<RawTrackItem["track"]> => t != null)
    .filter((t) => !t.is_local && typeof t.id === "string")
    .map((t) => ({
      id: t.id as string,
      uri: t.uri,
      title: t.name,
      artist: t.artists?.[0]?.name ?? "",
      releaseDate: t.album?.release_date ?? "",
      coverUrl: t.album?.images?.[0]?.url ?? null,
    }));
}
```

- [ ] **Step 6: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/spotify/__tests__/api-mapping.test.ts`
Expected: PASS — alle Tests grün.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/spotify/types.ts lib/spotify/api.ts lib/spotify/__tests__/api-mapping.test.ts
git commit -m "feat: add Spotify playlist/track mapping functions"
```

---

## Task 2: Spotify-Web-API-Fetcher (TDD mit injiziertem fetch)

**Files:**
- Modify: `lib/spotify/api.ts` (Fetcher ergänzen)
- Test: `lib/spotify/__tests__/api-fetch.test.ts`

**Interfaces:**
- Consumes: `mapPlaylistSummaries`, `mapPlaylistTrackItems` (Task 1)
- Produces:
  - `getMyPlaylists(token: string, fetchImpl?: typeof fetch): Promise<SpotifyPlaylistSummary[]>`
  - `searchPlaylists(token: string, query: string, fetchImpl?: typeof fetch): Promise<SpotifyPlaylistSummary[]>`
  - `getPlaylistTracks(token: string, playlistId: string, fetchImpl?: typeof fetch): Promise<SpotifyTrack[]>` (folgt der `next`-Pagination)

- [ ] **Step 1: Failing tests schreiben**

`lib/spotify/__tests__/api-fetch.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { getMyPlaylists, searchPlaylists, getPlaylistTracks } from "../api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("getMyPlaylists", () => {
  it("requests /me/playlists with the bearer token and maps the result", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("https://api.spotify.com/v1/me/playlists");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
      return jsonResponse({
        items: [{ id: "p1", name: "P", images: [], tracks: { total: 3 }, owner: { display_name: "A" } }],
      });
    }) as unknown as typeof fetch;

    const out = await getMyPlaylists("tok", fetchImpl);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("p1");
  });
});

describe("searchPlaylists", () => {
  it("queries /search with type=playlist and the encoded query", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain("https://api.spotify.com/v1/search");
      expect(url).toContain("type=playlist");
      expect(url).toContain(encodeURIComponent("80s hits"));
      return jsonResponse({
        playlists: { items: [{ id: "s1", name: "80s", images: [], tracks: { total: 9 }, owner: { display_name: "X" } }] },
      });
    }) as unknown as typeof fetch;

    const out = await searchPlaylists("tok", "80s hits", fetchImpl);
    expect(out[0].id).toBe("s1");
  });
});

describe("getPlaylistTracks", () => {
  it("follows pagination via the `next` field", async () => {
    const page1 = {
      items: [
        { track: { id: "t1", uri: "spotify:track:t1", name: "One", is_local: false, artists: [{ name: "A" }], album: { release_date: "1990", images: [] } } },
      ],
      next: "https://api.spotify.com/v1/playlists/pl/tracks?offset=100",
    };
    const page2 = {
      items: [
        { track: { id: "t2", uri: "spotify:track:t2", name: "Two", is_local: false, artists: [{ name: "B" }], album: { release_date: "1991", images: [] } } },
      ],
      next: null,
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page1))
      .mockResolvedValueOnce(jsonResponse(page2)) as unknown as typeof fetch;

    const out = await getPlaylistTracks("tok", "pl", fetchImpl);
    expect(out.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("throws on a non-OK response", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "nope" }, 401)) as unknown as typeof fetch;
    await expect(getPlaylistTracks("tok", "pl", fetchImpl)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/spotify/__tests__/api-fetch.test.ts`
Expected: FAIL — Funktionen `getMyPlaylists`/`searchPlaylists`/`getPlaylistTracks` existieren noch nicht.

- [ ] **Step 3: Fetcher ergänzen**

In `lib/spotify/api.ts` oben den Import + Helper ergänzen und die drei Funktionen anhängen:
```ts
const API = "https://api.spotify.com/v1";

async function getJson(
  url: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<Record<string, unknown>> {
  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Spotify API ${res.status} for ${url}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

export async function getMyPlaylists(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SpotifyPlaylistSummary[]> {
  const data = await getJson(`${API}/me/playlists?limit=50`, token, fetchImpl);
  return mapPlaylistSummaries((data.items as unknown[]) ?? []);
}

export async function searchPlaylists(
  token: string,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SpotifyPlaylistSummary[]> {
  const url = `${API}/search?type=playlist&limit=20&q=${encodeURIComponent(query)}`;
  const data = await getJson(url, token, fetchImpl);
  const playlists = (data.playlists as { items?: unknown[] }) ?? {};
  return mapPlaylistSummaries(playlists.items ?? []);
}

export async function getPlaylistTracks(
  token: string,
  playlistId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SpotifyTrack[]> {
  const fields =
    "fields=items(track(id,uri,name,is_local,artists(name),album(release_date,images))),next";
  let url: string | null = `${API}/playlists/${playlistId}/tracks?limit=100&${fields}`;
  const out: SpotifyTrack[] = [];
  while (url) {
    const data: Record<string, unknown> = await getJson(url, token, fetchImpl);
    out.push(...mapPlaylistTrackItems((data.items as unknown[]) ?? []));
    url = (data.next as string | null) ?? null;
  }
  return out;
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/spotify/__tests__/api-fetch.test.ts`
Expected: PASS — alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add lib/spotify/api.ts lib/spotify/__tests__/api-fetch.test.ts
git commit -m "feat: add Spotify Web API fetchers (playlists, search, tracks)"
```

---

## Task 3: Deck-Aufbau-Helfer (TDD)

**Files:**
- Create: `lib/spotify/deck.ts`
- Test: `lib/spotify/__tests__/deck.test.ts`

**Interfaces:**
- Consumes: `SpotifyTrack` (Task 1); `Card` (Plan 3, `@/lib/engine/types`); `TrackQuery`/`ResolvedYear` (Plan 2, `@/lib/musicbrainz/types`)
- Produces:
  - `parseReleaseYear(releaseDate: string): number | null`
  - `buildTrackQueries(tracks: SpotifyTrack[]): TrackQuery[]` (überspringt Tracks ohne parsbares Jahr)
  - `buildCard(track: SpotifyTrack, resolved: ResolvedYear): Card`
  - `shuffle<T>(items: T[], rng?: () => number): T[]`
  - `buildDeck(tracks: SpotifyTrack[], enrich: (q: TrackQuery[]) => Promise<ResolvedYear[]>, rng?: () => number): Promise<Card[]>`

- [ ] **Step 1: Failing tests schreiben**

`lib/spotify/__tests__/deck.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  parseReleaseYear,
  buildTrackQueries,
  buildCard,
  shuffle,
  buildDeck,
} from "../deck";
import type { SpotifyTrack } from "../types";
import type { ResolvedYear } from "@/lib/musicbrainz/types";

function track(id: string, releaseDate: string): SpotifyTrack {
  return {
    id,
    uri: `spotify:track:${id}`,
    title: `Title ${id}`,
    artist: `Artist ${id}`,
    releaseDate,
    coverUrl: `http://cover/${id}`,
  };
}

describe("parseReleaseYear", () => {
  it("parses a full date", () => expect(parseReleaseYear("1979-05-12")).toBe(1979));
  it("parses a year-only value", () => expect(parseReleaseYear("1979")).toBe(1979));
  it("parses a year-month value", () => expect(parseReleaseYear("1979-05")).toBe(1979));
  it("returns null for empty input", () => expect(parseReleaseYear("")).toBeNull());
  it("returns null for garbage", () => expect(parseReleaseYear("abcd")).toBeNull());
});

describe("buildTrackQueries", () => {
  it("builds queries and skips tracks without a parsable year", () => {
    const qs = buildTrackQueries([track("a", "1979"), track("b", "")]);
    expect(qs).toEqual([
      { spotifyTrackId: "a", title: "Title a", artist: "Artist a", spotifyReleaseYear: 1979 },
    ]);
  });
});

describe("buildCard", () => {
  it("merges a track with its resolved year", () => {
    const card = buildCard(track("a", "2010"), {
      spotifyTrackId: "a",
      year: 1979,
      source: "musicbrainz",
    });
    expect(card).toEqual({
      id: "a",
      uri: "spotify:track:a",
      title: "Title a",
      artist: "Artist a",
      year: 1979,
      yearSource: "musicbrainz",
      coverUrl: "http://cover/a",
    });
  });
});

describe("shuffle", () => {
  it("keeps the same multiset of items", () => {
    const out = shuffle([1, 2, 3, 4, 5], () => 0.5);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it("does not mutate the input", () => {
    const input = [1, 2, 3];
    shuffle(input, () => 0);
    expect(input).toEqual([1, 2, 3]);
  });
});

describe("buildDeck", () => {
  it("builds cards from tracks via enrich, then shuffles deterministically", async () => {
    const tracks = [track("a", "2010"), track("b", "2011")];
    const enrich = async (qs: { spotifyTrackId: string }[]): Promise<ResolvedYear[]> =>
      qs.map((q) => ({ spotifyTrackId: q.spotifyTrackId, year: 1980, source: "spotify" as const }));
    // rng () => 0 ⇒ deterministische Reihenfolge
    const deck = await buildDeck(tracks, enrich, () => 0);
    expect(deck).toHaveLength(2);
    expect(deck.every((c) => c.year === 1980 && c.yearSource === "spotify")).toBe(true);
    expect([...deck].map((c) => c.id).sort()).toEqual(["a", "b"]);
  });

  it("drops tracks that have no resolved year", async () => {
    const tracks = [track("a", "2010"), track("b", "2011")];
    const enrich = async (): Promise<ResolvedYear[]> => [
      { spotifyTrackId: "a", year: 1990, source: "musicbrainz" },
    ];
    const deck = await buildDeck(tracks, enrich, () => 0);
    expect(deck.map((c) => c.id)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/spotify/__tests__/deck.test.ts`
Expected: FAIL — `Cannot find module '../deck'`.

- [ ] **Step 3: `deck.ts` implementieren**

`lib/spotify/deck.ts`:
```ts
import type { Card } from "@/lib/engine/types";
import type { ResolvedYear, TrackQuery } from "@/lib/musicbrainz/types";
import type { SpotifyTrack } from "./types";

export function parseReleaseYear(releaseDate: string): number | null {
  const match = /^(\d{4})/.exec(releaseDate);
  if (!match) return null;
  return Number(match[1]);
}

export function buildTrackQueries(tracks: SpotifyTrack[]): TrackQuery[] {
  const queries: TrackQuery[] = [];
  for (const t of tracks) {
    const year = parseReleaseYear(t.releaseDate);
    if (year === null) continue;
    queries.push({
      spotifyTrackId: t.id,
      title: t.title,
      artist: t.artist,
      spotifyReleaseYear: year,
    });
  }
  return queries;
}

export function buildCard(track: SpotifyTrack, resolved: ResolvedYear): Card {
  return {
    id: track.id,
    uri: track.uri,
    title: track.title,
    artist: track.artist,
    year: resolved.year,
    yearSource: resolved.source,
    coverUrl: track.coverUrl,
  };
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function buildDeck(
  tracks: SpotifyTrack[],
  enrich: (queries: TrackQuery[]) => Promise<ResolvedYear[]>,
  rng: () => number = Math.random,
): Promise<Card[]> {
  const queries = buildTrackQueries(tracks);
  const resolved = await enrich(queries);
  const byId = new Map(resolved.map((r) => [r.spotifyTrackId, r]));
  const trackById = new Map(tracks.map((t) => [t.id, t]));

  const cards: Card[] = [];
  for (const [id, r] of byId) {
    const track = trackById.get(id);
    if (track) cards.push(buildCard(track, r));
  }
  return shuffle(cards, rng);
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/spotify/__tests__/deck.test.ts`
Expected: PASS — alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add lib/spotify/deck.ts lib/spotify/__tests__/deck.test.ts
git commit -m "feat: add deck builder (track → query → enrich → Card, shuffle)"
```

---

## Task 4: API-Routes (Token, Playlists, Tracks, Deck)

**Files:**
- Create: `app/api/spotify/token/route.ts`
- Create: `app/api/spotify/playlists/route.ts`
- Create: `app/api/spotify/playlist-tracks/route.ts`
- Create: `app/api/deck/route.ts`
- Create: `lib/spotify/session-token.ts` (Helfer: Token aus Session ziehen)
- Test: `lib/spotify/__tests__/dedupe.test.ts`

**Interfaces:**
- Consumes: `auth` (Plan 1, `@/auth`); `getMyPlaylists`/`searchPlaylists`/`getPlaylistTracks` (Task 2); `buildDeck` (Task 3); `enrichTracks` (Plan 2, `@/lib/musicbrainz/service`); `SpotifyTrack`
- Produces:
  - `GET /api/spotify/token` → `{ accessToken: string } | 401`
  - `GET /api/spotify/playlists?q=<query>` → `SpotifyPlaylistSummary[]` (mit `q`: Suche, ohne: eigene)
  - `GET /api/spotify/playlist-tracks?id=<playlistId>` → `SpotifyTrack[]`
  - `POST /api/deck` mit `{ playlistIds: string[] }` → `{ deck: Card[] }`
  - `dedupeTracks(tracks: SpotifyTrack[]): SpotifyTrack[]` (rein, getestet)

- [ ] **Step 1: Failing test für die reine Dedupe-Funktion**

`lib/spotify/__tests__/dedupe.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { dedupeTracks } from "../deck";
import type { SpotifyTrack } from "../types";

function track(id: string): SpotifyTrack {
  return { id, uri: `spotify:track:${id}`, title: id, artist: id, releaseDate: "1990", coverUrl: null };
}

describe("dedupeTracks", () => {
  it("removes duplicate track ids, keeping first occurrence", () => {
    const out = dedupeTracks([track("a"), track("b"), track("a")]);
    expect(out.map((t) => t.id)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/spotify/__tests__/dedupe.test.ts`
Expected: FAIL — `dedupeTracks` ist noch nicht exportiert.

- [ ] **Step 3: `dedupeTracks` in `deck.ts` ergänzen**

Am Ende von `lib/spotify/deck.ts` anhängen:
```ts
export function dedupeTracks(tracks: SpotifyTrack[]): SpotifyTrack[] {
  const seen = new Set<string>();
  const out: SpotifyTrack[] = [];
  for (const t of tracks) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/spotify/__tests__/dedupe.test.ts`
Expected: PASS.

- [ ] **Step 5: Session-Token-Helfer anlegen**

`lib/spotify/session-token.ts`:
```ts
import { auth } from "@/auth";

/**
 * Liefert das aktuelle Spotify-Access-Token aus der Auth.js-Session
 * (Auth.js refresht automatisch). `null`, wenn nicht angemeldet oder Refresh-Fehler.
 */
export async function getSessionAccessToken(): Promise<string | null> {
  const session = await auth();
  if (!session || session.error || !session.accessToken) return null;
  return session.accessToken;
}
```

- [ ] **Step 6: Token-Route anlegen**

`app/api/spotify/token/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getSessionAccessToken } from "@/lib/spotify/session-token";

export async function GET() {
  const token = await getSessionAccessToken();
  if (!token) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ accessToken: token });
}
```

- [ ] **Step 7: Playlists-Route anlegen**

`app/api/spotify/playlists/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getSessionAccessToken } from "@/lib/spotify/session-token";
import { getMyPlaylists, searchPlaylists } from "@/lib/spotify/api";

export async function GET(request: Request) {
  const token = await getSessionAccessToken();
  if (!token) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const query = new URL(request.url).searchParams.get("q")?.trim();
  const playlists = query
    ? await searchPlaylists(token, query)
    : await getMyPlaylists(token);
  return NextResponse.json(playlists);
}
```

- [ ] **Step 8: Playlist-Tracks-Route anlegen**

`app/api/spotify/playlist-tracks/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getSessionAccessToken } from "@/lib/spotify/session-token";
import { getPlaylistTracks } from "@/lib/spotify/api";

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
  return NextResponse.json(tracks);
}
```

- [ ] **Step 9: Deck-Route anlegen**

`app/api/deck/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getSessionAccessToken } from "@/lib/spotify/session-token";
import { getPlaylistTracks } from "@/lib/spotify/api";
import { buildDeck, dedupeTracks } from "@/lib/spotify/deck";
import { enrichTracks } from "@/lib/musicbrainz/service";
import type { SpotifyTrack } from "@/lib/spotify/types";

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
    return NextResponse.json({ error: "playlistIds must be a non-empty array" }, { status: 400 });
  }

  const all: SpotifyTrack[] = [];
  for (const id of body.playlistIds as string[]) {
    all.push(...(await getPlaylistTracks(token, id)));
  }
  const deck = await buildDeck(dedupeTracks(all), enrichTracks);
  return NextResponse.json({ deck });
}
```

- [ ] **Step 10: Build-Check**

Run: `npm run build`
Expected: erfolgreich (alle Routes typprüfen sauber).

- [ ] **Step 11: Manuelle Verifikation (optional, erfordert Login + DB)**

Im Browser zuerst App-Login + Spotify-Login durchlaufen (sonst greift das App-Gate / 401). Dann z. B. in der Devtools-Konsole:
```js
await (await fetch("/api/spotify/playlists")).json(); // eigene Playlists
await (await fetch("/api/deck", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playlistIds: ["<playlistId>"] }) })).json();
```
Expected: Playlists-Array bzw. `{ deck: [...] }` mit angereicherten Jahren. **Hinweis:** Deck-Aufbau kann je Playlist-Größe dauern (MusicBrainz-Queue ≥ 1 req/s) — dafür ist der Ladescreen in Plan 5.

- [ ] **Step 12: Commit**

```bash
git add lib/spotify/session-token.ts "app/api/spotify/token/route.ts" "app/api/spotify/playlists/route.ts" "app/api/spotify/playlist-tracks/route.ts" "app/api/deck/route.ts" lib/spotify/deck.ts lib/spotify/__tests__/dedupe.test.ts
git commit -m "feat: add Spotify + deck API routes (token, playlists, tracks, deck)"
```

---

## Task 5: Wiedergabe — Transport-Funktionen (TDD) + Web Playback SDK Hook

**Files:**
- Create: `lib/spotify/playback.ts`
- Create: `lib/spotify/useSpotifyPlayer.ts`
- Test: `lib/spotify/__tests__/playback.test.ts`

**Interfaces:**
- Consumes: `/api/spotify/token` (Task 4)
- Produces:
  - `playTrack(token: string, deviceId: string, uri: string, fetchImpl?: typeof fetch): Promise<void>`
  - `pausePlayback(token: string, deviceId: string, fetchImpl?: typeof fetch): Promise<void>`
  - `transferPlayback(token: string, deviceId: string, fetchImpl?: typeof fetch): Promise<void>`
  - Typ `PlaybackState = { paused: boolean; position: number; duration: number }`
  - `useSpotifyPlayer()` → `{ deviceId: string | null; ready: boolean; error: string | null; playback: PlaybackState | null; togglePlay: () => void }`

- [ ] **Step 1: Failing tests für die Transport-Funktionen schreiben**

`lib/spotify/__tests__/playback.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { playTrack, pausePlayback, transferPlayback } from "../playback";

describe("playTrack", () => {
  it("PUTs /me/player/play with the device id and track uri", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://api.spotify.com/v1/me/player/play?device_id=dev1");
      expect(init?.method).toBe("PUT");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
      expect(JSON.parse(init?.body as string)).toEqual({ uris: ["spotify:track:t1"] });
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;

    await playTrack("tok", "dev1", "spotify:track:t1", fetchImpl);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("throws on a non-OK response", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 403 })) as unknown as typeof fetch;
    await expect(playTrack("tok", "dev1", "spotify:track:t1", fetchImpl)).rejects.toThrow();
  });
});

describe("pausePlayback", () => {
  it("PUTs /me/player/pause with the device id", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://api.spotify.com/v1/me/player/pause?device_id=dev1");
      expect(init?.method).toBe("PUT");
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    await pausePlayback("tok", "dev1", fetchImpl);
  });
});

describe("transferPlayback", () => {
  it("PUTs /me/player with the device id and play=false", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://api.spotify.com/v1/me/player");
      expect(JSON.parse(init?.body as string)).toEqual({ device_ids: ["dev1"], play: false });
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    await transferPlayback("tok", "dev1", fetchImpl);
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/spotify/__tests__/playback.test.ts`
Expected: FAIL — `Cannot find module '../playback'`.

- [ ] **Step 3: Transport-Funktionen implementieren**

`lib/spotify/playback.ts`:
```ts
const API = "https://api.spotify.com/v1";

async function putPlayer(
  url: string,
  token: string,
  body: unknown | undefined,
  fetchImpl: typeof fetch,
): Promise<void> {
  const res = await fetchImpl(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Spotify playback ${res.status} for ${url}`);
  }
}

export function playTrack(
  token: string,
  deviceId: string,
  uri: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  return putPlayer(
    `${API}/me/player/play?device_id=${deviceId}`,
    token,
    { uris: [uri] },
    fetchImpl,
  );
}

export function pausePlayback(
  token: string,
  deviceId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  return putPlayer(
    `${API}/me/player/pause?device_id=${deviceId}`,
    token,
    undefined,
    fetchImpl,
  );
}

export function transferPlayback(
  token: string,
  deviceId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  return putPlayer(
    `${API}/me/player`,
    token,
    { device_ids: [deviceId], play: false },
    fetchImpl,
  );
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/spotify/__tests__/playback.test.ts`
Expected: PASS — alle Tests grün.

- [ ] **Step 5: Web Playback SDK Hook implementieren**

`lib/spotify/useSpotifyPlayer.ts`:
```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";

export type PlaybackState = {
  paused: boolean;
  position: number; // ms
  duration: number; // ms
};

/** Holt ein frisches Access-Token aus der Session-Route (Auth.js refresht serverseitig). */
async function fetchToken(): Promise<string> {
  const res = await fetch("/api/spotify/token");
  if (!res.ok) throw new Error("token fetch failed");
  const data = (await res.json()) as { accessToken: string };
  return data.accessToken;
}

function loadSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Spotify) return Promise.resolve();
  return new Promise((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = SDK_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

export function useSpotifyPlayer() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const playerRef = useRef<Spotify.Player | null>(null);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    loadSdk().then(() => {
      if (cancelled || !window.Spotify) return;

      const player = new window.Spotify.Player({
        name: "Hitster Web Player",
        getOAuthToken: (cb) => {
          fetchToken()
            .then(cb)
            .catch(() => setError("Token konnte nicht geladen werden."));
        },
        volume: 0.8,
      });
      playerRef.current = player;

      player.addListener("ready", ({ device_id }) => {
        if (cancelled) return;
        setDeviceId(device_id);
        setReady(true);
      });
      player.addListener("not_ready", () => setReady(false));
      player.addListener("initialization_error", ({ message }) => setError(message));
      player.addListener("authentication_error", ({ message }) => setError(message));
      player.addListener("account_error", () =>
        setError("Spotify Premium erforderlich für die Wiedergabe."),
      );
      player.addListener("player_state_changed", (state) => {
        if (!state) {
          setPlayback(null);
          return;
        }
        setPlayback({
          paused: state.paused,
          position: state.position,
          duration: state.duration,
        });
      });

      player.connect();

      // Lokaler Tick für einen flüssigen Fortschrittsbalken zwischen SDK-Events.
      interval = setInterval(() => {
        setPlayback((prev) =>
          prev && !prev.paused
            ? { ...prev, position: Math.min(prev.position + 250, prev.duration) }
            : prev,
        );
      }, 250);
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, []);

  const togglePlay = useCallback(() => {
    playerRef.current?.togglePlay();
  }, []);

  return { deviceId, ready, error, playback, togglePlay };
}
```

> Die `Spotify.*`-Typen und `window.onSpotifyWebPlaybackSDKReady`/`window.Spotify` kommen aus `@types/spotify-web-playback-sdk` (Task 1) — global verfügbar, kein Import nötig.

- [ ] **Step 6: Build-Check**

Run: `npm run build`
Expected: erfolgreich (der `"use client"`-Hook und die SDK-Typen compilieren sauber).

- [ ] **Step 7: Manuelle Verifikation (erfordert Premium + Login)**

In Plan 5 wird der Hook in den Gameplay-Screen eingebunden; eine isolierte Verifikation: temporär `useSpotifyPlayer()` in `app/page.tsx` aufrufen und `deviceId`/`error` anzeigen.
- Nach App- + Spotify-Login (Premium) erscheint nach kurzer Zeit eine `deviceId`.
- Mit einem gültigen Token + Device-ID `playTrack(token, deviceId, "spotify:track:...")` aufrufen → Song läuft im Browser-Tab.
Expected: Device wird ready; Wiedergabe startet. (Ad-Blocker/Tracking-Schutz können das SDK blockieren → `error` zeigt die Ursache.)

- [ ] **Step 8: Commit**

```bash
git add lib/spotify/playback.ts lib/spotify/useSpotifyPlayer.ts lib/spotify/__tests__/playback.test.ts
git commit -m "feat: add Spotify playback transport and Web Playback SDK hook"
```

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung (§6.1):** Premium-Check (Plan 1); Playlist-Auswahl eigene + Suche (Task 2 `getMyPlaylists`/`searchPlaylists`, Route in Task 4); Deck-Aufbau mit `id`/Titel/Interpret/`release_date`/Cover (Task 1 Mapping, Task 3 `buildCard`); MusicBrainz-Anreicherung als Batch beim Spielstart (Task 4 `/api/deck` ruft `enrichTracks` aus Plan 2 → Ladescreen in Plan 5); Wiedergabe über SDK-Device-ID (Task 5 `playTrack` + `useSpotifyPlayer`). ✓
- **Fehlerbehandlung (§8 Spotify):** Token aus Session inkl. Auto-Refresh (`getSessionAccessToken`, 401 bei Fehler); SDK-Init-/Account-/Auth-Fehler → `error`-State im Hook (klare Meldung, inkl. „Premium erforderlich"); lokale/unspielbare Tracks werden beim Mapping aussortiert (`mapPlaylistTrackItems`). Track-Skip „in Region nicht spielbar" wird in Plan 5 (Gameplay) behandelt, sobald `playTrack` fehlschlägt. ✓
- **Platzhalter:** keine; jeder Code-Step vollständig. ✓
- **Typ-Konsistenz:** `SpotifyTrack`/`SpotifyPlaylistSummary` zentral in `types.ts`; `Card` aus Plan 3 unverändert konsumiert (`buildCard`); `TrackQuery`/`ResolvedYear`/`enrichTracks` aus Plan 2 unverändert konsumiert; `getPlaylistTracks`/`buildDeck`/`dedupeTracks`-Signaturen identisch zwischen Definition und Route-Aufruf. ✓
- **Scope:** nur Datenfluss + Wiedergabe-Bausteine. Das Einbinden in Screens (Setup, Ladescreen, Gameplay-Controls, Fortschrittsbalken) ist Plan 5; die Spiellogik ist Plan 3.
```
