import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { pages, products } from "./store/products.mjs";

// Only the files git tracks ship, so the local test-only home template isn't checked.
const templates = execFileSync("git", ["ls-files", "templates"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((file) => file.endsWith(".json"));
const read = (file) => readFileSync(file, "utf8");
const parse = (file) => JSON.parse(read(file).replace(/^\/\*[\s\S]*?\*\//, ""));
const testHandles = [...products, ...pages].map((item) => item.handle);

describe("default templates", () => {
  test("don't point at store resources, which a fresh install doesn't have", () => {
    for (const file of templates) {
      expect(read(file), file).not.toMatch(/shopify:\/\//);
    }
  });

  test("don't name the test store's products or pages", () => {
    for (const file of templates) {
      for (const handle of testHandles) {
        expect(read(file), file).not.toContain(`"${handle}"`);
        expect(read(file), file).not.toContain(`/${handle}"`);
      }
    }
  });

  test("the home page picks no featured product", () => {
    const home = parse("templates/index.json");
    expect(home.sections.featured_product.settings.product).toBeUndefined();
  });

  test("every section in an order exists, and none is an empty custom section", () => {
    for (const file of templates) {
      const { sections, order } = parse(file);
      for (const key of order ?? []) {
        expect(sections[key], `${file}: ${key}`).toBeDefined();
      }
      for (const [key, section] of Object.entries(sections ?? {})) {
        const empty =
          section.type === "custom-section" &&
          !Object.keys(section.blocks ?? {}).length;
        expect(empty, `${file}: ${key}`).toBe(false);
      }
    }
  });
});
