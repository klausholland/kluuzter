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
