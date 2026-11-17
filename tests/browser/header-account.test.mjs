import { afterEach, beforeEach, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import headerLiquid from "../../sections/header.liquid?raw";

const stylesheet =
  headerLiquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

// What the header renders for the account: the component with its icon, then the plain link.
const render = () => {
  document.body.innerHTML = `
    <style>
      :root { --control-h: 44px; --radius-full: 999px; --focus-ring: 3px solid rgb(168, 65, 15); --focus-offset: 2px;
        --color-background: #fff; --color-foreground: #000; --color-accent: #a8410f; --radius-card: 12px;
        --space-2xs: 4px; --space-xs: 8px; --space-m: 16px; --font-body: sans-serif; --font-heading: serif; }
      ${stylesheet}
    </style>
    <div class="site-header__tools">
      <shopify-account class="site-header__account" menu="customer-account-main-menu">
        <span slot="signed-out-avatar" class="site-header__account-avatar">icon</span>
      </shopify-account>
      <span class="site-header__account-link"><a href="/account">Account</a></span>
    </div>`;
};

const shown = (selector) =>
  getComputedStyle(document.querySelector(selector)).display !== "none";

beforeEach(async () => {
  await page.viewport(1366, 800);
  render();
});

afterEach(() => {
  document.body.innerHTML = "";
});

// A custom element can't be undefined again, so this test has to run before the one that defines it.
test("until the component has loaded, a plain link to the account page stands in", () => {
  expect(shown(".site-header__account")).toBe(false);
  expect(shown(".site-header__account-link")).toBe(true);
});

test("once the component has loaded, it replaces the link and takes the theme's focus ring", async () => {
  customElements.define(
    "shopify-account",
    class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" }).innerHTML =
          '<button part="signed-out-avatar"><slot name="signed-out-avatar"></slot></button>';
      }
    },
  );
  expect(shown(".site-header__account")).toBe(true);
  expect(shown(".site-header__account-link")).toBe(false);

  await userEvent.tab();
  const button = document
    .querySelector("shopify-account")
    .shadowRoot.querySelector("button");
  expect(button.matches(":focus-visible")).toBe(true);
  const ring = getComputedStyle(button);
  expect(ring.outlineStyle).toBe("solid");
  expect(ring.outlineWidth).toBe("3px");
  expect(ring.outlineOffset).toBe("2px");
});
