import { afterEach, beforeEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";
import buyBoxLiquid from "../../snippets/buy-box.liquid?raw";

const stylesheet = buyBoxLiquid.match(
  /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
)[1];
const classes = buyBoxLiquid.match(/<div class="(buy-box[^"]*)">/)[1];

beforeEach(async () => {
  await page.viewport(1366, 900);
  document.documentElement.style.setProperty("--header-group-h", "80px");
  document.body.innerHTML = `
    <style>:root { --space-xl: 32px; --space-s: 12px; }${criticalCss}${stylesheet}</style>
    <main><div class="shopify-section"><div class="${classes}">
      <div style="height: 300px">gallery</div><div class="buy-box__info">info</div>
    </div></div></main>`;
});

afterEach(() => {
  document.documentElement.removeAttribute("style");
  document.body.innerHTML = "";
});

test("a short buy box still fills the screen under the header", () => {
  const box = document.querySelector(".buy-box").getBoundingClientRect();
  expect(Math.round(box.height)).toBe(900 - 80);
});

test("keeps its content in the middle of that space", () => {
  const box = document.querySelector(".buy-box").getBoundingClientRect();
  const gallery = document
    .querySelector(".buy-box > div")
    .getBoundingClientRect();
  expect(
    Math.abs(gallery.top - box.top - (box.bottom - gallery.bottom)),
  ).toBeLessThan(2);
});
