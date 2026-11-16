import { beforeAll, describe, expect, test } from "vitest";
import { get, section, sectionId } from "./store.mjs";

let page, faq;
beforeAll(async () => {
  page = await get("/");
  faq = await section("/", await sectionId("/", "faq"));
});

describe("home FAQ", () => {
  test("has an h2, and every question is an h3 inside its summary", () => {
    expect(faq).toMatch(/<h2 class="faq__heading">[^<]+<\/h2>/);
    expect(
      faq.match(
        /<summary class="accordion__trigger">\s*<h3 class="accordion__heading">[^<]+<\/h3>/g,
      ),
    ).toHaveLength(3);
  });

  test("groups the items by section so one opens at a time, with only the first open", () => {
    const names = [...faq.matchAll(/<details[^>]*\sname="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(names).toHaveLength(3);
    expect(new Set(names).size).toBe(1);
    expect(names[0]).toMatch(/^template--\d+__faq$/);
    const open = [...faq.matchAll(/<details[^>]*>/g)].map((match) =>
      /\sopen[\s>]/.test(match[0]),
    );
    expect(open).toEqual([true, false, false]);
  });

  test("links to the FAQ page", () => {
    expect(faq).toMatch(/<a class="faq__link" href="\/pages\/faq">[^<]+<\/a>/);
  });

  test("comes after the link tiles on the home page", () => {
    const order = [
      ...page.matchAll(/<div id="shopify-section-[^"]*__(\w+)"/g),
    ].map((match) => match[1]);
    expect(order.indexOf("faq")).toBeGreaterThan(order.indexOf("link_tiles"));
  });
});
