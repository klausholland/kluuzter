# Kluuzter im Terminal (CLI)

Spiele Kluuzter im Terminal — gleiche Spiel-Engine wie die Webapp, Audio über einen
lokalen librespot-Player, der als Spotify-Connect-Gerät „Kluuzter" läuft.

## Voraussetzungen
- Node 22 (`nvm use 22`)
- Spotify **Premium**
- **librespot** installiert — die Installationsweise und die konkreten Start-Flags sind
  in `cli/audio/NOTES.md` noch als **PENDING** markiert (der Audio-Spike aus Task 1,
  Schritt 6, wurde bisher nicht von einem Menschen mit echtem librespot-Binary und
  funktionierender WSL2-Audioausgabe durchgeführt). Bevor `npm run play` zum ersten Mal
  läuft: Schritt 6 in `cli/audio/NOTES.md` abarbeiten, librespot installieren, die dort
  vorgeschlagenen Flags (`--name Kluuzter --access-token <token> --bitrate 320`) gegen
  `librespot --help` verifizieren und den Abschnitt „CONFIRMED FLAGS" in NOTES.md
  ausfüllen. `cli/audio/librespot.ts` verwendet aktuell die vorgeschlagenen, noch nicht
  bestätigten Flags.
- In den Spotify-App-Einstellungen muss die Redirect-URI `http://127.0.0.1:8888/callback` eingetragen sein
- `.env` mit `AUTH_SPOTIFY_ID`, `AUTH_SPOTIFY_SECRET`, `DATABASE_URL` (wie für die Webapp)

## Starten
```bash
nvm use 22
npm run play
```
Beim ersten Start öffnet sich der Browser für den Spotify-Login; danach wird der Token
in `~/.config/kluuzter/tokens.json` gecacht.

## Ablauf
1. Anmeldung bei Spotify (oder gecachter Token).
2. librespot startet lokal als Connect-Gerät „Kluuzter"; die CLI wartet, bis das Gerät
   in der Spotify-Geräteliste erscheint.
3. Setup-Assistent: Spieler eingeben, Modus wählen (Ziel-Kartenzahl oder feste
   Rundenzahl), Start-Tokens, Playlist auswählen.
4. Das Deck wird aus der gewählten Playlist gebaut (Erscheinungsjahre werden
   angereichert).
5. Spielschleife: Mystery-Song läuft über librespot, aktiver Spieler ordnet ihn in
   seine Timeline ein, Mitspieler können kontern oder passen, Auflösung zeigt
   Titel/Jahr/Ergebnis.
6. Spielende: Standings (Karten pro Spieler, Tokens, Sieger).

## Steuerung
- ↑/↓ + Enter: Auswahl (Slot, Modus, Playlist, …)
- Beim Mystery-Song den Einordnungs-Slot wählen; Mitspieler können kontern oder passen
- Ctrl-C beendet das Spiel und stoppt librespot
