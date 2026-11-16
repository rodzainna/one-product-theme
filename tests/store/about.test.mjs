import { beforeAll, describe, expect, test } from "vitest";
import { get, section, sectionId } from "./store.mjs";

const PATH = "/pages/test-about";
let page, hero, origin, cta;
beforeAll(async () => {
  page = await get(PATH);
  [hero, origin, cta] = await Promise.all(
    ["hero", "origin", "cta"].map(async (key) =>
      section(PATH, await sectionId(PATH, key)),
    ),
  );
});

describe("about page", () => {
  test("holds the page's only h1, which is the page title when the hero heading is empty", () => {
    expect(page.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(hero).toMatch(/<h1 class="hero__heading">Test about<\/h1>/);
  });

  test("starts with the hero", () => {
    const main = page.slice(page.indexOf("<main"));
    expect(main.match(/<div id="shopify-section-[^"]*"/)?.[0]).toContain(
      "__hero",
    );
  });

  test("gives copy sections a real h2 and keeps the eyebrow a plain element", () => {
    expect(origin).toMatch(/<h2\s+class="text text--title"/);
    expect(origin).toMatch(/<div\s+class="text text--eyebrow"/);
    expect(origin).not.toMatch(/<h[1-6]\s+class="text text--eyebrow"/);
  });

  test("puts both buttons in the section's content row, with centred text", () => {
    expect(cta.match(/<div class="custom-section__content">/g)).toHaveLength(1);
    expect(cta.match(/<div class="button-block"/g)).toHaveLength(2);
    expect(cta.match(/class="button[ "]/g)).toHaveLength(2);
    expect(cta).toMatch(/data-align="center"/);
  });
});
