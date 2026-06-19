# Hitster Webapp — Plan 1: Fundament (Scaffold, App-Sperre, Spotify-Login)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein lauffähiges Next.js-16-Projekt mit Single-User-App-Sperre und Spotify-Login (Auth.js v5) inklusive Token-Refresh und Premium-Check.

**Architecture:** Next.js App Router. Zwei Auth-Schichten: (1) eine App-Sperre über Next.js-Middleware, die alle Routen außer `/login` und `/api/auth/*` blockiert und ein signiertes HttpOnly-Cookie (jose/HMAC) prüft; (2) Spotify-OAuth über Auth.js v5 mit automatischem Access-Token-Refresh. Reine Logik (Cookie-Signatur, Token-Refresh, Premium-Check) liegt in testbaren Modulen unter `lib/`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Auth.js v5 (next-auth@beta), jose, Vitest.

## Global Constraints

- Next.js: `next@16.2.9`
- React: `react@19` / `react-dom@19`
- Auth.js: `next-auth@5.0.0-beta.31`
- Tailwind CSS: `tailwindcss@4.3.1` + `@tailwindcss/postcss@4.3.1`
- jose: `jose@6.2.3`
- Vitest: `vitest@4.1.9`
- TypeScript strict mode aktiviert.
- Alle Secrets ausschließlich über Umgebungsvariablen: `APP_PASSWORD`, `APP_SECRET`, `AUTH_SECRET`, `AUTH_SPOTIFY_ID`, `AUTH_SPOTIFY_SECRET`. Niemals committen (`.env*` ist in `.gitignore`).
- App ist Single-User; keine Registrierung, keine User-DB.

---

## File Structure

- `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts` — Projekt-Setup
- `app/globals.css` — Tailwind-Einstieg
- `app/layout.tsx`, `app/page.tsx` — Root-Layout + Startseite (Status)
- `app/login/page.tsx`, `app/login/actions.ts` — App-Sperre UI + Server Action
- `lib/app-auth/session.ts` — Cookie-Signatur (jose), Passwort-Vergleich
- `middleware.ts` — App-Gate
- `auth.ts` — Auth.js-v5-Konfiguration (Spotify-Provider, jwt/session-Callbacks)
- `app/api/auth/[...nextauth]/route.ts` — Auth.js-Route-Handler
- `lib/spotify/refresh.ts` — reine Token-Refresh-Funktion
- `lib/spotify/profile.ts` — Profil-Fetch + `isPremium`
- `types/next-auth.d.ts` — Session/JWT-Typ-Erweiterungen
- Tests unter `**/__tests__/` bzw. `*.test.ts`

---

## Task 1: Projekt-Scaffold (Next.js 16 + Tailwind v4 + Vitest)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`
- Create: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`
- Create: `lib/__tests__/smoke.test.ts`
- Create: `.env.example`

**Interfaces:**
- Consumes: nichts (erste Task)
- Produces: lauffähiges Next-Projekt; `npm test` führt Vitest aus.

- [ ] **Step 1: package.json anlegen**

```json
{
  "name": "hitster-webapp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "16.2.9",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next-auth": "5.0.0-beta.31",
    "jose": "6.2.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.3.1",
    "tailwindcss": "4.3.1",
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "vitest": "4.1.9"
  }
}
```

- [ ] **Step 2: Konfigurationsdateien anlegen**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

`postcss.config.mjs`:
```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
```

`.env.example`:
```
APP_PASSWORD=change-me
APP_SECRET=generate-a-long-random-string
AUTH_SECRET=generate-with-npx-auth-secret
AUTH_SPOTIFY_ID=your-spotify-client-id
AUTH_SPOTIFY_SECRET=your-spotify-client-secret
```

- [ ] **Step 3: Tailwind + App-Shell anlegen**

`app/globals.css`:
```css
@import "tailwindcss";
```

`app/layout.tsx`:
```tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hitster",
  description: "Musik-Ratespiel im Hitster-Stil",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-neutral-900 text-neutral-100">
        {children}
      </body>
    </html>
  );
}
```

`app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <h1 className="text-2xl font-bold">Hitster</h1>
    </main>
  );
}
```

- [ ] **Step 4: Smoke-Test schreiben**

`lib/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs the test suite", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Installieren und Test ausführen**

