import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";
import notFoundLiquid from "../../sections/404.liquid?raw";
import pageLiquid from "../../sections/page.liquid?raw";
import passwordLiquid from "../../sections/password.liquid?raw";
import fieldLiquid from "../../snippets/search-field.liquid?raw";
import searchFormLiquid from "../../snippets/search-form.liquid?raw";

const styles = (liquid) =>
  liquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

const tokens = `:root { --space-2xs: 4px; --space-xs: 8px; --space-s: 12px; --space-m: 16px; --space-l: 32px; --space-xl: 48px;
  --page-margin: 20px; --reading-width: 45rem; --page-width: 1200px; --radius-input: 8px; --radius-button: 999px; --color-border: #444;
  --color-background: #fff; --color-foreground: #000; --color-foreground-muted: #666; --color-hover: #eee; --color-accent: #a40;
  --text-body: 16px; --text-small: 14px; --text-lg: 18px; --text-h1: 64px; --text-h2: 40px; --text-h3: 24px; --text-h4: 20px;
  --leading-tight: 1.1; --control-h: 44px; --control-pad-m: 16px; --control-pad-y: 4px; --duration: 0.2s; --ease: ease;
  --font-heading: serif; --focus-ring: 2px solid #00f; --focus-offset: 2px; }
  body { margin: 0; }
  button, input { box-sizing: border-box; min-height: 44px; font: inherit; }`;
const LONG = "Supercalifragilisticexpialidocious".repeat(3);
const css = (...sections) =>
  `<style>${tokens} ${criticalCss} ${sections.map(styles).join(" ")}</style>`;
const box = (selector) =>
  document.querySelector(selector).getBoundingClientRect();
const field = `<div class="search-field"><svg class="icon" width="24" height="24"></svg>
  <input class="search-field__input" type="search" placeholder="Search articles, pages, or products">
  <button type="button" data-clear>x</button></div>`;

const renderPage = (content, title = "Shipping") => {
  document.body.innerHTML = `${css(pageLiquid)}<div class="shopify-section"><div class="page reading section-full">
    <div class="page__column reading__column"><h1 class="page__title h2">${title}</h1>
    <div class="page__content reading__content"><div class="rte">${content}</div></div></div></div></div>`;
};
const renderNotFound = () => {
  document.body.innerHTML = `${css(notFoundLiquid, fieldLiquid, searchFormLiquid)}<div class="shopify-section"><div class="not-found section-full">
    <p class="not-found__code" aria-hidden="true">404</p><h1 class="not-found__title h2">Page not found</h1>
    <p class="not-found__text">The page may have moved, or the address may be mistyped.</p>
    <search-form class="search-form not-found__search"><form class="search-form__row">${field}<button type="submit">Search</button></form></search-form>
    <div class="not-found__links"><a href="#" class="b">Back to shopping</a><a href="#" class="b">Home</a></div></div></div>`;
};
const renderPassword = (message = "This shop is private.", error = "") => {
  document.body.innerHTML = `${css(passwordLiquid)}<div class="shopify-section"><div class="password section-full"><div class="password__card">
    <h1 class="password__name">one-product-test</h1><p class="password__message">${message}</p>
    <form class="password__form"><div class="field"><input type="password" placeholder="Password" style="width:100%">${error}</div><button type="submit">Enter</button></form>
    <p class="password__owner">Are you the store owner? <a class="password__login" href="#">Log in</a></p></div></div></div>`;
};

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.style.removeProperty("--header-offset");
});

