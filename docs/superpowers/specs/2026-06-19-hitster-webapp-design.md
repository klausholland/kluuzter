# Hitster-Style Musikspiel — Design-Dokument

**Datum:** 2026-06-19
**Status:** Freigegeben (Design), bereit für Implementierungsplan

## 1. Überblick & Ziel

Eine Next.js-Webapp, die das Musikspiel *Hitster* nachbildet: Ein Song wird
abgespielt, der Spieler rät das Erscheinungsjahr und ordnet den Song
chronologisch in seine Timeline ein. Spotify-Playlists dienen als Kartenstapel.
Das Spiel ist solo und im lokalen Hot-Seat-Multiplayer (mehrere Spieler an einem
Gerät) spielbar.

Die App wird öffentlich gehostet, ist aber durch eine Single-User-Sperre
geschützt (nur der Betreiber nutzt sie). Songs werden mit voller Länge über das
Spotify Web Playback SDK abgespielt (Spotify Premium erforderlich). Echte
Erstveröffentlichungsjahre werden über MusicBrainz angereichert.

Es werden durchgehend die aktuellen Versionen der Frameworks/Dependencies
verwendet.

## 2. Tech-Stack

- **Next.js 16** (App Router, React 19, TypeScript)
- **Auth.js v5 (NextAuth)** mit Spotify-Provider — Session + automatischer
  Access-Token-Refresh für Spotify
- **XState v5** — Spiel-Engine als isolierte, framework-freie State Machine
- **Spotify Web Playback SDK** — Wiedergabe im Browser (Premium erforderlich)
- **MusicBrainz API** — serverseitig angefragt, Ergebnisse gecacht
- **Neon Postgres + Drizzle ORM** — ausschließlich für den MusicBrainz-Jahres-Cache
- **Tailwind CSS v4** — Styling, mobile-first/responsive
- **Vitest** — Tests (Schwerpunkt Engine)
- **Hosting:** Vercel

## 3. Architektur & Schichtung

```
app/
  login/                App-Sperre (Single-User-Passwort)
  api/
    musicbrainz/        Server-Proxy + Cache-Lookup für Jahres-Anreicherung
    auth/               Auth.js-Routen (Spotify-OAuth)
  (game routes / UI)
middleware.ts           App-Gate: schützt alle Routen außer /login + Auth-Callbacks
lib/
  engine/               XState Spiel-Engine (rein, framework-frei, getestet)
  spotify/              Playback-SDK-Wrapper, Playlist-/Track-Fetching
  musicbrainz/          Lookup + Titel/Interpret-Matching + Jahr-Extraktion
db/                     Drizzle Schema + Client (year_cache)
components/             React-UI, konsumiert Engine-State über Hook
```

**Kernprinzip:** Alle Spielregeln (Phasen, Platzierung, Token, Konter, Scoring,
Win-Conditions) leben ausschließlich in `lib/engine` als reines TS-Modul ohne
React-Import. Die UI sendet nur Events in die Engine und rendert deren Zustand.
Spotify, MusicBrainz und DB sind reine Datenlieferanten am Rand. Diese Trennung
hält die Engine testbar und macht die Regeln unabhängig von der Darstellung
verstehbar.

## 4. Authentifizierung (zwei Schichten)

### 4.1 App-Sperre (Single-User)

- `/login`-Seite: Passwort wird gegen `APP_PASSWORD` (Umgebungsvariable) geprüft.
- Bei Erfolg: signiertes HttpOnly-Cookie (HMAC, signiert mit `APP_SECRET`).
- Next.js-Middleware schützt alle Routen außer `/login` und den Auth-Callbacks.
- Falsches Passwort → Fehlermeldung auf `/login`.

### 4.2 Spotify-Login (Playback)

- Auth.js v5 mit Spotify-Provider, Scopes: `streaming`, `user-read-email`,
  `user-read-private`, `playlist-read-private`, `playlist-read-collaborative`.
- Beim Start wird Premium geprüft (`product`-Feld). Ohne Premium: klare
  Blockier-Meldung mit Erklärung.
- Auth.js übernimmt den automatischen Refresh des nach 1h ablaufenden
  Access-Tokens (wichtig bei langen Partien). Schlägt der Refresh fehl → Re-Login.

## 5. Spiel-Engine & Regeln

Die Engine ist eine XState-State-Machine und funktioniert für 1–N Spieler
identisch (Solo = 1 Spieler).

### 5.1 Setup einer Partie

Vor Spielstart konfigurierbar:

