import { beforeAll, describe, expect, test } from "vitest";
import { get, product } from "./store.mjs";

const path = "/products/test-two-options";
const element = (html, key) =>
  html.match(
    new RegExp(
      `<product-recommendations[^>]*id="Recommendations-template--\\d+__${key}"[^>]*>`,
    ),
  )?.[0] ?? "";
const url = (tag) =>
  tag.match(/data-url="([^"]+)"/)?.[1].replaceAll("&amp;", "&");

let html, json;
beforeAll(async () => {
  [html, json] = await Promise.all([get(path), product("test-two-options")]);
});

describe("product recommendations", () => {
  test("the page renders both sections empty, for the script to fill", () => {
    for (const key of ["complementary", "related"]) {
      const tag = element(html, key);
      expect(tag, `no ${key} section`).not.toBe("");
      expect(tag).toMatch(/data-empty/);
    }
  });

  test("each asks the Product Recommendations API for its intent and this product", () => {
    for (const [key, intent] of [
      ["complementary", "complementary"],
      ["related", "related"],
    ]) {
      const request = new URL(url(element(html, key)), "http://store");
      expect(request.pathname).toBe("/recommendations/products");
      expect(request.searchParams.get("product_id")).toBe(String(json.id));
      expect(request.searchParams.get("intent")).toBe(intent);
      expect(request.searchParams.get("limit")).toBe("4");
      expect(request.searchParams.get("section_id")).toMatch(
        new RegExp(`^template--\\d+__${key}$`),
      );
    }
  });
});

describe("recommended products", () => {
  const fetchSection = async (key) => {
    const tag = element(html, key);
    return get(url(tag));
  };
  const cards = (section) =>
    [
      ...section.matchAll(
        /<article class="product-card linked-card">([\s\S]*?)<\/article>/g,
      ),
    ].map(([, body]) => body);
  const titles = (section) =>
    [
      ...section.matchAll(/class="linked-card__link" href="([^"]+)">([^<]+)</g),
    ].map(([, href, title]) => ({
      href: href.replaceAll("&amp;", "&"),
      title,
    }));

  test("complementary: the Search & Discovery picks, as cards under 'Pairs well with'", async () => {
    const section = await fetchSection("complementary");
    expect(section).not.toMatch(/data-empty/);
    expect(section).toMatch(
      /<h2 class="recommendations__heading h3">Pairs well with<\/h2>/,
    );
    expect(titles(section).map((t) => t.title)).toEqual([
      "Test sale",
      "Test several prices",
      "Test unit price",
    ]);
  });

  test("related: 'You may also like', with Shopify's tracking parameters on each link", async () => {
    const section = await fetchSection("related");
    expect(section).toMatch(/You may also like/);
    const links = titles(section);
    // The picks come first; Shopify then fills up to the limit with products of its own choosing.
    expect(links.map((t) => t.title).slice(0, 2)).toEqual([
      "Test regular",
      "Test size sold out",
    ]);
    expect(links.length).toBeLessThanOrEqual(4);
    for (const { href } of links) {
      expect(new URL(href, "http://store").searchParams.has("pr_rec_id")).toBe(
        true,
      );
    }
  });

  test("cards: sale price with badge, a From range without sale badge or unit price", async () => {
    const [sale, range, unit] = cards(await fetchSection("complementary"));
    expect(sale).toMatch(/<s class="price__compare">\$20\.00<\/s>/);
    expect(sale).toMatch(/badge--sale/);
    expect(range).toMatch(/From \$10\.00/);
    expect(range).not.toMatch(/badge--sale|price__compare/);
    expect(unit).toMatch(/class="price__note"/);
    // One link per card: the image isn't a second link.
    expect(sale.match(/<a\s/g)).toHaveLength(1);
  });
});
