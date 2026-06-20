import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Spiegelt den tsconfig-Pfadalias `@/*` → `./*`, damit Tests Module
    // über `@/...` importieren können (z. B. `@/db/client`).
    alias: {
      "@": resolve(rootDir, "."),
    },
  },
  ssr: {
    // Zwingt Vite, @mui/material (und seine Transitions-Abhängigkeit
    // react-transition-group) durch die eigene Resolve-/Transform-Pipeline
    // laufen zu lassen, statt sie als externes Modul per nativer Node-ESM-
    // Auflösung zu laden (die an fehlenden "exports"-Feldern scheitert).
    noExternal: ["@mui/material", "@mui/utils", "@mui/system", "react-transition-group"],
  },
  test: {
    // Standard bleibt node; Komponententests setzen `// @vitest-environment jsdom` oben in der Datei.
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    globals: true,
  },
});