describe("plain page", () => {
  test("is one centred reading column no wider than 45rem", async () => {
    await page.viewport(1366, 800);
    renderPage("<p>Text.</p>");
    const column = box(".page__column");
    expect(column.width).toBe(720);
    expect(Math.abs(column.left + column.width / 2 - 1366 / 2)).toBeLessThan(2);
  });

  test("headings in the text sit below the title in size", async () => {
    await page.viewport(1366, 800);
    renderPage("<h2>Two</h2><h3>Three</h3>");
    const size = (selector) =>
      parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    expect(size(".rte h2")).toBe(24);
    expect(size(".rte h3")).toBe(20);
  });

  test.each([320, 390])(
    "very long words stay inside the column at %ipx",
    async (width) => {
      await page.viewport(width, 800);
      renderPage(`<p>${LONG}</p>`, LONG);
      const edge = box(".page__column").right;
      for (const selector of [".page__title", ".rte p"]) {
        const range = document.createRange();
        range.selectNodeContents(document.querySelector(selector));
        expect(
          range.getBoundingClientRect().right,
          selector,
        ).toBeLessThanOrEqual(edge);
      }
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
    },
  );

  test("fills the screen below the header, with its content at the top", async () => {
    await page.viewport(1366, 800);
    renderPage("<p>Text.</p>");
    document.documentElement.style.setProperty("--header-offset", "100px");
    expect(box(".page").height).toBeGreaterThanOrEqual(700);
    expect(box(".page__title").top - box(".page").top).toBeLessThan(80);
  });
});

describe("404 page", () => {
  test("centres its content in the section, both ways", async () => {
    await page.viewport(1366, 800);
    renderNotFound();
    document.documentElement.style.setProperty("--header-offset", "100px");
    const section = box(".not-found");
    for (const selector of [
      ".not-found__code",
      ".not-found__title",
      ".not-found__text",
      ".not-found__search",
      ".not-found__links",
    ]) {
      const element = box(selector);
      expect(
        Math.abs(
          element.left + element.width / 2 - (section.left + section.width / 2),
        ),
        selector,
      ).toBeLessThan(2);
    }
    const top = box(".not-found__code").top - section.top;
    const bottom = section.bottom - box(".not-found__links").bottom;
    expect(Math.abs(top - bottom)).toBeLessThan(40);
    expect(top).toBeGreaterThan(100);
  });

  test.each([320, 390])(
    "the search field and button sit side by side and fit at %ipx",
    async (width) => {
      await page.viewport(width, 800);
      renderNotFound();
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      const fieldBox = box(".search-field");
      const button = box(".search-form__row button[type=submit]");
      expect(button.left).toBeGreaterThanOrEqual(fieldBox.right);
      expect(button.right).toBeLessThanOrEqual(width);
      expect(Math.abs(button.height - fieldBox.height)).toBeLessThan(2);
    },
  );
});

describe("password page", () => {
  test("centres the card in the screen", async () => {
    await page.viewport(1366, 800);
    renderPassword();
    const card = box(".password__card");
    expect(Math.abs(card.left + card.width / 2 - 1366 / 2)).toBeLessThan(2);
    expect(Math.abs(card.top - (800 - card.bottom))).toBeLessThan(2);
    expect(card.width).toBeLessThanOrEqual(448);
  });

  test.each([320, 390])(
    "the password field and Enter share a row and fit at %ipx",
    async (width) => {
      await page.viewport(width, 800);
      renderPassword();
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      const input = box(".password__form input");
      const button = box(".password__form button");
      expect(button.left).toBeGreaterThanOrEqual(input.right);
      expect(button.right).toBeLessThanOrEqual(width);
      expect(Math.abs(input.top - button.top)).toBeLessThan(2);
    },
  );

  test("Enter stays level with the field when an error shows under it", async () => {
    await page.viewport(390, 800);
    renderPassword(
      "This shop is private.",
      '<p class="field__error">Incorrect password</p><p class="field__error">Try again</p>',
    );
    const field = box(".password__form .field");
    const input = box(".password__form input");
    expect(field.height).toBeGreaterThan(input.height + 20);
    expect(
      Math.abs(input.top - box(".password__form button").top),
    ).toBeLessThan(2);
  });

  test.each([320, 390])(
    "a very long store message stays inside the card at %ipx",
    async (width) => {
      await page.viewport(width, 800);
      renderPassword(LONG);
      const range = document.createRange();
      range.selectNodeContents(document.querySelector(".password__message"));
      expect(range.getBoundingClientRect().right).toBeLessThanOrEqual(
        box(".password__card").right,
      );
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
    },
  );
});
