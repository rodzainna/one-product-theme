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
          exclude: [browserTests, "tests/store/**", ...defaultExclude],
          environment: "node",
        },
      },
      {
        resolve: {
          alias: {
            "@shopify/standard-events": new URL(
              "./tests/browser/stubs/shopify-events.mjs",
              import.meta.url,
            ).pathname,
            dialog: new URL("./assets/dialog.js", import.meta.url).pathname,
          },
        },
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
