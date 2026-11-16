import { beforeAll, describe, expect, test } from "vitest";
import { get, section, sectionId } from "./store.mjs";

const PATH = "/pages/test-reviews";
let page, wall;
beforeAll(async () => {
  page = await get(PATH);
  wall = await section(PATH, await sectionId(PATH, "wall"));
});

const articles = () =>
  wall.match(/<article\s+class="review [^"]*"[\s\S]*?<\/article>/g) ?? [];

describe("reviews page", () => {
  test("has one h1 from the hero and an h2 for the wall, with cards as h3 articles", () => {
    expect(page.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(wall).toMatch(/<h2 class="review-wall__heading">[^<]+<\/h2>/);
    expect(articles()).toHaveLength(6);
    for (const card of articles()) {
      expect(card).toMatch(/<h3 class="review__title">[^<]+<\/h3>/);
    }
  });

  test("sizes and styles each card from its settings", () => {
    const classes = articles().map(
      (card) => card.match(/class="(review [^"]*)"/)[1],
    );
    expect(classes[0]).toMatch(/review--quote/);
    expect(classes[0]).toMatch(/review--wide/);
    expect(classes[0]).toMatch(/color-scheme-2/);
    expect(classes[1]).toMatch(/review--story/);
    expect(classes[1]).not.toMatch(/review--wide/);
  });

  test("picks light text on a dark tint and dark text on a light one", () => {
    expect(articles()[1]).not.toMatch(/review--dark-text/);
    expect(articles()[1]).toMatch(/--review-tint: #a8410f/);
    expect(articles()[2]).toMatch(/review--dark-text/);
  });

  test("adds a button and a dialog only to cards that have a full review", () => {
    const withButton = articles().map((card) => /review__more/.test(card));
    expect(withButton).toEqual([true, true, false, false, false, false]);
    expect(wall.match(/<dialog\b/g)).toHaveLength(2);
    const openers = [...wall.matchAll(/data-dialog-open="([^"]+)"/g)].map(
      (match) => match[1],
    );
    for (const id of openers) expect(wall).toContain(`id="${id}"`);
  });

  test("fills the stars to the rating and names it for screen readers", () => {
    expect(articles()[2]).toMatch(/--rating-percent: 80\.0%/);
    expect(articles()[2]).toMatch(/Rated 4 out of 5/);
  });

  test("repeats the rating in the dialog", () => {
    const dialog = wall.match(/<dialog\b[\s\S]*?<\/dialog>/)[0];
    expect(dialog).toMatch(/Rated 5 out of 5/);
  });

  test("loads the script that spreads the cards", () => {
    expect(wall).toMatch(/<review-wall class="review-wall__grid">/);
    expect(wall).toMatch(/review-wall\.js/);
  });

  test("puts the wall between the hero and the closing section", () => {
    const order = [
      ...page.matchAll(/<div id="shopify-section-[^"]*__(\w+)"/g),
    ].map((match) => match[1]);
    expect(order.slice(order.indexOf("hero"), -1)).toEqual([
      "hero",
      "wall",
      "cta",
    ]);
  });
});
