import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "store",
    include: ["tests/store/**/*.test.mjs"],
    environment: "node",
    // One local preview serves every request, and it slows down under parallel load.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
