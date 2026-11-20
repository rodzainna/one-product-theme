import { afterEach, beforeEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import headerLiquid from "../../sections/header.liquid?raw";

const stylesheet =
  headerLiquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

// The header's row on a phone: the menu button, the store name, and the account and cart icons.
const render = (name) => {
  document.body.innerHTML = `
    <style>
      :root { --space-2xs: 4px; --space-xs: 8px; --space-m: 16px; --text-h4: 22px; --weight-heading: 700;
        --leading-none: 1; --font-heading: "Times New Roman", "Liberation Serif", serif; --color-border: #ddd; --content-grid: 20px 1fr 20px; }
      body { margin: 0; font-family: Arial, "Liberation Sans", sans-serif; }
      ${stylesheet}
    </style>
    <header class="site-header"><div class="site-header__inner">
      <span class="site-header__menu-button"><button style="width:44px;height:44px">m</button></span>
      <a class="site-header__logo site-header__name" href="/">${name}</a>
      <div class="site-header__tools"><span style="width:44px;height:44px"></span><span style="width:44px;height:44px"></span></div>
    </div></header>`;
  return document.querySelector(".site-header__name");
};

beforeEach(async () => {
  await page.viewport(390, 800);
});

afterEach(() => {
  document.body.innerHTML = "";
});

test("a store name of ordinary length stays on one line beside the icons", () => {
  const logo = render("one-product-test");
  expect(logo.getBoundingClientRect().height).toBeLessThan(30);
});

test("a very long word wraps inside the logo's share and never widens the page", () => {
  const logo = render("A".repeat(99));
  expect(document.documentElement.scrollWidth).toBe(innerWidth);
  expect(logo.getBoundingClientRect().width).toBeLessThanOrEqual(
    innerWidth * 0.55 + 1,
  );
});

test("on a very small phone the icons stay on the logo's row and the name wraps", async () => {
  await page.viewport(320, 800);
  const logo = render("one-product-test");
  const tools = document.querySelector(".site-header__tools");
  expect(tools.getBoundingClientRect().top).toBeLessThan(
    logo.getBoundingClientRect().bottom,
  );
  expect(document.querySelector(".site-header").offsetHeight).toBeLessThan(80);
});
