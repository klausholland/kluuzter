# Design: Drei Gameplay-Features (Abbrechen, Kartendetail, Anker zählen)

Datum: 2026-06-20

## Überblick

Drei voneinander unabhängige Features für das Hitster-artige Musikspiel:

1. **Laufende Runde abbrechen** — während des Spiels zurück zum Setup, mit Sicherheitsabfrage.
2. **Detailansicht einer Karte** — Klick auf eine aufgedeckte Zeitleisten-Karte zeigt lange Interpreten-/Songnamen vollständig.
3. **Startkarte (Anker) mitzählen** — die initiale Ankerkarte zählt zur Kartenanzahl des Spielers, auch für die Gewinnbedingung.

Die Features sind unabhängig und können in beliebiger Reihenfolge umgesetzt werden.

---

## Feature 1 — Laufende Runde abbrechen → zurück zum Setup

### Verhalten
Während eines laufenden Spiels kann der Nutzer das Spiel abbrechen und gelangt zum Setup-Bildschirm zurück. Der Spielfortschritt geht dabei verloren.

### Ansatz: Reine UI-Lösung (keine State-Machine-Änderung)
`GameScreen` erhält einen „Abbrechen"-Button, platziert oben bei/neben der `PlayerBar`. Ein Klick öffnet eine **Sicherheitsabfrage**. Bei Bestätigung wird das bereits vorhandene `onRestart()` aufgerufen → `GameApp` setzt die Szene auf `setup` zurück und die State-Machine wird mit dem Unmount von `GameScreen` verworfen.

*Verworfene Alternative:* ein `ABORT`-Event mit eigenem `aborted`-Final-State in der Machine — unnötig, da der Unmount via `onRestart` den Zustand ohnehin vollständig zurücksetzt.

### Komponenten
- **`ConfirmDialog`** (neu, wiederverwendbar): Overlay mit Titel/Text und zwei Aktionen („Abbrechen" / „Bestätigen"). Schließbar per Hintergrund-Klick und Escape.
- **`GameScreen`**: hält einen lokalen `showAbortConfirm`-State; rendert den Abbrechen-Button und bei Bedarf den `ConfirmDialog`. Bestätigung ruft `onRestart()` auf.

### Sichtbarkeit
Der Abbrechen-Button ist während des Spiels sichtbar (Phasen `playing`, `countering`, `reveal`). Im `gameOver`-Screen entfällt er (dort existiert bereits „Neues Spiel" via `onRestart`).

---

## Feature 2 — Detailansicht von Zeitleisten-Karten per Klick

### Verhalten
Ein Klick/Tap auf eine aufgedeckte Karte in der Zeitleiste öffnet ein zentriertes Overlay, das **Interpret, Titel, Jahr und Cover** vollständig (ohne `truncate`) anzeigt — inklusive des `≈ ungenau`-Hinweises bei `yearSource === "spotify"`. Schließen per Klick auf Hintergrund, X-Button oder Escape.

### Scope
- **Nur aufgedeckte Zeitleisten-Karten** sind klickbar.
- Die verdeckte Mystery-Karte (`faceDown`) bekommt **keine** Detailansicht.
- Die Slot-Auswahl und das Drag-and-Drop der Mystery-Karte bleiben unberührt (Karten sind keine Slots; Slots liegen zwischen den Karten).

### Ansatz: Modal-Overlay
Robuster als ein Inline-Popover/Tooltip, besonders auf kleinen (Party-)Handy-Screens.

*Verworfene Alternative:* Inline-Popover/Tooltip — auf schmalen Screens schwer zu platzieren.

### Komponenten
- **`CardDetail`** (neu): Overlay, das eine `Card` vollständig darstellt (Cover, Interpret, Titel, Jahr, ggf. „≈ ungenau"). `onClose`-Callback.
- **`GameCard`**: erhält ein optionales `onClick`-Prop. Wird nur für aufgedeckte Timeline-Karten gesetzt; für die face-down-Karte bleibt es ungesetzt.
- **`Timeline`**: reicht einen `onCardClick(card)`-Callback an die `GameCard`s der Karten durch.
- **`GameScreen`**: hält einen lokalen `detailCard: Card | null`-State; setzt ihn bei `onCardClick` und rendert `CardDetail`, solange er nicht `null` ist.

---

## Feature 3 — Startkarte (Anker) mitzählen, auch fürs Spielziel

### Verhalten
Die initiale Ankerkarte zählt zur angezeigten Kartenanzahl des Spielers **und** zur Gewinnbedingung. Spieler starten somit mit Zähler 1 statt 0.

### Ansatz: nur den Body der einzigen Zählquelle ändern
`scoredCardCount(player)` in `lib/engine/timeline.ts` wird von `Math.max(0, timeline.length - 1)` auf `timeline.length` geändert. **Der Funktionsname bleibt unverändert** (`scoredCardCount`).

Diese Funktion ist die einzige Quelle für die Kartenzählung und wird verwendet in:
- `lib/engine/win.ts` — `isGameOver` (Ziel „X Karten") und `determineWinner` (Tiebreak).
- `components/game/PlayerBar.tsx` — Anzeige.
- `components/game/GameOverScreen.tsx` — Anzeige und Sortierung.

Die Body-Änderung wirkt damit automatisch konsistent auf Anzeige, Gewinnbedingung und Tiebreak.

### Konsequenz fürs Spiel
Im Modus „X Karten" gewinnt ein Spieler nun mit `X-1` selbst platzierten Karten (der Anker zählt als erste). Dies ist die gewünschte Semantik.

### Tests
- `lib/engine/__tests__/timeline.test.ts` — Erwartungswerte für `scoredCardCount` an die neue Zählung (inkl. Anker) anpassen.
- `lib/engine/__tests__/win.test.ts` — Gewinn-/Tiebreak-Erwartungen an die neue Zählung anpassen.

### Bewusst unverändert
- `minTracksNeeded()` in `components/game/game-setup.ts`: überschätzt den Track-Bedarf nun um ~1 Karte pro Spieler, bleibt aber ein sicherer oberer Schätzwert (provisioniert nie zu wenig). Bleibt unverändert.

---

## Tests gesamt

- **Feature 3** hat direkte Engine-Tests (`timeline.test.ts`, `win.test.ts`), die angepasst werden.
- **Feature 1 & 2** sind UI-Komponenten; Abdeckung über bestehende Test-Infrastruktur (`@testing-library/react`) optional, sofern im Projekt für Komponenten üblich.

## Nicht im Scope

- Keine Änderung an der State-Machine.
- Keine Detailansicht für die verdeckte Mystery-Karte.
- Kein Eingriff in Drag-and-Drop oder Slot-Logik.
