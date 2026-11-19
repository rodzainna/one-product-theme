import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";
import collectionsLiquid from "../../sections/collections.liquid?raw";
import cardLiquid from "../../snippets/collection-card.liquid?raw";

const styles = (liquid) =>
  liquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

const card = (title) => `<li><article class="collection-card">
  <div class="collection-card__media"><svg class="collection-card__placeholder" viewBox="0 0 200 100"></svg></div>
  <div class="collection-card__body"><h2 class="collection-card__title"><a class="collection-card__link" href="#">${title}</a></h2>
  <p class="collection-card__count">3 products</p></div>
</article></li>`;

// The section as the page renders it, inside the content column Shopify's section wrapper gives it.
const render = (titles = ["One", "Two", "Three", "Four", "Five"]) => {
  document.body.innerHTML = `
    <style>
      :root { --space-2xs: 4px; --space-xs: 8px; --space-s: 12px; --space-m: 16px; --space-l: 32px; --space-xl: 48px;
        --page-margin: 20px; --page-width: 1200px; --radius-card: 12px; --color-border: #444; --color-background: #fff;
        --color-foreground-muted: #666; --color-hover: #eee; --text-body: 16px; --text-small: 14px; --leading-snug: 1.3;
        --focus-ring: 2px solid #00f; --focus-offset: 2px; }
      body { margin: 0; }
      ${criticalCss}
      ${styles(collectionsLiquid)}
      ${styles(cardLiquid)}
    </style>
    <div class="shopify-section"><div class="collections">
      <h1 class="collections__title h2">Collections</h1>
      <ul class="card-grid">${titles.map(card).join("")}</ul>
    </div></div>`;
};

const box = (selector) =>
  document.querySelector(selector).getBoundingClientRect();
const lefts = () =>
  new Set(
    [...document.querySelectorAll(".card-grid .collection-card")].map((item) =>
      Math.round(item.getBoundingClientRect().left),
    ),
  );

afterEach(() => {
  document.body.innerHTML = "";
});

describe("collection cards", () => {
  test.each([
    [320, 2],
    [599, 2],
    [600, 3],
    [899, 3],
    [900, 4],
    [1366, 4],
  ])("at %ipx the grid has %i columns", async (width, columns) => {
    await page.viewport(width, 800);
    render();
    expect(lefts().size).toBe(columns);
  });

  test("a single collection keeps a card's width, at the left", async () => {
    await page.viewport(1366, 800);
    render(["Only one"]);
    expect(box(".collection-card").left).toBe(box(".card-grid").left);
    expect(box(".collection-card").width).toBeLessThan(
      box(".card-grid").width / 3,
    );
  });

  test.each([320, 390])(
    "a very long unbroken name stays whole inside its box at %ipx",
    async (width) => {
      await page.viewport(width, 800);
      render(["Supercalifragilisticexpialidocious".repeat(3), "Two"]);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      const title = document.querySelector(".collection-card__title");
      expect(title.scrollWidth - title.clientWidth).toBeLessThanOrEqual(1);
    },
  );

  test("the picture is a square, and its placeholder fills it", async () => {
    await page.viewport(1366, 800);
    render();
    const media = box(".collection-card__media");
    expect(media.width).toBeCloseTo(media.height, 0);
    expect(box(".collection-card__placeholder").height).toBeCloseTo(
      media.height,
      0,
    );
  });

  test("the one link covers the whole card, picture included", async () => {
    await page.viewport(1366, 800);
    render();
    const { left, top } = box(".collection-card");
    const hit = document.elementFromPoint(left + 8, top + 8);
    expect(hit.closest("a.collection-card__link")).not.toBeNull();
  });
});
