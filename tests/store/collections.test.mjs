import { beforeAll, describe, expect, test } from "vitest";
import { get } from "./store.mjs";

let first;
let second;
let pastEnd;
beforeAll(async () => {
  first = await get("/collections");
  second = await get("/collections?page=2");
  pastEnd = await get("/collections?page=9");
});

const cards = (html) =>
  html.split('<article class="collection-card">').slice(1);
const pagination = (html) =>
  html.match(/<nav class="pagination"[\s\S]*?<\/nav>/)?.[0];

describe("collection list page", () => {
  test("has the page title as its one heading", () => {
    expect(first.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(first).toMatch(
      /<h1 class="collections__title h2">\s*Collections\s*<\/h1>/,
    );
  });

  test("lists twelve collections per page as cards, each with one link to its collection", () => {
    expect(cards(first)).toHaveLength(12);
    for (const html of cards(first)) {
      expect(html.match(/<a class="collection-card__link"/g)).toHaveLength(1);
      expect(html).toMatch(
        /<h2 class="collection-card__title">\s*<a class="collection-card__link" href="\/collections\/[^"]+">/,
      );
    }
  });

  test("shows the product count under each name, singular or plural", () => {
    const counts = cards(first).map(
      (html) => html.match(/<p class="collection-card__count">([^<]+)<\/p>/)[1],
    );
    for (const count of counts) expect(count).toMatch(/^\d+ products?$/);
    expect(counts).toContain("0 products");
  });

  test("shows the collection's image, or a placeholder when it has none", () => {
    const html = cards(first);
    expect(
      html.some((card) =>
        /<div class="collection-card__media">\s*<div\s+class="image/.test(card),
      ),
    ).toBe(true);
    expect(
      html.some((card) =>
        card.includes('class="collection-card__placeholder"'),
      ),
    ).toBe(true);
  });

  test("loads the first card's image at once", () => {
    const withImage = cards(first).find((card) => card.includes("<img"));
    expect(withImage).toMatch(/<img[^>]*loading="eager"/);
  });

  test("uses the card grid, so it has the same columns as the product grid", () => {
    expect(first).toMatch(/<ul class="card-grid">/);
  });
});

describe("pagination", () => {
  test("offers Next on the first page, and Previous on the second", () => {
    expect(pagination(first)).toMatch(/rel="next">\s*Next/);
    expect(pagination(first)).not.toMatch(/rel="prev"/);
    expect(cards(second).length).toBeGreaterThan(0);
    expect(cards(second).length).toBeLessThan(12);
    expect(pagination(second)).toMatch(/rel="prev">\s*Previous/);
  });
});

describe("a page past the last", () => {
  test("says so and links to the first page", () => {
    expect(pastEnd).toMatch(/There are no collections on this page\./);
    expect(pastEnd).toMatch(
      /href="\/collections"[^>]*>\s*Go to the first page\s*<\/a>/,
    );
    expect(pastEnd).not.toMatch(/class="card-grid"/);
  });
});
