"use client";

import { createTheme } from "@mui/material/styles";

/** Wiederverwendbare Gradient-Tokens für Karten & Akzente. */
export const gradients = {
  cardFront: "linear-gradient(135deg, #d946ef 0%, #6366f1 100%)",
  mystery: "linear-gradient(135deg, #404040 0%, #171717 100%)",
  primary: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
};

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#22c55e" },
    secondary: { main: "#d946ef" },
    background: { default: "#0a0a0a", paper: "#171717" },
    success: { main: "#22c55e" },
    error: { main: "#ef4444" },
    warning: { main: "#f59e0b" },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: "var(--font-inter), system-ui, sans-serif",
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { variant: "contained" } },
  },
});

export default theme;
