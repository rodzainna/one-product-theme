import { beforeAll, describe, expect, test } from "vitest";
import { get } from "./store.mjs";

let first;
let second;
let empty;
beforeAll(async () => {
  first = await get("/collections/all");
  second = await get("/collections/all?page=2");
  empty = await get("/collections/test-empty");
});

const cards = (html) => html.match(/<article class="product-card">/g) ?? [];
const pagination = (html) =>
  html.match(/<nav class="pagination"[\s\S]*?<\/nav>/)?.[0];

describe("collection page", () => {
  test("has the collection's title as its one heading", () => {
    expect(first.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(first).toMatch(
      /<h1 class="collection__title h2">\s*Products\s*<\/h1>/,
    );
  });

  test("lists twelve products as cards, each with one link to its product", () => {
    expect(cards(first)).toHaveLength(12);
    const links = first.match(
      /<a class="product-card__link" href="\/products\/[^"]+">/g,
    );
    expect(links).toHaveLength(12);
  });

  test("titles each card with an h2, so the headings go h1 then h2", () => {
    expect(first.match(/<h2 class="product-card__title">/g)).toHaveLength(12);
    expect(first).not.toMatch(/<h3 class="product-card__title">/);
  });

  test("a product whose first media is a video shows the video's preview image", async () => {
    const html = await get("/collections/all?sort_by=title-descending");
    const card = html
      .split('<article class="product-card">')
      .find((part) => part.includes('href="/products/test-video-first"'));
    expect(card).toMatch(/<img[^>]*src="[^"]*preview_images\//);
  });

  test("loads the first four cards' images at once and the rest lazily", async () => {
    // Title order puts products with photos first, so the first four have images to check.
    const html = await get("/collections/all?sort_by=title-descending");
    const loading = html
      .split('<article class="product-card">')
      .slice(1)
      .map((card) => card.match(/<img[^>]*loading="(\w+)"/)?.[1]);
    const firstFour = loading.slice(0, 4).filter(Boolean);
    const rest = loading.slice(4).filter(Boolean);
    expect(firstFour.length, "photos among the first four").toBeGreaterThan(0);
    expect(firstFour.every((value) => value === "eager")).toBe(true);
    expect(rest.length, "photos after the first four").toBeGreaterThan(0);
    expect(rest.every((value) => value === "lazy")).toBe(true);
  });
});

describe("pagination", () => {
  test("names the nav, marks the current page and offers Next on the first page", () => {
    const nav = pagination(first);
    expect(nav).toMatch(/aria-label="Pagination"/);
    expect(nav).toMatch(/<span[^>]*aria-current="page">1<\/span>/);
    expect(nav).toMatch(
      /<a[^>]*href="\/collections\/all\?page=2"[^>]*rel="next">Next<\/a>/,
    );
    expect(nav).not.toMatch(/rel="prev"/);
  });

  test("the second page holds the rest, with Previous and no Next", () => {
    expect(cards(second).length).toBeGreaterThan(0);
    expect(cards(second).length).toBeLessThan(12);
    const nav = pagination(second);
    expect(nav).toMatch(/rel="prev">Previous<\/a>/);
    expect(nav).toMatch(/<span[^>]*aria-current="page">2<\/span>/);
    expect(nav).not.toMatch(/rel="next"/);
  });

  test("names each page link by its number", () => {
    expect(pagination(first)).toMatch(/aria-label="Page 2">2<\/a>/);
  });

  test("shows no page links when everything fits on one page", async () => {
    const html = await get(
      "/collections/all?filter.v.price.gte=19&filter.v.price.lte=21",
    );
    expect(cards(html).length).toBeGreaterThan(0);
    expect(cards(html).length).toBeLessThan(12);
    expect(pagination(html)).toBeUndefined();
  });

  test("has no empty list items", () => {
    expect(pagination(first)).not.toMatch(/<li>\s*<\/li>/);
  });
});

describe("an empty collection", () => {
  test("shows the collection's description, then says it's empty and offers all products, with no grid or page links", () => {
    expect(empty).toMatch(
      /<h1 class="collection__title h2">\s*Test empty\s*<\/h1>/,
    );
    expect(empty).toMatch(/Test collection with no products\./);
    expect(empty).toMatch(/There are no products in this collection yet\./);
    expect(empty).toMatch(
      /<a[^>]*href="\/collections\/all"[^>]*>\s*Browse all products\s*<\/a>/,
    );
    expect(empty).not.toMatch(/class="collection__grid"/);
    expect(pagination(empty)).toBeUndefined();
  });
});
