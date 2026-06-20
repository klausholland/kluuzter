import { redirect } from "next/navigation";
import { Box, Typography } from "@mui/material";
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
      <Box
        component="main"
        sx={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          p: 6,
          textAlign: "center",
        }}
      >
        <Typography color="error.main">
          Spotify Premium ist für die Wiedergabe erforderlich.
        </Typography>
      </Box>
    );
  }
  return <GameApp />;
}
