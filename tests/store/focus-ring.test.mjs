import { expect, test } from "vitest";
import { get } from "./store.mjs";

test("every colour scheme defines the field focus ring, and the page its offset", async () => {
  const html = await get("/");
  expect(html).toMatch(/--focus-offset-field:\s*0px/);
  const rings = html.match(
    /--focus-ring-field:\s*2px solid var\(--color-accent\)/g,
  );
  const schemes = html.match(/\.color-scheme-\d+\s*\{/g);
  expect(rings).toHaveLength(schemes.length);
});
