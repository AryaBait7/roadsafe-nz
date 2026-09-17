import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Resolves the "@/..." alias from tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    // Pure logic and services run in Node; component tests opt into jsdom
    // with a `@vitest-environment jsdom` docblock.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