- Spieleranzahl, Namen und Zugreihenfolge
- **Modus** (vor Spielstart festzulegen):
  - **„X Karten erreichen"** — erster Spieler mit X korrekt platzierten Karten
    gewinnt (Default-Ziel: 10).
  - **„Feste Rundenzahl"** — nach N Runden gewinnt, wer die meisten Karten hat.
- Zielwert (X Karten bzw. N Runden)
- Start-Token-Anzahl pro Spieler
- Playlist(s) als Kartenstapel

Deck = Tracks der gewählten Playlist(s), gemischt. Jeder Spieler erhält 1
Startkarte offen (Jahr sichtbar) als Anker auf seiner Timeline.

### 5.2 Phasen pro Zug (aktiver Spieler A)

```
idle → playing      (Song läuft; Interpret/Jahr/Titel verborgen)
     → placing      (A setzt die Mystery-Karte per Tap in einen Slot seiner Timeline)
     → countering   (Konter-Fenster, reihum durch die anderen Spieler)
     → reveal        (echtes Jahr/Interpret/Titel werden gezeigt, Auswertung)
     → scoring → [Win-Check] → nextTurn | gameOver
```

### 5.3 Platzierungs-Mechanik

Relative Einordnung wie im Original: Der Spieler setzt die Karte in einen Slot
*zwischen* zwei bestehende Timeline-Karten (oder an die Enden), ohne das Jahr zu
kennen. Korrekt, wenn das echte Jahr in diese Lücke passt. Erst danach wird das
Jahr aufgedeckt.

### 5.4 Konter-Mechanik (Token)

- Nach A's Platzierung können reihum die anderen Spieler **1 Token** ausgeben, um
  zu kontern: Sie setzen dieselbe Karte in einen *anderen* freien Slot von A's
  Timeline (ihre eigene Vermutung). Ein Slot kann nicht doppelt belegt werden;
  jeder Konternde wählt einen noch freien Slot oder passt.
- **Auswertung beim Aufdecken:**
  - A's Slot korrekt → A behält die Karte (zählt zu A's Timeline).
  - A falsch, aber ein Konter-Slot korrekt → der Konternde gewinnt die Karte auf
    seine eigene Timeline.
  - Alle Slots falsch → Karte wird verworfen.

### 5.5 Token verdienen (Ehrensystem)

Nach dem Aufdecken kann der aktive Spieler per Selbstbestätigung angeben, ob er
Titel & Interpret korrekt (laut) genannt hat. Bestätigt er „richtig", erhält er
+1 Token. Keine Texteingabe/Validierung — bei lokalem Spiel ausreichend.

### 5.6 Sieg / Spielende

- **X Karten:** Erster Spieler mit X Karten gewinnt.
- **Feste Runden:** Nach N Runden gewinnt der Spieler mit den meisten Karten;
  bei Gleichstand entscheidet die höhere Zahl verbliebener Token.

## 6. Datenfluss

### 6.1 Spotify

1. Nach Spotify-Login: Premium-Check.
2. **Playlist-Auswahl:** Server-Route lädt eigene Playlists (`/me/playlists`) und
   erlaubt die Suche nach öffentlichen Playlists (`/search?type=playlist`).
3. **Deck-Aufbau:** Tracks der Playlist holen; pro Track: `id`, Titel, Interpret,
   `album.release_date`, Cover.
4. **Wiedergabe:** Web Playback SDK erstellt einen Browser-Player; die Engine
   triggert das Abspielen eines Tracks über die SDK-Device-ID.

### 6.2 MusicBrainz-Anreicherung (echtes Erscheinungsjahr)

Beim Deck-Aufbau wird pro Track das Erstveröffentlichungsjahr ermittelt:

1. **Cache-Lookup** in Postgres (`year_cache`, Key = Spotify-Track-ID).
2. Cache-Miss → Server-Route fragt MusicBrainz (Recording-Suche nach
   Titel + Interpret, `first-release-date` der frühesten Aufnahme).
   Rate-Limit: serielle Queue mit ≥ 1 Anfrage/Sekunde.
3. Ergebnis (Jahr + Quelle) wird gecacht.
4. **Fallback bei No-Match / Ausfall:** Jahr aus Spotify-`release_date`, im Spiel
   als „ungenau" markiert.

Die Anreicherung läuft als Batch beim Spielstart („Deck wird vorbereitet"-
Ladescreen), damit es im Spiel keine Wartezeiten gibt.

### 6.3 DB-Schema (Drizzle / Neon Postgres)

```
year_cache(
  spotify_track_id  PK,
  title             text,
  artist            text,
  resolved_year     int,
  source            enum('musicbrainz','spotify'),
  fetched_at        timestamptz
)
```

