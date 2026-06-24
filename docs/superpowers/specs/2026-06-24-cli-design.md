# Kluuzter CLI — Design-Dokument

**Datum:** 2026-06-24
**Status:** Freigegeben (Design), bereit für Implementierungsplan

## 1. Überblick & Ziel

Kluuzter (Hitster-artiges Musik-Ratespiel) soll zusätzlich zur Next.js-Webapp
als CLI-Tool im Terminal spielbar sein. Die CLI ist ein zweiter Frontend-Kopf
auf demselben Kern: Sie lebt im selben Repo und verwendet die vorhandene,
framework-freie Spiel-Engine sowie die Spotify-/MusicBrainz-/DB-Schichten
unverändert wieder. Kein Spiellogik-Code wird dupliziert — die CLI fügt nur
einen Terminal-Adapter und zwei eigene Ränder hinzu (OAuth, lokaler Audio-Player).

Unterstützt wird der volle Funktionsumfang der Engine: Solo und lokaler
Hot-Seat-Multiplayer (1–N Spieler), Konter, Token, beide Spielmodi
(`targetCards`/`fixedRounds`).

## 2. Entscheidungen (aus dem Brainstorming)

- **Audio:** Lokaler Player im Terminal via **librespot** — registriert sich als
  Spotify-Connect-Gerät auf der Maschine und streamt Audio an die lokalen
  Lautsprecher. Voraussetzung: librespot als externe Binary installiert,
  Spotify Premium.
- **Auth:** Eigener **OAuth-Flow mit PKCE**. Beim ersten Start Browser öffnen,
  lokaler Loopback-Callback-Server fängt den Code ab. Refresh-Token wird lokal
  (`~/.config/kluuzter`) gespeichert und für Web-API + librespot wiederverwendet.
- **Umfang:** Solo + Hot-Seat-Multiplayer (volle Engine).
- **Deck-Aufbau:** Lokal bauen, **Neon-DB-Cache teilen** über `DATABASE_URL`.
  Kein laufender Webserver nötig.
- **UI-Stil:** Vollwertige **TUI mit Ink/React**. Der vorhandene
  `useGameEngine`-Hook (`@xstate/react`) wird direkt wiederverwendet, da Ink
  React fürs Terminal ist.

## 3. Architektur & Schichtung

Die CLI ist ein zweiter Frontend-Kopf auf demselben Kern. Sie verwendet
`lib/engine`, `lib/spotify`, `lib/musicbrainz` und `db/` unverändert wieder.

```
kluuzter/
  lib/        ← unverändert geteilt (engine, spotify, musicbrainz)
  db/         ← unverändert geteilt (Neon-Cache via DATABASE_URL)
  app/        ← Next.js-Webapp (unberührt)
  cli/        ← NEU: Terminal-Frontend
    index.tsx       Einstieg: Auth → Setup → Ink-App rendern
    auth/
      pkce.ts        code_verifier/code_challenge (S256), Auth-URL (rein)
      flow.ts        Browser öffnen + Loopback-Server + Code→Token-Tausch
      store.ts       Token lesen/schreiben in ~/.config/kluuzter/tokens.json (0600)
      token.ts       getValidAccessToken(): refresh/Re-Auth bei Ablauf
    audio/
      librespot.ts   Kindprozess spawnen/beenden, Cleanup bei Exit/Ctrl-C
      device.ts      findDevice() (rein) + Poll-Schleife mit Timeout
      controller.ts  play(uri)/pause() — Wrapper über lib/spotify/playback.ts
    deck/
      build.ts       Playlist → Tracks → dedupe → enrich → Card[]
    ui/
      App.tsx        hält useGameEngine(input), rendert je nach phase
      Setup.tsx      Spielernamen, Modus, Zielwert, Tokens, Playlist-Auswahl
      PlayerBar.tsx  aktive Spieler, Tokens
      Timeline.tsx   Timeline des aktiven Spielers
      SlotPicker.tsx Slot-Auswahl (←→ / Enter)
      Reveal.tsx     Auflösung: Jahr + Titel
      GameOver.tsx   Endstand
      useAudioSync.ts  Effekt-Hook: Phasenwechsel → controller.play/pause
```

