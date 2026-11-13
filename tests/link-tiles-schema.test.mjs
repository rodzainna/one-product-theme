import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const liquid = readFileSync("sections/link-tiles.liquid", "utf8");
const schema = JSON.parse(
  liquid.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/)[1],
);
const gradient = schema.settings.find((setting) => setting.id === "gradient");

describe("link tiles gradient setting", () => {
  test("can't be weakened below a level that keeps the light text readable", () => {
    expect(gradient.min).toBeGreaterThanOrEqual(60);
  });

  test("defaults to a value inside its range, on a step", () => {
    expect(gradient.default).toBeGreaterThanOrEqual(gradient.min);
    expect(gradient.default).toBeLessThanOrEqual(gradient.max);
    expect((gradient.default - gradient.min) % gradient.step).toBe(0);
  });
});