Es werden keine Highscores oder Spielstände persistiert. Das Endergebnis einer
Partie lebt nur im flüchtigen Spielzustand und ist nach der Runde verloren.

## 7. UI / Screens

Mobile-first und responsive (Desktop, Tablet, Smartphone; Hoch- und Querformat).

1. **App-Login (`/login`):** Passwortfeld (App-Sperre).
2. **Spotify-Login:** Spotify-Login-Button; danach Premium-Check (ohne Premium:
   Sperr-Meldung).
3. **Setup:** Spieler anlegen (Namen, Reihenfolge), Modus + Zielwert,
   Start-Token-Anzahl, Playlist-Auswahl (eigene Playlists + Suche). Anschließend
   „Deck wird vorbereitet"-Ladescreen (MusicBrainz-Batch).
4. **Gameplay (Fokus-Layout):**
   - Schmale Mitspieler-Leiste oben (Name, Kartenanzahl, Token; aktiver Spieler
     hervorgehoben).
   - Timeline des aktiven Spielers in der Mitte, horizontal. Karten im
     Original-Hitster-Stil: quadratisch/hochkant, kräftige Farbe, **Interpret
     oben**, **großes Jahr in der Mitte**, **Songtitel unten**.
   - „+"-Einsetz-Slots zwischen den Karten; der gewählte Slot ist hervorgehoben.
   - Mystery-Karte (verdeckt) + Play/Pause-Control und Fortschrittsbalken unten
     zentriert.
   - „Hier einsetzen"-Button zum Bestätigen der Platzierung.
   - **Responsive:** Timeline auf kleinen Screens horizontal scrollbar; Einsetzen
     per **Tap auf einen Slot** (kein Drag), Touch-Trefferflächen ≥ ~44px;
     Mitspieler-Leiste klappt kompakter.
5. **Konter-Fenster:** Banner/Overlay „Wer will kontern?" — Mitspieler reihum,
   jeder kann 1 Token einsetzen und einen anderen Slot wählen oder passen.
6. **Reveal:** Mystery-Karte dreht sich um und zeigt Interpret/Jahr/Titel;
   korrekte vs. falsche Slots werden farblich markiert; die Karte wandert
   animiert zum Gewinner. Danach optionaler Token-Selbstbestätigungs-Dialog für
   den aktiven Spieler.
7. **Game Over:** Endstand aller Spieler (Kartenanzahl), Sieger hervorgehoben,
   „Neue Runde"-Button. Es wird nichts persistiert.

## 8. Fehlerbehandlung

- **App-Gate:** Falsches Passwort → Fehlermeldung auf `/login`. Alle geschützten
  Routen über Middleware abgesichert.
- **Spotify:** Kein Premium → Blockierung mit Erklärung. Token abgelaufen →
  Auth.js-Refresh; Fehlschlag → Re-Login. Playback-SDK-Fehler (Init, Device nicht
  bereit, Ad-Blocker) → klare Meldung + Retry. Track in Region nicht spielbar →
  überspringen, nächste Karte.
- **Playlist:** Zu wenige Tracks für den gewählten Modus → Warnung schon im Setup.
- **MusicBrainz:** Rate-Limit/Timeout/kein Match → Fallback auf Spotify-Jahr (als
  „ungenau" markiert). Komplett-Ausfall → Batch fällt sauber auf Spotify-Jahre
  zurück, Spiel bleibt spielbar.
- **DB/Cache:** Cache-Schreibfehler → nicht-fatal; Lookup funktioniert weiter
  (nur ohne Caching).

## 9. Teststrategie (Vitest)

- **Engine (Schwerpunkt):** State-Machine-Übergänge, Platzierungs-Validierung
  (Slot-Korrektheit), Scoring, Token-/Konter-Auflösung (inkl. mehrerer Konter
  reihum), Win-Conditions beider Modi, Edge-Cases (leeres Deck, Gleichstand).
- **MusicBrainz-Matching:** Unit-Tests für Titel/Interpret-Matching und
  Jahr-Extraktion (mit Fixtures).
- **API-Routes:** schlanke Integrationstests mit gemockten externen Calls.
- **UI:** bewusst minimal (Komponenten konsumieren nur Engine-State).

## 10. Bewusst außerhalb des Scopes (YAGNI)

- **Online-Multiplayer** (räumlich getrennte Spieler, Echtzeit-Sync,
  synchronisierte Wiedergabe über mehrere Konten): nicht in diesem Scope. Die
  isolierte Engine ist jedoch so gebaut, dass die Spiellogik später
  serverseitig wiederverwendet werden könnte.
- **Persistente Highscores / Spielstände.**
- **Mehrbenutzer-Accounts** (App ist Single-User).
```