Run: `npm install && npm test`
Expected: Vitest läuft, 1 Test grün (`smoke > runs the test suite`).

- [ ] **Step 6: Build-Sanity-Check**

Run: `npm run build`
Expected: Build erfolgreich (keine Typ-/Compile-Fehler).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 + Tailwind v4 + Vitest"
```

---

## Task 2: App-Sperre — Session-Modul (jose)

**Files:**
- Create: `lib/app-auth/session.ts`
- Test: `lib/app-auth/__tests__/session.test.ts`

**Interfaces:**
- Consumes: `APP_SECRET`, `APP_PASSWORD` (env)
- Produces:
  - `createSessionToken(): Promise<string>`
  - `verifySessionToken(token: string | undefined): Promise<boolean>`
  - `isCorrectPassword(input: string): boolean`
  - `APP_SESSION_COOKIE = "app_session"` (exported const)

- [ ] **Step 1: Failing tests schreiben**

`lib/app-auth/__tests__/session.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  isCorrectPassword,
} from "../session";

beforeEach(() => {
  vi.stubEnv("APP_SECRET", "test-secret-value-at-least-32-chars-long!!");
  vi.stubEnv("APP_PASSWORD", "hunter2");
});

describe("session token", () => {
  it("verifies a token it created", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("rejects undefined", async () => {
    expect(await verifySessionToken(undefined)).toBe(false);
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token + "x")).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken();
    vi.stubEnv("APP_SECRET", "a-completely-different-secret-value-here!!");
    expect(await verifySessionToken(token)).toBe(false);
  });
});

