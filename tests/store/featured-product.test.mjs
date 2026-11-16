import { beforeAll, describe, expect, test } from "vitest";
import { get, product, section, sectionId, variantId } from "./store.mjs";

// The home page picks no product. This one is picked by templates/index.featured-test.json,
// served at /?view=featured-test; pnpm test:store:setup copies it from tests/store/fixtures.
const home_path = "/?view=featured-test";
const handle = "test-two-options";
const picker = (html) => html.match(/<variant-picker[^>]*>/)?.[0] ?? "";
const cartVariant = (html) =>
  html.match(/<input\s+type="hidden"\s+name="id"\s+value="(\d+)"/)?.[1];
const currentMedia = (html) =>
  html.match(
    /class="gallery__item"[^>]*data-current[^>]*>[\s\S]*?alt="([^"]*)"/,
  )?.[1];

let id, json, home;
beforeAll(async () => {
  const page = await get(home_path);
  if (!page.includes("product-title__heading")) {
    throw new Error(
      `${home_path} shows no featured product. Run pnpm test:store:setup so templates/index.featured-test.json exists, and wait for the preview to sync it.`,
    );
  }
  id = await sectionId(home_path, "featured_product");
  json = await product(handle);
  home = await section(home_path, id);
});

describe("featured product", () => {
  test("renders the picked product's buy box with an h2, under the hero's h1", () => {
    expect(home).toMatch(
      /<h2 class="product-title__heading">Test two options<\/h2>/,
    );
    expect(home).not.toMatch(/<h1/);
    expect(home).toMatch(/<product-gallery/);
    expect(currentMedia(home)).toBe("Red test image");
  });

  test("below the first section, its media doesn't take the page's high priority", async () => {
    // section.index is only set in a full page render, not the Section Rendering API.
    const page = await get(home_path);
    expect(page.indexOf(`id="shopify-section-${id}"`)).toBeGreaterThan(0);
    expect(page).not.toMatch(/<img[^>]*fetchpriority="high"/);
  });

  test("the picker asks the product's URL for this section, and leaves the page URL alone", () => {
    expect(picker(home)).toMatch(`data-url="/products/${handle}"`);
    expect(picker(home)).toMatch(`data-section-id="${id}"`);
    expect(picker(home)).not.toMatch(/data-update-url/);
  });

  test("that request renders this section for the picked variant", async () => {
    const ids = (html, values) =>
      values.map(
        (value) =>
          html.match(
            new RegExp(`value="${value}"[^>]*data-option-value-id="(\\d+)"`),
          )[1],
      );
    const html = await section(
      `/products/${handle}?option_values=${ids(home, ["S", "Blue"]).join(",")}`,
      id,
    );
    expect(cartVariant(html)).toBe(String(variantId(json, "S / Blue")));
    expect(currentMedia(html)).toBe("Blue test image");
    expect(html).toMatch(/<h2 class="product-title__heading">/);
    expect(picker(html)).not.toMatch(/data-update-url/);
  });

  test("the product page keeps its h1 and preloads its media", async () => {
    const html = await get(`/products/${handle}`);
    expect(html).toMatch(/<h1 class="product-title__heading">/);
    expect(html).toMatch(/<img[^>]*fetchpriority="high"/);
  });
});
