import { beforeAll, describe, expect, test } from "vitest";
import { get, section, sectionId } from "./store.mjs";

let page, testimonials;
beforeAll(async () => {
  page = await get("/");
  testimonials = await section("/", await sectionId("/", "testimonials"));
});

const cards = () =>
  testimonials.match(
    /<div\s+class="card testimonial"[\s\S]*?<\/blockquote>/g,
  ) ?? [];

describe("home testimonials", () => {
  test("has an h2 and a list of cards, each a div with the listitem role", () => {
    expect(testimonials).toMatch(
      /<h2 class="testimonials__heading">[^<]+<\/h2>/,
    );
    expect(testimonials).toMatch(
      /<div class="testimonials__list" role="list">/,
    );
    expect(cards()).toHaveLength(3);
    for (const card of cards()) expect(card).toMatch(/role="listitem"/);
  });

  test("fills the stars to the rating and names it for screen readers", () => {
    expect(testimonials).toMatch(/--rating-percent: 100\.0%/);
    expect(testimonials).toMatch(/--rating-percent: 90\.0%/);
    expect(testimonials).toMatch(/Rated 5 out of 5/);
    expect(testimonials).toMatch(/Rated 4\.5 out of 5/);
  });

  test("shows no stars when the rating is 0", () => {
    const [, , third] = cards();
    expect(third).not.toMatch(/rating-stars/);
    expect(third).not.toMatch(/Rated /);
  });

  test("shows the quote as a blockquote with the name and byline", () => {
    const [first] = cards();
    expect(first).toMatch(
      /<blockquote class="testimonial__quote">[\s\S]+?<\/blockquote>/,
    );
    expect(testimonials).toMatch(
      /<span class="testimonial__name">First customer<\/span>/,
    );
    expect(testimonials).toMatch(
      /<span class="testimonial__byline">Sydney<\/span>/,
    );
  });

  test("links to the reviews page and comes before the FAQ", () => {
    expect(testimonials).toMatch(
      /<a class="testimonials__link" href="\/pages\/reviews">/,
    );
    const order = [
      ...page.matchAll(/<div id="shopify-section-[^"]*__(\w+)"/g),
    ].map((m) => m[1]);
    expect(order.indexOf("testimonials")).toBeGreaterThan(
      order.indexOf("link_tiles"),
    );
    expect(order.indexOf("testimonials")).toBeLessThan(order.indexOf("faq"));
  });
});
