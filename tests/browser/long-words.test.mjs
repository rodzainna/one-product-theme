import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";
import reviewLiquid from "../../blocks/_review.liquid?raw";
import tileLiquid from "../../blocks/_tile.liquid?raw";
import linkLiquid from "../../blocks/_contact-link.liquid?raw";
import textLiquid from "../../blocks/text.liquid?raw";
import contactLiquid from "../../sections/contact-form.liquid?raw";
import heroLiquid from "../../sections/hero.liquid?raw";
import buyBoxLiquid from "../../snippets/buy-box.liquid?raw";
import cartLineLiquid from "../../snippets/cart-line.liquid?raw";
import productTitleLiquid from "../../blocks/_product-title.liquid?raw";
import productDescriptionLiquid from "../../blocks/_product-description.liquid?raw";

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

  test("stays inside the hero", async () => {
    const column = await render(
      css(heroLiquid),
      `<section class="hero" style="--content-grid: 10px minmax(0, 1fr) 10px"><div class="hero__content">
        <p class="hero__eyebrow">${WORD}</p>
        <h1 class="hero__heading">${WORD}</h1>
        <p class="hero__text">${WORD}</p>
      </div></section>`,
    );
    for (const selector of [
      ".hero__eyebrow",
      ".hero__heading",
      ".hero__text",
    ]) {
      expect(right(selector), selector).toBeLessThanOrEqual(column.right);
      expect(spill(selector), selector).toBeLessThanOrEqual(1);
    }
  });

  test("stays inside the buy box: vendor, title and description", async () => {
    const column = await render(
      css(buyBoxLiquid) +
        css(productTitleLiquid) +
        css(productDescriptionLiquid),
      `<div class="buy-box"><div class="buy-box__info">
        <div class="product-title"><p class="product-title__vendor">${WORD}</p><h1 class="product-title__heading">${WORD}</h1></div>
        <div class="product-description"><div class="rte"><p>${WORD}</p><ul><li>${WORD}</li></ul></div></div>
      </div></div>`,
    );
    for (const selector of [
      ".product-title__vendor",
      ".product-title__heading",
      ".rte p",
      ".rte li",
    ]) {
      expect(right(selector), selector).toBeLessThanOrEqual(column.right);
      expect(spill(selector), selector).toBeLessThanOrEqual(1);
    }
  });

  test("stays inside a cart line: title, properties and discounts", async () => {
    const column = await render(
      css(cartLineLiquid),
      `<div class="cart-line"><div class="cart-line__media"></div>
        <div class="cart-line__details">
          <h2 class="cart-line__title"><a href="/">${WORD}</a></h2>
          <dl class="cart-line__meta"><div><dt>${WORD}:</dt><dd>${WORD}</dd></div></dl>
          <ul class="cart-line__discounts"><li>${WORD} (−$2.00)</li></ul>
        </div>
        <div class="cart-line__price">$18.00</div></div>`,
    );
    for (const selector of [".cart-line__title", ".cart-line__discounts li"]) {
      expect(right(selector), selector).toBeLessThanOrEqual(column.right);
      expect(spill(selector), selector).toBeLessThanOrEqual(1);
    }
  });

  test("leaves a wide table in a description to scroll", async () => {
    const cells = Array(8)
      .fill("<td><p>Specification</p><ul><li>Specification</li></ul></td>")
      .join("");
    const column = await render(
      css(buyBoxLiquid) + css(productDescriptionLiquid),
      `<div class="buy-box"><div class="buy-box__info"><div class="product-description"><div class="rte">
        <div class="rte__table"><table><tr>${cells}</tr></table></div>
      </div></div></div></div>`,
    );
    const region = document.querySelector(".rte__table");
    expect(region.scrollWidth).toBeGreaterThan(region.clientWidth);
    expect(region.getBoundingClientRect().right).toBeLessThanOrEqual(
      column.right,
    );
  });
});
