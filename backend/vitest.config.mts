import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The cube is 6MB; the first test to touch it pays the parse.
    testTimeout: 30_000,
  },
});
