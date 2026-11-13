import { beforeAll, describe, expect, test } from "vitest";
import { get, section, sectionId } from "./store.mjs";

let page, tiles;
beforeAll(async () => {
  page = await get("/");
  tiles = await section("/", await sectionId("/", "link_tiles"));
});

describe("link tiles", () => {
  test("is named by a hidden h2, with an h3 title inside each tile's link", () => {
    expect(tiles).toMatch(/<h2 class="visually-hidden">Explore<\/h2>/);
    expect(tiles.match(/<a\s+class="tile"\s+href="[^"]+"/g)).toHaveLength(3);
    expect(tiles.match(/<h3 class="tile__title">/g)).toHaveLength(3);
  });

  test("keeps the arrow out of the accessible name", () => {
    expect(
      tiles.match(/<span class="tile__arrow" aria-hidden="true">/g),
    ).toHaveLength(3);
  });

  test("makes the first tile span the other rows: two for three tiles", () => {
    expect(tiles).toContain('data-count="3"');
    expect(tiles).toContain("--tiles-rows: 2");
    expect(tiles).toContain("--tiles-gradient: 85%");
  });

  test("comes after the features on the home page", () => {
    const order = [
      ...page.matchAll(/<div id="shopify-section-[^"]*__(\w+)"/g),
    ].map((m) => m[1]);
    expect(order.indexOf("link_tiles")).toBeGreaterThan(
      order.indexOf("features"),
    );
  });

  test("shows no missing translations", () => {
    expect(page).not.toMatch(/translation missing/i);
  });
});
