import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";
import collectionLiquid from "../../sections/collection.liquid?raw";
import cardLiquid from "../../snippets/product-card.liquid?raw";
import paginationLiquid from "../../snippets/pagination.liquid?raw";

const styles = (liquid) =>
  liquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

const card = (title) => `<li><article class="product-card">
  <div class="product-card__media"></div>
  <div class="product-card__body"><h3 class="product-card__title"><a class="product-card__link" href="#">${title}</a></h3></div>
</article></li>`;

// The section as the page renders it, inside the content column Shopify's section wrapper gives it.
const render = ({
  title = "Coffee",
  titles = ["One", "Two", "Three", "Four", "Five"],
  pages = false,
} = {}) => {
  document.body.innerHTML = `
    <style>
      :root { --space-xs: 8px; --space-s: 12px; --space-m: 16px; --space-l: 32px; --space-xl: 48px;
        --page-margin: 20px; --page-width: 1200px; --control-h: 44px; --radius-button: 999px; --radius-card: 12px;
        --color-border: #444; --color-background: #fff; --color-foreground: #000; --color-foreground-muted: #666;
        --color-hover: #eee; --color-button: #e07a3f; --color-button-text: #1c130e; --weight-ui: 600;
        --text-body: 16px; --leading-snug: 1.3; --focus-ring: 2px solid #00f; --focus-offset: 2px; }
      body { margin: 0; }
      ${criticalCss}
      ${styles(collectionLiquid)}
      ${styles(cardLiquid)}
      ${styles(paginationLiquid)}
    </style>
    <div class="shopify-section">
      <div class="collection">
        <header class="collection__header"><h1 class="collection__title h2">${title}</h1></header>
        <ul class="card-grid">${titles.map(card).join("")}</ul>
        ${
          pages
            ? `<nav class="pagination" aria-label="Pagination"><ul class="pagination__list">
          <li><a class="pagination__link" href="#" rel="prev">Previous</a></li>
          <li class="pagination__page"><a class="pagination__link" href="#" aria-label="Page 1">1</a></li>
          <li class="pagination__page"><span class="pagination__link pagination__link--current" aria-current="page">2</span></li>
          <li class="pagination__page"><span class="pagination__gap" aria-hidden="true">…</span></li>
          <li class="pagination__page"><a class="pagination__link" href="#" aria-label="Page 9">9</a></li>
          <li><a class="pagination__link" href="#" rel="next">Next</a></li>
        </ul></nav>`
            : ""
        }
      </div>
    </div>`;
};

const box = (selector) =>
  document.querySelector(selector).getBoundingClientRect();
const lefts = () =>
  new Set(
    [...document.querySelectorAll(".card-grid .product-card")].map((item) =>
      Math.round(item.getBoundingClientRect().left),
    ),
  );

afterEach(() => {
  document.documentElement.style.removeProperty("--header-group-h");
  document.body.innerHTML = "";
});

describe("a short page", () => {
  test("fills the screen with its content at the top, not spread out", async () => {
    await page.viewport(1366, 800);
    render({ titles: [] });
    document.body.innerHTML = `<main>${document.body.innerHTML}</main>`;
    document.documentElement.style.setProperty("--header-group-h", "100px");
    const section = document.querySelector(".collection");
    section.classList.add("section-full");
    section.innerHTML = `<header class="collection__header"><h1 class="collection__title h2">Empty</h1></header>
      <div class="collection__empty"><p>Nothing here</p><a href="#" style="display:block;height:44px">Browse</a></div>`;
    expect(box(".collection").height).toBe(800 - 100);
    expect(
      box(".collection__empty").top - box(".collection__header").bottom,
    ).toBe(32);
    expect(box(".collection__empty a").height).toBe(44);
    expect(box(".collection__empty").bottom).toBeLessThan(400);
  });
});

describe("grid", () => {
  test.each([
    [320, 2],
    [390, 2],
    [599, 2],
    [600, 3],
    [899, 3],
    [900, 4],
    [1366, 4],
  ])("is %ipx wide: %i columns", async (width, columns) => {
    await page.viewport(width, 800);
    render();
    expect(lefts().size).toBe(columns);
  });

  test("a single product keeps a card's width, at the left, instead of stretching", async () => {
    await page.viewport(1366, 800);
    render({ titles: ["Only one"] });
    const grid = document.querySelector(".card-grid").getBoundingClientRect();
    const only = document
      .querySelector(".product-card")
      .getBoundingClientRect();
    expect(only.left).toBe(grid.left);
    expect(only.width).toBeLessThan(grid.width / 3);
  });

  test.each([320, 390])(
    "a very long unbroken title or heading stays whole inside its box at %ipx",
    async (width) => {
      await page.viewport(width, 800);
      render({
        title: "Supercalifragilisticexpialidocious".repeat(3),
        titles: ["Supercalifragilisticexpialidocious".repeat(3), "Two"],
      });
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      for (const selector of [".collection__title", ".product-card__title"]) {
        const element = document.querySelector(selector);
        expect(
          element.scrollWidth - element.clientWidth,
          selector,
        ).toBeLessThanOrEqual(1);
      }
    },
  );

  test("the heading comes first, then the grid", async () => {
    await page.viewport(390, 800);
    render();
    expect(
      document.querySelector(".card-grid").getBoundingClientRect().top,
    ).toBeGreaterThanOrEqual(
      document.querySelector(".collection__title").getBoundingClientRect()
        .bottom,
    );
  });
});

describe("page links", () => {
  test("are at least 44px tall, and wrap on a narrow phone without widening the page", async () => {
    await page.viewport(320, 800);
    render({ pages: true });
    for (const link of document.querySelectorAll(".pagination__link")) {
      expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
  });

  test("mark the current page apart from the others", async () => {
    await page.viewport(390, 800);
    render({ pages: true });
    const background = (selector) =>
      getComputedStyle(document.querySelector(selector)).backgroundColor;
    expect(background(".pagination__link--current")).not.toBe(
      background("a.pagination__link[aria-label='Page 1']"),
    );
  });

  test("sit centred under the grid", async () => {
    await page.viewport(1366, 800);
    render({ pages: true });
    const links = [...document.querySelectorAll(".pagination__list li")];
    const first = links[0].getBoundingClientRect();
    const last = links.at(-1).getBoundingClientRect();
    const grid = document.querySelector(".card-grid").getBoundingClientRect();
    expect(first.top).toBeGreaterThanOrEqual(grid.bottom);
    expect(
      Math.abs((first.left + last.right) / 2 - (grid.left + grid.right) / 2),
    ).toBeLessThan(1);
  });
});
