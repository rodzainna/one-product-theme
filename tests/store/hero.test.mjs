import { beforeAll, describe, expect, test } from "vitest";
import { get, section, sectionId } from "./store.mjs";

let page, hero;
beforeAll(async () => {
  page = await get("/");
  hero = await section("/", await sectionId("/", "hero"));
});

describe("hero", () => {
  test("holds the home page's only h1", () => {
    expect(page.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(hero).toMatch(/<h1 class="hero__heading">[^<]+<\/h1>/);
  });

  test("is the first section in the main content", () => {
    const main = page.slice(page.indexOf("<main"));
    expect(main.match(/<div id="shopify-section-[^"]*"/)?.[0]).toContain(
      "__hero",
    );
  });

  test("shows the button and the scroll cue, and no video controls without a video", () => {
    expect(hero).toMatch(/<a [^>]*class="button"[^>]*href="[^"]+"/);
    expect(hero).toContain("data-hero-cue");
    expect(hero).not.toContain("data-hero-toggle");
    expect(hero).not.toContain("<video");
  });
});
