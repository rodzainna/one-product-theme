import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// Each of these cards gets its box, whole-card link and focus ring from the shared linked-card rules.
const cards = [
  ["snippets/product-card.liquid", "product-card"],
  ["snippets/collection-card.liquid", "collection-card"],
  ["snippets/article-card.liquid", "article-card"],
  ["snippets/search-result-card.liquid", "result-card"],
];

const stylesheet = (source) =>
  source.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

describe.each(cards)("%s", (file, name) => {
  const source = readFileSync(file, "utf8");

  test("is an article with the shared card class and one shared link", () => {
    expect(source).toContain(`<article class="${name} linked-card">`);
    expect(source.match(/class="linked-card__link"/g)).toHaveLength(1);
  });

  test("leaves the box and the link behaviour to the shared rules", () => {
    const css = stylesheet(source);
    expect(css).not.toMatch(/border(-radius)?:/);
    expect(css).not.toContain("::after");
    expect(css).not.toContain(":focus-visible");
    expect(css).not.toContain("text-decoration");
  });
});
