import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Spiegelt den tsconfig-Pfadalias `@/*` → `./*`, damit Tests Module
    // über `@/...` importieren können (z. B. `@/db/client`).
    alias: {
      "@": resolve(rootDir, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
