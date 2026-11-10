import { playwright } from "@vitest/browser-playwright";
import { defaultExclude, defineConfig } from "vitest/config";

const browserTests = "tests/browser/**/*.test.mjs";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          include: ["tests/**/*.test.mjs"],
          exclude: [browserTests, ...defaultExclude],
          environment: "node",
        },
      },
      {
        test: {
          name: "browser",
          include: [browserTests],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [
              { browser: "chromium" },
              { browser: "firefox" },
              { browser: "webkit" },
            ],
          },
        },
      },
    ],
  },
});
