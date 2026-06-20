import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
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
    <Container component="main" sx={{ minHeight: "100vh" }}>
      <Stack
        spacing={3}
        sx={{
          minHeight: "100vh",
          py: 6,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
          Kluuzter
        </Typography>
        {connected ? (
          <>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <Typography variant="body2">
                Angemeldet als {profile?.display_name ?? "?"}
              </Typography>
              {premium ? (
                <Chip label="Premium aktiv" color="success" size="small" />
              ) : (
                <Chip
                  label="Kein Premium: Wiedergabe nicht möglich"
                  color="error"
                  size="small"
                />
              )}
            </Stack>
            {premium && (
              <Button
                href="/play"
                variant="contained"
                color="success"
                size="large"
              >
                Spiel starten
              </Button>
            )}
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <Button type="submit" variant="outlined" color="inherit">
                Spotify trennen
              </Button>
            </form>
          </>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("spotify");
            }}
          >
            <Button type="submit" variant="contained" color="success">
              Mit Spotify anmelden
            </Button>
          </form>
        )}
      </Stack>
    </Container>
  );
}
