import { beforeAll, describe, expect, test } from "vitest";
import { get } from "./store.mjs";

let page, nav, groups;
beforeAll(async () => {
  page = await get("/pages/test-faq");
  nav = [...page.matchAll(/<a href="#(faq-[^"]+)">([^<]+)<\/a>/g)].map((m) => ({
    id: m[1],
    title: m[2],
  }));
  groups = [
    ...page.matchAll(
      /<section\s+class="faq-group"\s+id="(faq-[^"]+)"[\s\S]*?<h2 class="faq-group__title"[^>]*>([^<]+)<\/h2>/g,
    ),
  ].map((m) => ({ id: m[1], title: m[2] }));
});

describe("FAQ page", () => {
  test("holds the page's only h1, which is the page title", () => {
    expect(page.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(page).toMatch(/<h1 class="faq-page__heading">Test FAQ<\/h1>/);
  });

  test("builds a category link for every category, in order, pointing at its heading", () => {
    expect(groups).toHaveLength(3);
    expect(nav).toEqual(groups);
  });

  test("shows every question as an h3 inside its summary, with no one-at-a-time group and none open", () => {
    expect(
      page.match(
        /<summary class="accordion__trigger">\s*<h3 class="accordion__heading">[^<]+<\/h3>/g,
      ),
    ).toHaveLength(8);
    expect(page).not.toMatch(/<details[^>]*\sname=/);
    expect(page).not.toMatch(/<details[^>]*\sopen[\s>]/);
  });

  test("ends with the closing block and its contact button", () => {
    expect(page).toMatch(
      /<h2 class="faq-page__end-heading">Still have a question\?<\/h2>/,
    );
    expect(page).toMatch(/<a class="button" href="\/pages\/contact"/);
  });
});
