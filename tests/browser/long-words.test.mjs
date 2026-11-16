import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";
import reviewLiquid from "../../blocks/_review.liquid?raw";
import tileLiquid from "../../blocks/_tile.liquid?raw";
import linkLiquid from "../../blocks/_contact-link.liquid?raw";
import textLiquid from "../../blocks/text.liquid?raw";
import contactLiquid from "../../sections/contact-form.liquid?raw";

const css = (liquid) =>
  liquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";
const WORD = "Supercalifragilisticexpialidocious".repeat(3);

// Renders markup in a 300px column with the base styles first, as on the page.
const render = async (styles, html) => {
  await page.viewport(300, 600);
  document.body.innerHTML = `
    <style>${criticalCss} body { margin: 0 } ${styles}</style>
    <div id="column" style="width: 300px; overflow: hidden">${html}</div>`;
  return document.getElementById("column").getBoundingClientRect();
};
const right = (selector) =>
  document.querySelector(selector).getBoundingClientRect().right;
// A word that spills out of its own box shows as scroll width beyond the box.
const spill = (selector) => {
  const element = document.querySelector(selector);
  return element.scrollWidth - element.clientWidth;
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("a long unbroken word", () => {
  test("stays inside a review card", async () => {
    const column = await render(
      css(reviewLiquid),
      `<article class="review review--story"><div class="review__body">
        <h3 class="review__title">${WORD}</h3>
        <p class="review__excerpt">${WORD}</p>
        <p class="review__name">${WORD}</p>
      </div></article>`,
    );
    for (const selector of [
      ".review__title",
      ".review__excerpt",
      ".review__name",
    ]) {
      expect(right(selector), selector).toBeLessThanOrEqual(column.right);
      expect(spill(selector), selector).toBeLessThanOrEqual(1);
    }
  });

  test("stays inside a link tile", async () => {
    const column = await render(
      css(tileLiquid),
      `<a class="tile" href="/"><div class="tile__text">
        <h3 class="tile__title">${WORD}</h3><span class="tile__tags">${WORD}</span>
      </div></a>`,
    );
    for (const selector of [".tile__title", ".tile__tags"]) {
      expect(right(selector), selector).toBeLessThanOrEqual(column.right);
      expect(spill(selector), selector).toBeLessThanOrEqual(1);
    }
  });

  test("stays inside the contact page's side card", async () => {
    const column = await render(
      css(textLiquid) + css(contactLiquid) + css(linkLiquid),
      `<aside class="contact__aside"><div class="shopify-block"><h2 class="text text--subtitle">${WORD}</h2></div><div class="shopify-block"><div class="text text--normal">${WORD}</div></div>
        <p class="contact-link"><a href="/">${WORD}</a></p></aside>`,
    );
    for (const selector of [
      ".contact__aside h2",
      ".contact__aside div.text",
      ".contact-link a",
    ]) {
      expect(right(selector), selector).toBeLessThanOrEqual(column.right);
      expect(spill(selector), selector).toBeLessThanOrEqual(1);
    }
  });
});
