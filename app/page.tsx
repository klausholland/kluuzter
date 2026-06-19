import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { fetchProfile, isPremium } from "@/lib/spotify/profile";

export default async function Home() {
  const session = await auth();
  const connected = !!session && session.error !== "RefreshAccessTokenError";
  const profile =
    connected && session?.accessToken
      ? await fetchProfile(session.accessToken)
      : null;
  const premium = connected ? isPremium(profile) : false;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Hitster</h1>
      {connected ? (
        <>
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
          {premium && (
            <Link
              href="/play"
              className="rounded-xl bg-green-600 px-6 py-3 text-lg font-semibold"
            >
              Spiel starten
            </Link>
          )}
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
        </>
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