**Kernprinzip (wie Webapp):** Alle Spielregeln leben ausschließlich in
`lib/engine`. Die CLI sendet nur Events in die Engine und rendert deren Zustand.
Spotify, MusicBrainz und DB sind reine Datenlieferanten am Rand.

**Stack:** Ink (React fürs Terminal) + `@xstate/react` (vorhandener
`useGameEngine`) + `tsx` als TS-Runner. Start via `npm run play`. **Node 22
erforderlich** (wie bei den Tests; vorher `nvm use 22`).

## 4. Die vier Ränder (von trivial nach riskant)

1. **Engine** — null Aufwand. `useGameEngine` = `useMachine(gameMachine, {input})`,
   reines React+XState ohne DOM, läuft in Ink unverändert.
2. **Deck-Aufbau** — gering. `getMyPlaylists`/`getPlaylistTracks` →
   `dedupeTracks` → `buildDeck(tracks, enrichTracks)`. Alles vorhandene
   Funktionen; `enrichTracks` teilt den Neon-Cache über `DATABASE_URL`.
3. **OAuth (PKCE)** — mittel. Browser öffnen, Loopback-Callback-Server, Code→Token
   tauschen, Token in `~/.config/kluuzter/tokens.json` (Modus 0600) speichern.
   Refresh über das vorhandene `refreshAccessToken` aus `lib/spotify/refresh.ts`
   (liest `AUTH_SPOTIFY_ID`/`AUTH_SPOTIFY_SECRET` aus env).
4. **librespot** — Hauptrisiko.
   - librespot läuft als Kindprozess, registriert sich mit dem Access-Token als
     Connect-Gerät „Kluuzter". Die CLI pollt `/me/player/devices`, findet die
     `device_id` und steuert es mit dem vorhandenen `playTrack`/`pausePlayback`
     an. `playback.ts` bleibt unverändert; ergänzt wird nur ein `getDevices()`
     in `lib/spotify`.
   - **WSL2-Warnung:** Zielmaschine ist WSL2. librespot braucht eine
     Audio-Ausgabe; unter WSL2 läuft das über WSLg/PulseAudio, ist aber nicht
     garantiert out-of-the-box. **Muss als erster Schritt praktisch verifiziert
     werden** (siehe §8), bevor die TUI darauf aufgebaut wird.
   - librespot ist eine externe Binary, die der Nutzer installieren muss
     (im README dokumentiert).

## 5. Module im Detail

### cli/auth/
- `pkce.ts` — reine Helfer: `code_verifier`/`code_challenge` (S256), Auth-URL
  bauen. Voll testbar.
- `flow.ts` — Browser öffnen, Loopback-Server auf festem Port, Code abfangen,
  gegen Token tauschen. Scopes: `streaming`, `user-read-email`,
  `user-read-private`, `playlist-read-private`, `playlist-read-collaborative`,
  `user-modify-playback-state`, `user-read-playback-state`.
- `store.ts` — Token lesen/schreiben in `~/.config/kluuzter/tokens.json`
  (Modus 0600).
- `token.ts` — `getValidAccessToken()`: gibt gültigen Token zurück, refresht via
  `lib/spotify/refresh.ts` bei Ablauf, triggert `flow.ts` neu, falls Refresh
  scheitert.

### cli/audio/
- `librespot.ts` — Kindprozess spawnen/beenden (Gerätename „Kluuzter",
  Access-Token übergeben), sauberes Cleanup bei Exit/Ctrl-C.
- `device.ts` — `findDevice(devices, name)`: reine Funktion, die die
  librespot-`device_id` aus der `/me/player/devices`-Liste sucht; plus
  Poll-Schleife mit Timeout.
- `controller.ts` — dünner Wrapper über `playback.ts`: `play(uri)`, `pause()`,
  gebunden an Token + gefundene `device_id`.

### cli/deck/build.ts
Orchestriert `getMyPlaylists` → (Auswahl) → `getPlaylistTracks` →
`dedupeTracks` → `buildDeck(tracks, enrichTracks)`. Gibt fertiges `Card[]` für
`GameInput.deck`.

