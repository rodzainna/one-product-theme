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

  test("labels the menu and marks the current page in the row and in the drawer", () => {
    const html = group(home);
    expect(html).toMatch(
      /<nav class="site-header__nav" aria-label="Main menu"/,
    );
    expect(html).toMatch(/<nav aria-label="Main menu">/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(2);
    expect(group(cart)).not.toMatch(/aria-current="page"/);
  });

  test("opens the phone menu from a button named for what it does", () => {
    const html = group(home);
    expect(html).toMatch(
      /<button[^>]*aria-label="Open menu"[^>]*data-dialog-open="MenuDrawer"/,
    );
    expect(html).toMatch(
      /<dialog\s+class="dialog dialog--drawer dialog--drawer-start"\s+id="MenuDrawer"/,
    );
  });

  test("every sub-menu button starts closed and points at a panel that exists", () => {
    const html = group(home);
    const toggles = html.match(/<button\s+class="menu__toggle"[^>]*>/g) ?? [];
    for (const toggle of toggles) {
      expect(toggle).toMatch(/aria-expanded="false"/);
      expect(toggle).toMatch(/aria-label="[^"]+ submenu"/);
      const id = toggle.match(/aria-controls="([^"]+)"/)?.[1];
      expect(html).toContain(`<ul class="menu__submenu" id="${id}">`);
      // The script and styles find the panel as the button's next sibling, inside a li marked data-submenu.
      expect(html).toMatch(
        new RegExp(
          `aria-controls="${id}"[^>]*>[\\s\\S]*?</button>\\s*<ul class="menu__submenu" id="${id}">`,
        ),
      );
    }
  });

  test("keeps the cart icon region the cart script updates", () => {
    expect(group(home)).toMatch(
      /id="CartIcon-[^"]+" data-cart-region data-cart-icon/,
    );
  });
});
