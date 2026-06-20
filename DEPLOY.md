# Deployment auf Vercel

Diese Checkliste bringt die Hitster-Webapp auf Vercel. Reihenfolge einhalten —
Datenbank zuerst, dann Env-Variablen, dann Spotify, dann Deploy.

## Voraussetzungen

- Vercel-Account + dieses Repo auf GitHub (oder via `vercel` CLI).
- Eine **Neon**-Postgres-Datenbank (kostenloser Tier reicht): https://neon.tech
- Eine **Spotify**-App im Developer Dashboard: https://developer.spotify.com/dashboard
- Zum Spielen: **Spotify Premium** (Pflicht für das Web Playback SDK).

---

## 1. Neon-Datenbank anlegen

1. In Neon ein Projekt erstellen.
2. Den **Connection String** kopieren (Form: `postgres://<user>:<pass>@<host>/<db>?sslmode=require`).
   Das wird gleich `DATABASE_URL`.

> Der DB-Client wählt den Treiber automatisch anhand des Hosts: echte Neon-Hosts
> → `neon-http` (serverless, für Vercel), lokale Hosts → `node-postgres`. Es ist
> also nichts am Code zu ändern.

## 2. Schema in die Neon-DB einspielen (`year_cache`-Tabelle)

Die App braucht die Tabelle `year_cache`. Zwei Wege:

**Variante A — direkt per SQL (zuverlässig):**
Im Neon-SQL-Editor (Dashboard → „SQL Editor") den Inhalt von
`db/migrations/0000_mute_warpath.sql` ausführen:

```sql
CREATE TABLE "year_cache" (
	"spotify_track_id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"resolved_year" integer NOT NULL,
	"source" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

**Variante B — per drizzle-kit (lokal gegen Neon):**

```bash
nvm use 24
DATABASE_URL="<neon-connection-string>" npx drizzle-kit migrate
```

Prüfen: Im Neon-SQL-Editor `SELECT count(*) FROM year_cache;` → muss `0` liefern.

## 3. Spotify-App konfigurieren

Im Spotify Developer Dashboard → deine App → **Settings**:

- **Redirect URI** hinzufügen (genau diese, mit deiner echten Vercel-Domain):
  ```
  https://<dein-projekt>.vercel.app/api/auth/callback/spotify
  ```
- **Client ID** und **Client Secret** notieren (→ `AUTH_SPOTIFY_ID` / `AUTH_SPOTIFY_SECRET`).
- Die App darf im **Development Mode** bleiben (Single-User). Bei Bedarf den
  eigenen Spotify-Account unter „User Management" eintragen.

> Hinweis: Die Domain steht erst nach dem ersten Deploy fest. Du kannst die
> Redirect-URI also auch nach Schritt 5 nachtragen — dann aber vor dem ersten
> Login eintragen.

## 4. Environment-Variablen in Vercel setzen

Vercel → Projekt → **Settings → Environment Variables** (Scope: Production,
gern auch Preview). Alle folgenden setzen:

| Variable | Wert / Hinweis |
|----------|----------------|
| `DATABASE_URL` | Neon-Connection-String aus Schritt 1 |
| `APP_PASSWORD` | dein Wunsch-Passwort für die App-Sperre |
| `APP_SECRET` | langer Zufallswert (z. B. `openssl rand -base64 32`) |
| `AUTH_SECRET` | langer Zufallswert (oder `npx auth secret`) |
| `AUTH_SPOTIFY_ID` | Spotify Client ID |
| `AUTH_SPOTIFY_SECRET` | Spotify Client Secret |
| `MUSICBRAINZ_CONTACT` | echte E-Mail oder URL (Pflicht laut MusicBrainz) |
| `AUTH_URL` | `https://<dein-projekt>.vercel.app` (volle URL, ohne Slash am Ende) |

> Niemals echte Secrets ins Repo committen — `.env` ist in `.gitignore`.
> `AUTH_URL` muss exakt zur aufgerufenen Domain passen, sonst schlägt der
> OAuth-Redirect fehl.

## 5. Deployen

- **Per GitHub:** Repo in Vercel importieren → Vercel erkennt Next.js automatisch
  (Build `next build`, kein Sonder-Setup nötig). Deploy starten.
- **Per CLI:**
  ```bash
  npm i -g vercel
  vercel        # Preview
  vercel --prod # Production
  ```

Nach dem ersten Deploy steht die finale Domain fest. Falls noch nicht geschehen:
`AUTH_URL` (Schritt 4) und die Spotify-Redirect-URI (Schritt 3) auf genau diese
Domain setzen und **neu deployen**.

## 6. Erststart prüfen

1. `https://<dein-projekt>.vercel.app` öffnen → App-Login (Passwort = `APP_PASSWORD`).
2. „Mit Spotify anmelden" → OAuth-Round-Trip → zurück zur Startseite.
3. Premium-Status muss „aktiv" zeigen, sonst ist keine Wiedergabe möglich.
4. „Spiel starten" → Playlist wählen → **„Indizieren"** (Fortschritt läuft in
   20er-Batches) → „indiziert ✓".
5. „Deck vorbereiten & starten" → Deck baut **sofort** (aus dem Cache).

## Betriebshinweise

- **Indizieren ist einmalig pro Track:** Ergebnisse liegen global im `year_cache`.
  Bereits indizierte Songs (auch in anderen Playlists) sind sofort verfügbar.
- **Function-Timeout:** Alle Routen sind mit `maxDuration = 60` ausgelegt; ein
  Index-Batch (max. 20 Tracks ≈ 22 s) bleibt sicher darunter. Große Playlists
  werden durch viele Batches abgedeckt — der Browser orchestriert das.
- **MusicBrainz-Rate-Limit:** ~1 Anfrage/Sekunde. Das erste Indizieren großer
  Playlists dauert entsprechend (z. B. 300 neue Songs ≈ 5–6 Min, einmalig).
- **Kosten:** Vercel Hobby + Neon Free reichen für Single-User-Betrieb.
