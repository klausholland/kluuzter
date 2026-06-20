# Entkoppelte Playlist-Indizierung — Design-Dokument

**Datum:** 2026-06-20
**Status:** Entwurf (Design), zur Freigabe

## 1. Problem & Ziel

Der Deck-Aufbau (`POST /api/deck`) reichert das Erstveröffentlichungsjahr jedes
Tracks **synchron** über MusicBrainz an (Rate-Limit ≥ 1 Anfrage/Sekunde). Bei
großen Playlists (≥ 50, real bis mehrere hundert Songs) dauert das Minuten und
überschreitet damit das Function-Timeout von Vercel (Hobby max. 60 s). Lokal
fiel das nicht auf, weil kein Timeout greift.

**Ziel:** Die Anreicherung (das „Indizieren") wird vom Spielstart **entkoppelt**
und in **kleinen, client-orchestrierten Batches** ausgeführt. Dadurch:

- bleibt **jeder einzelne Request** klein und unter dem Vercel-Timeout,
- werden **beliebig große Playlists** unterstützt (der Browser ruft so viele
  Batches auf, wie nötig — er unterliegt keinem Request-Timeout),
- ist die Indizierung **einmalig** (Ergebnis liegt pro Track global im
  `year_cache`) und **manuell auslösbar**,
- startet ein Spiel **sofort**, weil `/api/deck` nur noch aus dem Cache baut.

## 2. Nicht-Ziele (YAGNI)

- Keine externe Queue/kein Worker-Dienst (QStash, Vercel Cron etc.) — die
  Client-Orchestrierung reicht für einen Single-User-Kontext.
- Kein automatisches Hintergrund-Indizieren beim bloßen Auswählen einer
  Playlist — Indizieren wird bewusst per Button ausgelöst.
- Keine Änderung an der MusicBrainz-Matching-Logik, am Rate-Limiter oder am
  `year_cache`-Schema.

## 3. Architektur

```
Setup-Screen (Browser)
   │  1. Playlist-Tracks holen        ──▶ GET /api/spotify/playlist-tracks?id=
   │  2. Index-Status anfragen        ──▶ GET /api/playlist-status?id=
   │  3. "Indizieren" gedrückt:
   │       Schleife über Batches       ──▶ POST /api/index  { tracks: TrackQuery[] }  (≤ INDEX_BATCH_SIZE)
   │       Fortschritt aktualisieren        └─ reichert Batch an, schreibt year_cache, gibt ResolvedYear[] zurück
   │  4. "Spiel starten"               ──▶ POST /api/deck   { playlistIds }
   ▼                                         └─ baut Deck NUR aus year_cache (keine MusicBrainz-Calls)
Spiel
```

**Kernprinzip:** Langlaufende Arbeit (N × ~1,1 s) wird nie in einem einzelnen
Request erledigt, sondern in viele kurze Requests zerlegt, die der Browser
seriell abarbeitet. Der Cache (`year_cache`, Key = Spotify-Track-ID) ist die
gemeinsame Wahrheit zwischen Indizierung und Spielstart.

## 4. Komponenten & Schnittstellen

### 4.1 `GET /api/playlist-status?id=<playlistId>`

Liefert für eine Playlist den Indizierungsstand.

- Holt die Track-IDs der Playlist (vorhandene `getPlaylistTracks`).
- Zählt, wie viele davon bereits im `year_cache` liegen (`getCached`).
- Antwort: `{ total: number, indexed: number, missing: TrackQuery[] }`
  - `missing` = die noch nicht gecachten Tracks als fertige `TrackQuery`-Objekte,
    damit der Client sie direkt batchweise an `/api/index` schicken kann.

### 4.2 `POST /api/index`  Body `{ tracks: TrackQuery[] }`

Reichert **genau die übergebenen Tracks** an (ein Batch).

- Validierung: `tracks` ist ein Array; mehr als `INDEX_BATCH_SIZE` (Default 20)
  → 400 (der Client muss korrekt batchen).
- Nutzt die bestehende `resolveYears`-Orchestrierung (Cache-Lookup →
  MusicBrainz → Fallback → Cache-Write).
- Antwort: `{ years: ResolvedYear[] }`.
- `export const maxDuration = 60` (Sicherheitsnetz; 20 Tracks ≈ 22 s).

### 4.3 `POST /api/deck`  (Änderung)

Baut das Deck **ausschließlich aus dem Cache**:

- Holt die Tracks der gewählten Playlist(s), dedupliziert.
- Lädt zu diesen Track-IDs die gecachten Jahre (`getCached`).
- Baut `Card[]` **nur** aus Tracks, die im Cache sind; **nicht** gecachte
  Tracks werden übersprungen (Design-Entscheidung: „nur aus indizierten Tracks").
- **Kein** MusicBrainz-Aufruf mehr → kein Timeout-Risiko.
- Edge-Case: 0 gecachte Tracks → 409 mit klarer Meldung „Playlist(s) zuerst
  indizieren".

### 4.4 Setup-UI

Pro ausgewählter Playlist:

- **Status-Badge:** „indiziert ✓" / „X von Y indiziert" / „nicht indiziert".
- **„Indizieren"-Button:** startet die Batch-Schleife; währenddessen
  Fortschrittsanzeige (X / Y) und Deaktivierung des Buttons. Nach Abschluss
  Badge auf „indiziert ✓".
- **„Spiel starten":** nutzt unverändert `/api/deck`; ist möglich, sobald
  mindestens genügend Tracks indiziert sind (siehe §5 Fehlerfälle).

Die Batch-Schleife läuft im Client: Sie nimmt `missing` aus `/api/playlist-status`,
zerlegt es in Blöcke à `INDEX_BATCH_SIZE`, ruft `/api/index` pro Block seriell
auf und zählt den Fortschritt hoch. Abbruch/Reload ist unkritisch — bereits
indizierte Tracks bleiben im Cache.

## 5. Fehlerbehandlung

- **`/api/index` Teil-Fehler:** Schlägt MusicBrainz für einzelne Tracks fehl,
  greift der bestehende Spotify-Jahr-Fallback (`source: "spotify"`); der Batch
  schreibt trotzdem in den Cache. Ein fehlgeschlagener HTTP-Batch wird vom
  Client erneut versucht (begrenzte Retries); schlägt er weiter fehl, wird der
  Fortschritt gestoppt und eine Meldung gezeigt — bereits indizierte Batches
  bleiben erhalten.
- **`/api/deck` ohne indizierte Tracks:** 409 + UI-Hinweis „zuerst indizieren".
- **Deck kleiner als für den Modus nötig:** bestehende Setup-Warnung greift
  weiterhin (Track-Anzahl), zusätzlich Hinweis, dass nur indizierte Tracks
  zählen.
- **Cache-/DB-Ausfall:** wie bisher nicht-fatal für Lookups; `/api/index`
  meldet Fehler, der Client stoppt sauber.

## 6. Auswirkungen auf Vercel

- Jeder Request bleibt < 60 s → läuft auf Vercel Hobby.
- `DATABASE_URL` zeigt in Produktion auf Neon → der bestehende `neon-http`-Pfad
  greift automatisch (lokal weiterhin `node-postgres`).
- Keine zusätzliche Infrastruktur nötig.

## 7. Teststrategie

- **Reine Logik (Vitest):** Batch-Aufteilung (`chunk`), Status-Berechnung
  (total/indexed/missing aus Track-Liste + Cache), Deck-Bau-aus-Cache
  (überspringt nicht gecachte Tracks).
- **API-Routes:** schlanke Tests mit gemockten Deps (Status, Index, Deck) —
  korrekte Stati (400 bei zu großem Batch, 409 bei leerem Cache-Deck).
- **UI:** minimal (wie im bestehenden Projekt) — Statusanzeige/Buttonzustände.

## 8. Bewusst unverändert

- MusicBrainz-Matching, Rate-Limiter, `year_cache`-Schema, Engine, Playback.
- Der Cache bleibt global pro Track-ID (kein Playlist-Bezug) — dadurch
  profitieren mehrere Playlists, die denselben Song enthalten, voneinander.
