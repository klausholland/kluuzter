# Design: Full Material UI Redesign (dark, party)

Datum: 2026-06-20
Branch: feat/mui-redesign (ab `main`)

## Ziel

Die UI/UX des Musik-Ratespiels nach aktuellen Web-Standards modernisieren, indem **alle** Komponenten auf **Material UI (MUI)** umgestellt werden. Tailwind v4 wird entfernt. Gleiche Screens und Flows ("polierter Refresh"), dunkles, verspieltes ("party") Theme mit lebendigen Neon-/Gradient-Akzenten.

Entscheidungen (vom Nutzer bestätigt):
- **Komplett auf MUI** — Tailwind entfernen, Styling über Theme + `sx`/MUI-Komponenten.
- **Polierter Refresh** — Layouts/Flows bleiben, nur Styling/Politur.
- **Alles inkl. Spielbrett** — auch Karten/Zeitleiste auf MUI-Bausteine.
- **Dark, verspielt (Party)** — dunkles Theme, Neon-Akzente, Gradients.

Logik, Props-Verträge der Spiel-Engine und die XState-Maschine bleiben **unverändert**.

## Globale Rahmenbedingungen

- Aktuelle MUI-Version mit React-19-Support (MUI v6/v7); Emotion als Engine.
- Next.js 16 App Router: Emotion-SSR über `AppRouterCacheProvider` (`@mui/material-nextjs`).
- Tests laufen unter **Node 22** (`source ~/.nvm/nvm.sh && nvm use 22`); Default-Node 20 bricht vitest/rolldown ab.
- Bestehende Test-Suite muss **grün bleiben** (aktuell 163 Tests). Accessible Names, Roles, Texte, `disabled`-Zustände und DnD-Verhalten werden erhalten; nur wo MUI den Interaktions-Vertrag ändert (Dialog Escape/Backdrop), werden Tests angepasst.
- Komponenten-Tests starten mit `// @vitest-environment jsdom` und nutzen `@testing-library/react`.
- UI-Texte bleiben Deutsch.
- Gearbeitet wird auf `feat/mui-redesign`, nicht auf `main`.

## 1. Infrastruktur & Theme

**Dependencies hinzufügen:** `@mui/material`, `@mui/material-nextjs`, `@emotion/react`, `@emotion/styled`, `@mui/icons-material`.

**Tailwind entfernen:**
- `app/globals.css`: `@import "tailwindcss";` entfernen; minimale globale Regeln (z. B. `height: 100%`) behalten/ergänzen.
- `postcss.config.mjs`: `@tailwindcss/postcss`-Plugin entfernen (Datei ggf. löschen, wenn leer).
- `package.json`: `tailwindcss` und `@tailwindcss/postcss` aus devDependencies entfernen.

**`app/layout.tsx`:**
- Provider-Kette: `AppRouterCacheProvider` → `ThemeProvider theme={theme}` → `CssBaseline` → `{children}`.
- Schrift via `next/font` (Inter); an MUI-Typography binden.
- `<body>`-Tailwind-Klassen entfernen; Hintergrund/Textfarbe kommen aus Theme + `CssBaseline`.

**Theme-Datei** `lib/theme.ts` (`createTheme`, `palette.mode = "dark"`):
- `primary` ≈ Neon-Grün (Start/Confirm-Aktionen), `secondary` ≈ Fuchsia/Indigo (Akzente/Karten), passende `background.default`/`paper` (dunkel).
- `shape.borderRadius` erhöht (abgerundet), dezente `transitions`.
- Wiederverwendbare Gradient-Tokens (z. B. Karten-Front `fuchsia→indigo`, Mystery-Karte `neutral`) als exportierte Konstanten oder Theme-Erweiterung.

## 2. Komponenten-Migrations-Map

Jede Migration ersetzt nur Markup/Styling, nicht die Logik/Props.

| Datei | Heute (Tailwind) | MUI-Ziel |
|---|---|---|
| `app/page.tsx` (Home, Server Comp.) | `<main>`, styled buttons/Link | `Container`, `Typography`, `Button` (Server-Actions/`Link` bleiben) |
| `app/login/page.tsx` | Passwort-Form | `Container`/`Paper`, `TextField`, `Button`, `Alert` |
| `components/setup/SetupScreen.tsx` | Form mit Buttons/Inputs | `Container`, `Stack`, `TextField`, `ToggleButtonGroup` (Modus), `Button`, `Alert` |
| `components/setup/PlaylistPicker.tsx` (+`IndexControls`) | Such-Input, Liste, Status | `TextField` (search), `List`/`ListItemButton`, `Chip`/`Checkbox`, `LinearProgress`, `Alert`, `Button` |
| `components/game/DeckLoading.tsx` | Spinner-Text | `CircularProgress`, `Typography`, `Button` |
| `components/game/GameScreen.tsx` | Top-Bar, Layout, Alerts | `AppBar`/`Toolbar` (Titel + Abbrechen-`Button`), `Box`/`Stack`, `Alert` |
| `components/game/PlayerBar.tsx` | Player-Chips | `Stack` aus `Chip`/`Avatar`, aktiver Spieler hervorgehoben |
| `components/game/PlaybackControls.tsx` | Play/Pause + Balken | `IconButton` (Play/Pause-Icons), `Slider`/`LinearProgress` |
| `components/game/Card.tsx` | Gradient-Div | `Card`/`Paper` + `CardActionArea` (klickbar), `Typography`; Mystery-Variante separat |
| `components/game/Timeline.tsx` | Flex-Reihe | `Stack`/`Box` horizontal scrollbar |
| `components/game/Slot.tsx` | Button-Slot | MUI `Button`/`Box` als Drop-Ziel |
| `components/game/CounterOverlay.tsx` | Overlay | `Dialog` |
| `components/game/RevealOverlay.tsx` | Overlay | `Dialog` |
| `components/game/GameOverScreen.tsx` | Vollbild-Liste | `Container`/`Dialog` + `List`, `Button` |
| `components/game/ConfirmDialog.tsx` | Custom Modal | `Dialog` + `DialogTitle`/`Content`/`Actions` |
| `components/game/CardDetail.tsx` | Custom Modal | `Dialog` mit Cover/`Typography` |

