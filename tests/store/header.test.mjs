import { beforeAll, describe, expect, test } from "vitest";
import { get } from "./store.mjs";

let home, cart;
beforeAll(async () => {
  [home, cart] = await Promise.all([get("/"), get("/cart")]);
});

const group = (html) =>
  html.slice(html.indexOf('<div class="header-group">'), html.indexOf("<main"));

describe("header group", () => {
  test("holds the announcement bar first, then the header", () => {
    const html = group(home);
    const bar = html.indexOf('class="announcement ');
    const header = html.indexOf('<header class="site-header ');
    expect(bar).toBeGreaterThan(-1);
    expect(header).toBeGreaterThan(bar);
  });

  test("names the announcement bar so its text sits in a landmark", () => {
    expect(group(home)).toMatch(
      /class="announcement [^"]*"\s+role="region"\s+aria-label="Announcement"/,
    );
  });

  test("marks the page as having a sticky header", () => {
    expect(home).toMatch(/<html[^>]*class="[^"]*\bheader-sticky\b/);
    expect(cart).toMatch(/<html[^>]*class="[^"]*\bheader-sticky\b/);
  });

  test("labels the menu and marks the current page", () => {
    const html = group(home);
    expect(html).toMatch(
      /<nav class="site-header__nav" aria-label="Main menu"/,
    );
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(group(cart)).not.toMatch(/aria-current="page"/);
  });

  test("keeps the cart icon region the cart script updates", () => {
    expect(group(home)).toMatch(
      /id="CartIcon-[^"]+" data-cart-region data-cart-icon/,
    );
  });
});