describe("isCorrectPassword", () => {
  it("accepts the configured password", () => {
    expect(isCorrectPassword("hunter2")).toBe(true);
  });
  it("rejects a wrong password", () => {
    expect(isCorrectPassword("nope")).toBe(false);
  });
  it("rejects empty input", () => {
    expect(isCorrectPassword("")).toBe(false);
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/app-auth/__tests__/session.test.ts`
Expected: FAIL — `Cannot find module '../session'`.

- [ ] **Step 3: Session-Modul implementieren**

`lib/app-auth/session.ts`:
```ts
import { SignJWT, jwtVerify } from "jose";

export const APP_SESSION_COOKIE = "app_session";

function secretKey(): Uint8Array {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ ok: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secretKey());
    return true;
  } catch {
    return false;
  }
}

export function isCorrectPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected || !input) return false;
  // Längen-unabhängiger, einfacher Vergleich (Single-User, lokal unkritisch)
  if (input.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < input.length; i++) {
    mismatch |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/app-auth/__tests__/session.test.ts`
Expected: PASS — alle 7 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add lib/app-auth/session.ts lib/app-auth/__tests__/session.test.ts
git commit -m "feat: add app-gate session module (jose)"
```

---

## Task 3: App-Sperre — Login-Seite, Server Action, Middleware

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/login/actions.ts`
- Create: `middleware.ts`

**Interfaces:**
- Consumes: `createSessionToken`, `isCorrectPassword`, `APP_SESSION_COOKIE`, `verifySessionToken` aus Task 2
- Produces: geschützte App; `/login` öffentlich erreichbar.

- [ ] **Step 1: Server Action implementieren**

`app/login/actions.ts`:
```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  APP_SESSION_COOKIE,
  createSessionToken,
  isCorrectPassword,
} from "@/lib/app-auth/session";

export async function login(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  if (!isCorrectPassword(password)) {
    return { error: "Falsches Passwort." };
  }
  const token = await createSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(APP_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}
```

- [ ] **Step 2: Login-Seite implementieren**

`app/login/page.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, {});
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-4 rounded-xl bg-neutral-800 p-6"
      >
        <h1 className="text-xl font-bold">Anmelden</h1>
        <input
          type="password"
          name="password"
          autoFocus
          placeholder="Passwort"
          className="w-full rounded-lg bg-neutral-700 px-3 py-2 outline-none"
        />
        {state?.error && (
          <p className="text-sm text-red-400">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-green-600 px-3 py-2 font-semibold disabled:opacity-50"
        >
          {pending ? "..." : "Weiter"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Middleware implementieren**

`middleware.ts`:
```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  APP_SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/app-auth/session";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(APP_SESSION_COOKIE)?.value;
  const ok = await verifySessionToken(token);
  if (!ok) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Alles schützen außer: /login, Auth.js-Routen, Next-Interna, statische Assets
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

- [ ] **Step 4: Manuell verifizieren**

Run: `npm run dev` (mit gesetzten `APP_PASSWORD`, `APP_SECRET`, `AUTH_SECRET` in `.env.local`)
- `http://localhost:3000/` aufrufen → Redirect nach `/login`.
- Falsches Passwort → Fehlermeldung „Falsches Passwort.".
- Richtiges Passwort → Redirect zur Startseite, Cookie gesetzt.
Expected: Verhalten wie beschrieben.

- [ ] **Step 5: Commit**

```bash
git add app/login middleware.ts
git commit -m "feat: add app-gate login page and middleware"
```

---

## Task 4: Spotify-Token-Refresh (reine Funktion)

**Files:**
- Create: `lib/spotify/refresh.ts`
- Test: `lib/spotify/__tests__/refresh.test.ts`

**Interfaces:**
- Consumes: `AUTH_SPOTIFY_ID`, `AUTH_SPOTIFY_SECRET` (env)
- Produces:
  - Typ `RefreshableToken = { refresh_token?: string; access_token?: string; expires_at?: number; error?: string }`
  - `refreshAccessToken(token: RefreshableToken, fetchImpl?: typeof fetch): Promise<RefreshableToken>`

- [ ] **Step 1: Failing tests schreiben**

`lib/spotify/__tests__/refresh.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { refreshAccessToken } from "../refresh";

beforeEach(() => {
  vi.stubEnv("AUTH_SPOTIFY_ID", "client-id");
  vi.stubEnv("AUTH_SPOTIFY_SECRET", "client-secret");
});

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("refreshAccessToken", () => {
  it("returns a new access token and expiry on success", async () => {
    const before = Math.floor(Date.now() / 1000);
    const result = await refreshAccessToken(
      { refresh_token: "r1" },
      fakeFetch(200, {
        access_token: "new-access",
        expires_in: 3600,
      }),
    );
    expect(result.access_token).toBe("new-access");
    expect(result.expires_at).toBeGreaterThanOrEqual(before + 3600);
    expect(result.error).toBeUndefined();
  });

  it("keeps the old refresh token when none is returned", async () => {
    const result = await refreshAccessToken(
      { refresh_token: "r1" },
      fakeFetch(200, { access_token: "a", expires_in: 3600 }),
    );
    expect(result.refresh_token).toBe("r1");
  });

  it("uses a rotated refresh token when returned", async () => {
    const result = await refreshAccessToken(
      { refresh_token: "r1" },
      fakeFetch(200, {
        access_token: "a",
        expires_in: 3600,
        refresh_token: "r2",
      }),
    );
    expect(result.refresh_token).toBe("r2");
  });

  it("sets error on HTTP failure", async () => {
    const result = await refreshAccessToken(
      { refresh_token: "r1" },
      fakeFetch(400, { error: "invalid_grant" }),
    );
    expect(result.error).toBe("RefreshAccessTokenError");
  });

  it("sets error when there is no refresh token", async () => {
    const result = await refreshAccessToken({}, fakeFetch(200, {}));
    expect(result.error).toBe("RefreshAccessTokenError");
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/spotify/__tests__/refresh.test.ts`
Expected: FAIL — `Cannot find module '../refresh'`.

- [ ] **Step 3: Refresh-Funktion implementieren**

`lib/spotify/refresh.ts`:
```ts
export type RefreshableToken = {
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  error?: string;
};

export async function refreshAccessToken(
  token: RefreshableToken,
  fetchImpl: typeof fetch = fetch,
): Promise<RefreshableToken> {
  if (!token.refresh_token) {
    return { ...token, error: "RefreshAccessTokenError" };
  }
  try {
    const basic = Buffer.from(
      `${process.env.AUTH_SPOTIFY_ID}:${process.env.AUTH_SPOTIFY_SECRET}`,
    ).toString("base64");

    const response = await fetchImpl(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basic}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: token.refresh_token,
        }),
      },
    );

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
    };

    if (!response.ok || !data.access_token) {
      return { ...token, error: "RefreshAccessTokenError" };
    }

    return {
      access_token: data.access_token,
      expires_at: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
      refresh_token: data.refresh_token ?? token.refresh_token,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/spotify/__tests__/refresh.test.ts`
Expected: PASS — alle 5 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add lib/spotify/refresh.ts lib/spotify/__tests__/refresh.test.ts
git commit -m "feat: add spotify token refresh function"
```

---

## Task 5: Auth.js v5 Spotify-Konfiguration + Route + Sign-in/out

**Files:**
- Create: `auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `types/next-auth.d.ts`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `refreshAccessToken`, `RefreshableToken` aus Task 4; `AUTH_SECRET`, `AUTH_SPOTIFY_ID`, `AUTH_SPOTIFY_SECRET` (env)
- Produces:
  - Exporte aus `auth.ts`: `{ handlers, auth, signIn, signOut }`
  - `session.accessToken: string | undefined`, `session.error: string | undefined`

- [ ] **Step 1: Typ-Erweiterungen anlegen**

`types/next-auth.d.ts`:
```ts
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    error?: string;
  }
}
```

- [ ] **Step 2: Auth.js-Konfiguration implementieren**

`auth.ts`:
```ts
import NextAuth from "next-auth";
import Spotify from "next-auth/providers/spotify";
import { refreshAccessToken } from "@/lib/spotify/refresh";

const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Spotify({
      authorization: {
        url: "https://accounts.spotify.com/authorize",
        params: { scope: SCOPES },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at = account.expires_at;
        token.error = undefined;
        return token;
      }
      if (token.expires_at && Date.now() < token.expires_at * 1000) {
        return token;
      }
      const refreshed = await refreshAccessToken(token);
      return { ...token, ...refreshed };
    },
    async session({ session, token }) {
      session.accessToken = token.access_token;
      session.error = token.error;
      return session;
    },
  },
});
```

- [ ] **Step 3: Route-Handler anlegen**

`app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 4: Startseite mit Sign-in/out erweitern**

`app/page.tsx`:
```tsx
import { auth, signIn, signOut } from "@/auth";

export default async function Home() {
  const session = await auth();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Hitster</h1>
      {session ? (
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button className="rounded-lg bg-neutral-700 px-4 py-2">
            Spotify trennen
          </button>
        </form>
      ) : (
        <form
          action={async () => {
            "use server";
            await signIn("spotify");
          }}
        >
          <button className="rounded-lg bg-green-600 px-4 py-2 font-semibold">
            Mit Spotify anmelden
          </button>
        </form>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Manuell verifizieren**

Voraussetzung: Spotify-App im Dashboard angelegt, Redirect-URI `http://localhost:3000/api/auth/callback/spotify` eingetragen; `.env.local` gefüllt.
Run: `npm run dev`
- App-Login passieren, dann „Mit Spotify anmelden" → Spotify-OAuth → zurück zur Startseite, Button zeigt jetzt „Spotify trennen".
Expected: OAuth-Round-Trip funktioniert.

- [ ] **Step 6: Build-Check**

Run: `npm run build`
Expected: erfolgreich.

- [ ] **Step 7: Commit**

```bash
git add auth.ts "app/api/auth/[...nextauth]/route.ts" types/next-auth.d.ts app/page.tsx
git commit -m "feat: add Auth.js v5 Spotify login with token refresh"
```

---

## Task 6: Premium-Check (Profil-Fetch + isPremium) + Statusanzeige

**Files:**
- Create: `lib/spotify/profile.ts`
- Test: `lib/spotify/__tests__/profile.test.ts`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `session.accessToken` aus Task 5
- Produces:
  - Typ `SpotifyProfile = { id: string; display_name: string | null; product: string }`
  - `fetchProfile(accessToken: string, fetchImpl?: typeof fetch): Promise<SpotifyProfile | null>`
  - `isPremium(profile: SpotifyProfile | null): boolean`

- [ ] **Step 1: Failing tests schreiben**

`lib/spotify/__tests__/profile.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { fetchProfile, isPremium } from "../profile";

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("fetchProfile", () => {
  it("returns the parsed profile on success", async () => {
    const profile = await fetchProfile(
      "tok",
      fakeFetch(200, {
        id: "u1",
        display_name: "Anna",
        product: "premium",
      }),
    );
    expect(profile).toEqual({
      id: "u1",
      display_name: "Anna",
      product: "premium",
    });
  });

  it("returns null on HTTP error", async () => {
    const profile = await fetchProfile("tok", fakeFetch(401, {}));
    expect(profile).toBeNull();
  });
});

describe("isPremium", () => {
  it("is true for product 'premium'", () => {
    expect(
      isPremium({ id: "u", display_name: null, product: "premium" }),
    ).toBe(true);
  });
  it("is false for product 'free'", () => {
    expect(isPremium({ id: "u", display_name: null, product: "free" })).toBe(
      false,
    );
  });
  it("is false for null", () => {
    expect(isPremium(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run lib/spotify/__tests__/profile.test.ts`
Expected: FAIL — `Cannot find module '../profile'`.

- [ ] **Step 3: Profil-Modul implementieren**

`lib/spotify/profile.ts`:
```ts
export type SpotifyProfile = {
  id: string;
  display_name: string | null;
  product: string;
};

export async function fetchProfile(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SpotifyProfile | null> {
  try {
    const res = await fetchImpl("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      id: string;
      display_name: string | null;
      product: string;
    };
    return {
      id: data.id,
      display_name: data.display_name,
      product: data.product,
    };
  } catch {
    return null;
  }
}

export function isPremium(profile: SpotifyProfile | null): boolean {
  return profile?.product === "premium";
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npx vitest run lib/spotify/__tests__/profile.test.ts`
Expected: PASS — alle 5 Tests grün.

- [ ] **Step 5: Statusanzeige in die Startseite einbauen**

In `app/page.tsx` nach `const session = await auth();` ergänzen und die `session ? (...)`-Anzeige um den Premium-Status erweitern:
```tsx
import { fetchProfile, isPremium } from "@/lib/spotify/profile";
// ...
  const session = await auth();
  const profile = session?.accessToken
    ? await fetchProfile(session.accessToken)
    : null;
  const premium = isPremium(profile);
```
Und im angemeldeten Zweig oberhalb des „Spotify trennen"-Buttons einfügen:
```tsx
<p className="text-sm">
  Angemeldet als {profile?.display_name ?? "?"} —{" "}
  {premium ? (
    <span className="text-green-400">Premium aktiv</span>
  ) : (
    <span className="text-red-400">
      Kein Premium: Wiedergabe nicht möglich
    </span>
  )}
</p>
```

- [ ] **Step 6: Voller Test-Lauf + Build**

Run: `npm test && npm run build`
Expected: Alle Tests grün, Build erfolgreich.

- [ ] **Step 7: Manuell verifizieren**

Run: `npm run dev` → nach Spotify-Login zeigt die Startseite Anzeigename und Premium-Status.
Expected: Premium-Konto → „Premium aktiv"; Free-Konto → roter Hinweis.

- [ ] **Step 8: Commit**

```bash
git add lib/spotify/profile.ts lib/spotify/__tests__/profile.test.ts app/page.tsx
git commit -m "feat: add Spotify profile fetch and premium check"
```

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung (Abschnitt 4 der Spec):** App-Sperre (Tasks 2–3), Spotify-OAuth + Token-Refresh (Tasks 4–5), Premium-Check mit Blockier-Hinweis (Task 6). ✓
- **Platzhalter:** keine offenen TODO/TBD; jeder Code-Step enthält vollständigen Code. ✓
- **Typ-Konsistenz:** `RefreshableToken` (Task 4) wird in `auth.ts` (Task 5) verwendet; `SpotifyProfile`/`isPremium` (Task 6) konsistent; `APP_SESSION_COOKIE`/`verifySessionToken` zwischen Task 2 und 3 identisch benannt. ✓
- **Scope:** Bewusst nur Fundament; Playlist-Auswahl/Playback (Plan 4), Engine (Plan 3), Datenschicht (Plan 2), UI (Plan 5) sind separate Pläne.
```
