"use client";

import { useActionState } from "react";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, {});
  return (
    <Container
      component="main"
      maxWidth="sm"
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Paper
        component="form"
        action={formAction}
        elevation={3}
        sx={{ width: "100%", p: 4 }}
      >
        <Stack spacing={2}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            Anmelden
          </Typography>
          <TextField
            type="password"
            name="password"
            label="Passwort"
            autoFocus
            fullWidth
          />
          {state?.error && <Alert severity="error">{state.error}</Alert>}
          <Button
            type="submit"
            disabled={pending}
            variant="contained"
            color="success"
            fullWidth
          >
            {pending ? "..." : "Weiter"}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