## 3. Spielbrett (Karten / Zeitleiste / Slots)

- **Card**: MUI `Card`/`Paper` mit fester Proportion (aspect 3/4, gleiche Breiten wie heute), Gradient-Front (Akzentfarben), kräftige Jahreszahl, getrimmte Artist/Title. Klickbare Aufdeck-Karte über `CardActionArea` **oder** Box mit `role="button"` — in jedem Fall **`aria-label="Details: ${artist} – ${title}"` beibehalten**. Mystery-/Face-Down-Karte: eigene Darstellung, Text bleibt verborgen, "?"/„Mystery-Song" bleibt, **kein onClick**.
- **Timeline**: horizontale, scrollbare Reihe (Slot, Karte, Slot, …). Reihenfolge/Anzahl unverändert.
- **Slot**: MUI-Button/Box mit **`aria-label="Slot N"`**, `disabled`-Zustand erhalten, selektierter Slot hervorgehoben. **HTML5-Drag&Drop-Handler (`onDragOver`/`onDrop`) und Tap-Auswahl bleiben** unverändert.
- Dezente Hover-/Auswahl-/Flip-Transitions über Theme; **kein** DnD-Library (YAGNI).

## 4. Test-Strategie

- Erhalt aller accessible Hooks, von denen Tests abhängen:
  - `Card.test`: `getByText(artist/title/year)`, Mystery versteckt Text + zeigt „?", `getByLabelText("Details: …")`, „ungenau"-Hinweis.
  - `Timeline.test`: `getAllByLabelText(/^Slot /)`, `getByLabelText("Slot 1")`, `disabled`, Drag/Drop, `onCardClick` via `Details: a – a`.
  - `ConfirmDialog.test` / `CardDetail.test`: `getByText`/`getByRole("dialog")`, Schließen-Button, Backdrop, Escape — MUI `Dialog` liefert `role="dialog"` und ruft `onClose(reason)`; Tests ggf. auf MUI-Semantik anpassen (Escape/Backdrop → `onClose`).
  - `PlaylistPicker.test`, `RevealOverlay.test`, `game-setup.test`: vor Migration lesen, accessible Queries erhalten oder gezielt anpassen.
- Pro Komponente: erst Migration, dann betroffene Tests unter Node 22 laufen lassen, anpassen bis grün, dann volle Suite.
- Snapshot-Tests werden nicht eingeführt.

## 5. Reihenfolge / Tasks (Outline für den Plan)

1. **Infra & Theme + Smoke-Check**: Deps, Provider in `layout.tsx`, `lib/theme.ts`, Tailwind-Entfernung; eine triviale MUI-Komponente rendert SSR/CSR sauber (validiert MUI+Next16+React19). Build + Suite grün.
2. **Low-Level-Komponenten**: `Card`, `Slot`, `Timeline`, `PlaybackControls`, `PlayerBar` (mit Test-Erhalt).
3. **Overlays/Dialoge**: `ConfirmDialog`, `CardDetail`, `RevealOverlay`, `CounterOverlay`, `GameOverScreen`.
4. **Screens**: `SetupScreen`, `PlaylistPicker`/`IndexControls`, `DeckLoading`, `GameScreen`.
5. **Einstieg**: `app/page.tsx` (Home), `app/login/page.tsx`.
6. **Abschluss**: visuelle Konsistenz, `tsc` sauber, volle Suite grün, `npm run build` erfolgreich (kein Tailwind mehr referenziert).

## Risiken

- **MUI + Next 16 + React 19**: Adapter-Version prüfen; Task 1 validiert das früh. Fällt das aus, Pin auf kompatible MUI-Version oder manuelles Emotion-Registry-Setup.
- **Server vs. Client**: `app/page.tsx` ist Server Component mit Server-Actions; MUI-Komponenten sind Client-fähig und als Kinder rendierbar — Forms/Actions bleiben funktionsfähig.
- **Test-Drift**: DOM ändert sich durch MUI; Migration hält accessible Namen stabil, um Bruch zu minimieren.

## Nicht im Scope

- Keine Änderung an Spiellogik, Selektoren, Engine oder XState-Maschine.
- Kein Wechsel der DnD-Technik.
- Keine neuen Screens/Flows; keine Light/System-Theme-Umschaltung (dunkel fix).
- Die Spotify-Player-Lifecycle-Fixes (nur auf `feat/reindex`) sind nicht Teil dieses Specs.
