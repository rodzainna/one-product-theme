import { beforeAll, describe, expect, test } from "vitest";
import { get, section } from "./store.mjs";

let page, featured;
beforeAll(async () => {
  page = await get("/");
  const id = page.match(
    /id="shopify-section-(template--\d+__featured_product)"/,
  )[1];
  featured = await section("/", id);
});

describe("default home page", () => {
  test("has the placeholder sections in order, and the hero's single h1", () => {
    const order = [
      ...page.matchAll(/<div id="shopify-section-template--\d+__(\w+)"/g),
    ].map((match) => match[1]);
    expect(order).toEqual([
      "hero",
      "featured_product",
      "features",
      "link_tiles",
      "testimonials",
      "faq",
    ]);
    expect(page.match(/<h1[\s>]/g)).toHaveLength(1);
  });

  test("sends the hero button to the product collection, not a particular product", () => {
    expect(page).toMatch(/<a[^>]*href="\/collections\/all"[^>]*>\s*Shop now/);
  });

  test("shows no buy box until a product is picked", () => {
    expect(featured).toMatch(/data-empty/);
    expect(featured).not.toMatch(/product-gallery/);
  });
});