### cli/ui/
Ink-Komponenten, entsprechen den Web-Komponenten, nur als Ink-Boxen:
- `Setup.tsx` — Spielernamen, Modus (`targetCards`/`fixedRounds`), Zielwert,
  Start-Tokens, Playlist-Auswahl.
- `App.tsx` — hält `useGameEngine(input)`, rendert je nach `phase`.
- `PlayerBar.tsx`, `Timeline.tsx`, `SlotPicker.tsx`, `Reveal.tsx`,
  `GameOver.tsx`.
- `useAudioSync.ts` — Effekt-Hook: reagiert auf Phasenwechsel der Engine und
  ruft `controller.play(currentCard.uri)` bzw. `pause()` beim Reveal.

### Ergänzung in lib/spotify
- `getDevices(token, fetchImpl)` — liest `/me/player/devices`; gleiches Muster
  wie die übrigen API-Funktionen (Token + injizierbares `fetch`).

## 6. Datenfluss (ein Zug)

```
Start → getValidAccessToken() → librespot spawnen → device_id finden
     → deck/build (Playlist wählen, enrich via Neon) → GameInput
     → Ink-App: useGameEngine
        playing:    useAudioSync spielt Mystery-Song (Jahr/Titel verdeckt)
        PLACE/COUNTER/PASS/SKIP → Events in die Engine
        reveal:     Engine rechnet aus; UI zeigt Jahr+Titel, Audio pausiert
        betweenTurns → drawNext → nächste Karte … → gameOver
```

Die Engine bleibt die einzige Regel-Quelle; die CLI sendet nur Events und
rendert Zustand — identisch zur Webapp.

## 7. Fehlerbehandlung

- **Kein/abgelaufener Token** → Refresh, sonst Re-Auth-Flow.
- **librespot fehlt/startet nicht** → klare Meldung mit Installations-Hinweis,
  Abbruch.
- **Gerät nicht gefunden (Poll-Timeout)** → Meldung + Retry-Option.
- **MusicBrainz/DB-Fehler** → vorhandener Fallback greift bereits
  (`yearSource: "spotify"`), kein Absturz.
- **Song in Region nicht spielbar** → vorhandenes `SKIP`-Event der Engine.
- **Ctrl-C** → librespot-Prozess sauber beenden.

## 8. Implementierungsreihenfolge

1. **Spike: librespot-Audio auf WSL2 verifizieren** (echter Ton aus dem
   Terminal), bevor weiteres gebaut wird. Falls hier ein Blocker auftaucht, wird
   der Audio-Rand neu bewertet, bevor Aufwand in die TUI fließt.
2. OAuth-Flow (PKCE) + Token-Store.
3. Deck-Aufbau (CLI-seitig).
4. Audio-Controller (librespot-Prozess + Connect-Steuerung).
5. Ink-TUI + Audio-Sync.

## 9. Tests

- **Engine:** bereits umfassend getestet — unverändert.
- **Neue reine Module** mit Unit-Tests (injizierte `fetch`/`spawn`): `pkce.ts`,
  `device.findDevice` + Poll-Logik, `deck/build` (gemockte API + enrich),
  `getDevices`-Mapping.
- **Ink-Komponenten:** optional leichte Snapshots via `ink-testing-library`;
  Schwerpunkt bleibt auf reiner Logik, nicht auf Render-Details.

## 10. Konfiguration & Voraussetzungen

- `AUTH_SPOTIFY_ID`, `AUTH_SPOTIFY_SECRET`, `DATABASE_URL` — aus der vorhandenen
  Repo-Konfiguration (`.env`).
- Token-Cache separat in `~/.config/kluuzter/tokens.json` (0600).
- librespot-Binary installiert; Spotify Premium; Node 22.
- Start: neues npm-Skript `play` (`tsx cli/index.tsx`); `tsx` als devDependency.

## 11. Bewusst ausgeschlossen (YAGNI)

- Keine globale Installation/Distribution als `bin` zunächst — `npm run play`
  reicht für den Single-User-Einsatz; ein `bin`-Entry kann später folgen.
- Kein Remote-Multiplayer — nur lokaler Hot-Seat.
- Keine Migration der Webapp; sie bleibt unberührt parallel bestehen.
