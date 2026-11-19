import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";
import searchLiquid from "../../sections/search.liquid?raw";
import fieldLiquid from "../../snippets/search-field.liquid?raw";
import searchFormLiquid from "../../snippets/search-form.liquid?raw";
import cardLiquid from "../../snippets/search-result-card.liquid?raw";

const styles = (liquid) =>
  liquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

const card = ({ title, excerpt, image }) => `<li><article class="result-card">
  ${image ? '<div class="result-card__media"><div style="aspect-ratio: 1; background: #ccc"></div></div>' : ""}
  <div class="result-card__body"><span class="badge">Page</span>
  <h2 class="result-card__title"><a class="result-card__link" href="#">${title}</a></h2>
  <p class="result-card__excerpt">${excerpt}</p></div>
</article></li>`;

// The form, type links and grid as the section renders them, in the content column.
const render = (cards, blank = false) => {
  document.body.innerHTML = `
    <style>
      :root { --space-2xs: 4px; --space-xs: 8px; --space-s: 12px; --space-m: 16px; --space-l: 32px; --space-xl: 48px;
        --page-margin: 20px; --page-width: 1200px; --radius-card: 12px; --radius-button: 999px; --radius-sm: 4px;
        --color-border: #444; --color-background: #fff; --color-foreground: #000; --color-foreground-muted: #666;
        --color-hover: #eee; --color-button: #a40; --color-button-text: #fff; --color-control-border: #444;
        --text-body: 16px; --text-lg: 18px; --control-h: 44px; --control-pad-m: 16px; --control-pad-y: 4px; --radius-input: 8px; --duration: 0.2s; --ease: ease; --text-small: 14px; --text-caption: 12px; --leading-snug: 1.3; --leading-tight: 1.1;
        --control-h-sm: 36px; --badge-pad: 2px; --badge-pad-x: 6px; --weight-ui: 600;
        --focus-ring: 2px solid #00f; --focus-offset: 2px; }
      body { margin: 0; }
      ${criticalCss}
      ${styles(fieldLiquid)}
      ${styles(searchFormLiquid)}
      ${styles(searchLiquid)}
      ${styles(cardLiquid)}
    </style>
    <div class="shopify-section"><div class="search section-full${blank ? " search--blank" : ""}">
      <h1 class="search__title h2">Search</h1>
      ${blank ? '<p class="search__hint">Find products.</p>' : ""}
      <search-form class="search-form search__form-wrapper"><form class="search-form__row">
        <div class="search-field"><svg class="icon" width="24" height="24"></svg>
          <input class="search-field__input" type="search" name="q" placeholder="Search articles, pages, or products" data-field>
          <button type="button" data-clear>x</button></div>
        <button type="submit">Search</button>
      </form></search-form>
      <nav class="search__types"><ul class="search__types-list">
        <li><a class="search__type" href="#" aria-current="true">All</a></li>
        <li><a class="search__type" href="#">Products</a></li>
        <li><a class="search__type" href="#">Articles</a></li>
        <li><a class="search__type" href="#">Pages</a></li>
      </ul></nav>
      <ul class="card-grid">${cards.map(card).join("")}</ul>
    </div></div>`;
};

const box = (selector) =>
  document.querySelector(selector).getBoundingClientRect();
const plain = { title: "Shipping", excerpt: "How long it takes." };

afterEach(() => {
  document.body.innerHTML = "";
});

describe("search page result cards", () => {
  test("the whole card, with or without a picture, is one link", async () => {
    await page.viewport(1366, 800);
    render([plain, { ...plain, image: true }]);
    for (const item of document.querySelectorAll(".result-card")) {
      const { left, top, height } = item.getBoundingClientRect();
      for (const y of [top + 8, top + height - 8]) {
        const hit = document.elementFromPoint(left + 8, y);
        expect(hit.closest("a.result-card__link")).not.toBeNull();
      }
    }
  });

  test("cards in a row stretch to the same height", async () => {
    await page.viewport(1366, 800);
    render([plain, { ...plain, image: true }, plain]);
    const heights = [...document.querySelectorAll(".result-card")].map((item) =>
      Math.round(item.getBoundingClientRect().height),
    );
    expect(new Set(heights).size).toBe(1);
  });

  test.each([320, 390])(
    "very long unbroken words stay inside the card at %ipx",
    async (width) => {
      await page.viewport(width, 800);
      const long = "Supercalifragilisticexpialidocious".repeat(3);
      render([{ title: long, excerpt: long }, plain]);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      const edge = document
        .querySelector(".result-card")
        .getBoundingClientRect().right;
      for (const selector of [".result-card__title", ".result-card__excerpt"]) {
        const range = document.createRange();
        range.selectNodeContents(document.querySelector(selector));
        expect(range.getBoundingClientRect().right).toBeLessThanOrEqual(edge);
      }
    },
  );

  test.each([320, 390])(
    "the search form fits at %ipx, field and button side by side",
    async (width) => {
      await page.viewport(width, 800);
      render([plain], true);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      const field = box(".search-field");
      const button = box(".search-form__row button[type=submit]");
      expect(button.left).toBeGreaterThanOrEqual(field.right);
      expect(button.right).toBeLessThanOrEqual(width);
    },
  );

  test("the type links wrap rather than widen the page at 320px", async () => {
    await page.viewport(320, 800);
    render([plain]);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
    for (const link of document.querySelectorAll(".search__type")) {
      expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(36);
    }
  });

  test("the section fills the screen below the header, with its content at the top", async () => {
    await page.viewport(1366, 800);
    render([]);
    document.documentElement.style.setProperty("--header-offset", "100px");
    const section = box(".search");
    expect(section.height).toBeGreaterThanOrEqual(700);
    expect(box(".search__title").top - section.top).toBeLessThan(80);
    // The rows keep their natural spacing; the extra height is empty space below.
    expect(box(".search__form-wrapper").top - section.top).toBeLessThan(150);
  });

  test("before a search the title, help line and field are centred in the section", async () => {
    await page.viewport(1366, 800);
    render([], true);
    document.documentElement.style.setProperty("--header-offset", "100px");
    const section = box(".search");
    const middle = (selector) => box(selector).left + box(selector).width / 2;
    for (const selector of [
      ".search__title",
      ".search__hint",
      ".search__form-wrapper",
    ]) {
      expect(
        Math.abs(middle(selector) - (section.left + section.width / 2)),
      ).toBeLessThan(2);
    }
    const content = box(".search__title").top;
    expect(content).toBeGreaterThan(section.top + 150);
    expect(box(".search__form-wrapper").bottom).toBeLessThan(
      section.bottom - 150,
    );
  });

  test("a long list of results makes the section taller, not clipped", async () => {
    await page.viewport(390, 800);
    render(Array.from({ length: 12 }, () => plain));
    expect(box(".search").height).toBeGreaterThan(800);
    expect(box(".search").bottom).toBeGreaterThanOrEqual(
      box(".card-grid").bottom,
    );
  });

  test("the current type link is filled", async () => {
    await page.viewport(1366, 800);
    render([plain]);
    const current = getComputedStyle(
      document.querySelector(".search__type[aria-current]"),
    );
    const other = getComputedStyle(
      document.querySelector(".search__type:not([aria-current])"),
    );
    expect(current.backgroundColor).not.toBe(other.backgroundColor);
  });
});
