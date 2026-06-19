import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { fetchProfile, isPremium } from "@/lib/spotify/profile";
import { GameApp } from "@/components/game/GameApp";

export default async function PlayPage() {
  const session = await auth();
  if (!session?.accessToken) {
    redirect("/");
  }
  const profile = await fetchProfile(session.accessToken);
  if (!isPremium(profile)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-red-400">
          Spotify Premium ist für die Wiedergabe erforderlich.
        </p>
      </main>
    );
  }
  return <GameApp />;
}
