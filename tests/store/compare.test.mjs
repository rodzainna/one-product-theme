import { beforeAll, describe, expect, test } from "vitest";
import { get, section, sectionId } from "./store.mjs";

const PATH = "/pages/test-compare";
let page, versus;
beforeAll(async () => {
  page = await get(PATH);
  versus = await section(PATH, await sectionId(PATH, "versus"));
});

const rows = () =>
  versus.match(
    /<div class="compare__row"[\s\S]*?(?=<div class="compare__row"|<\/compare-table>)/g,
  ) ?? [];

describe("compare page", () => {
  test("has one h1 from the hero and an h2 that names the table", () => {
    expect(page.match(/<h1[\s>]/g)).toHaveLength(1);
    const id = versus.match(/<h2 class="compare__heading" id="([^"]+)"/)[1];
    expect(versus).toMatch(new RegExp(`role="table" aria-labelledby="${id}"`));
    expect(versus).toMatch(new RegExp(`role="region" aria-labelledby="${id}"`));
  });

  test("builds a table from ARIA roles, because Shopify wraps each block in a div", () => {
    expect(versus).not.toMatch(/<(table|tr|td|th)[\s>]/);
    expect(versus.match(/role="rowgroup"/g)).toHaveLength(2);
    expect(versus.match(/role="row"/g)).toHaveLength(6);
    expect(versus.match(/role="rowheader"/g)).toHaveLength(5);
    expect(versus.match(/role="columnheader"/g)).toHaveLength(4);
  });

  test("shows a column for each name the section has, and no more", () => {
    expect(versus).toMatch(/--compare-columns: 3/);
    expect(versus.match(/role="columnheader" data-column="\d"/g)).toHaveLength(
      3,
    );
    for (const row of rows()) {
      expect(row.match(/role="cell"/g)).toHaveLength(3);
    }
  });

  test("marks yes and no with an icon and a word, not colour alone", () => {
    const [first] = rows();
    expect(first).toMatch(/compare__mark--yes[\s\S]*?<\/svg>\s*<\/span>Yes/);
    expect(first).toMatch(/compare__mark--no[\s\S]*?<\/svg>\s*<\/span>No/);
    expect(first).toMatch(
      /<span class="compare__mark[^"]*">\s*<svg[^>]*aria-hidden="true"/,
    );
  });

  test("keeps plain text cells as they are", () => {
    expect(versus).toMatch(/>Usually a blend</);
  });

  test("renders the switch for three or more columns, hidden until the script runs", () => {
    expect(versus).toMatch(/class="compare__switch"[\s\S]*?hidden/);
    expect(versus.match(/data-option="\d"/g)).toHaveLength(2);
    expect(versus).toMatch(/compare-table\.js/);
  });

  test("sits between the hero and the sections after it", () => {
    const order = [
      ...page.matchAll(/<div id="shopify-section-[^"]*__(\w+)"/g),
    ].map((match) => match[1]);
    expect(order.slice(order.indexOf("hero"), -1)).toEqual([
      "hero",
      "versus",
      "why",
      "cta",
    ]);
  });
});
