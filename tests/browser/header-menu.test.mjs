import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import menuLiquid from "../../snippets/menu-links.liquid?raw";
import "../../assets/header-menu.js";

// Playwright's WebKit doesn't Tab onto links, and an iframe resize doesn't fire its media change.
const webkit =
  /AppleWebKit/.test(navigator.userAgent) &&
  !/Chrome/.test(navigator.userAgent);

const stylesheet =
  menuLiquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

// What snippets/menu-links.liquid renders for Shop (two levels, then three) and a plain About link.
const menu = (variant, prefix) => `
  <ul class="menu menu--${variant}">
    <li class="menu__item" data-submenu>
      <a class="menu__link" href="#shop">Shop</a>
      <button class="menu__toggle" type="button" aria-expanded="false" aria-controls="${prefix}-1" aria-label="Shop submenu">v</button>
      <ul class="menu__submenu" id="${prefix}-1">
        <li><a class="menu__link" href="#beans">Beans</a>
          <ul class="menu__sublist"><li><a class="menu__link" href="#decaf">Decaf</a></li></ul>
        </li>
        <li><a class="menu__link" href="#gear">Gear</a></li>
      </ul>
    </li>
    <li class="menu__item" data-submenu>
      <a class="menu__link" href="#learn">Learn</a>
      <button class="menu__toggle" type="button" aria-expanded="false" aria-controls="${prefix}-2" aria-label="Learn submenu">v</button>
      <ul class="menu__submenu" id="${prefix}-2"><li><a class="menu__link" href="#brewing">Brewing</a></li></ul>
    </li>
    <li class="menu__item"><a class="menu__link" href="#about">About</a></li>
  </ul>`;

const render = () => {
  document.body.innerHTML = `
    <style>
      :root { --space-xs: 8px; --space-2xs: 4px; --space-s: 12px; --space-m: 16px; --target-min: 24px;
        --radius-full: 999px; --radius-card: 12px; --color-border: #ddd; --color-background: #fff;
        --color-foreground: #000; --color-foreground-muted: #555; --color-hover: #eee;
        --duration: 0s; --header-group-h: 120px; --ease: ease; --weight-ui: 600; --weight-heading: 700; --text-h3: 24px; --leading-tight: 1.25; }
      ${stylesheet}
    </style>
    <button id="before" type="button">before</button>
    <nav>${menu("bar", "Bar")}</nav>
    <button id="after" type="button">after</button>
    <dialog id="MenuDrawer"><nav>${menu("drawer", "Drawer")}</nav></dialog>`;
};

const bar = (name) =>
  document.querySelector(`.menu--bar .menu__toggle[aria-label="${name}"]`);
const drawer = (name) =>
  document.querySelector(`.menu--drawer .menu__toggle[aria-label="${name}"]`);
const panel = (toggle) =>
  document.getElementById(toggle.getAttribute("aria-controls"));
const inBar = (selector) => document.querySelector(`.menu--bar ${selector}`);
const shown = (toggle) => getComputedStyle(panel(toggle)).display !== "none";
const expanded = (toggle) => toggle.getAttribute("aria-expanded");

beforeEach(async () => {
  await page.viewport(1366, 800);
  render();
  // The mouse stays where the last test left it; park it on a neutral spot.
  await userEvent.hover(document.getElementById("after"));
});

afterEach(() => {
  document.getElementById("MenuDrawer")?.close();
  document.body.innerHTML = "";
});

describe("header row", () => {
  test("the button opens and closes its panel, and says so", async () => {
    const shop = bar("Shop submenu");
    expect(shown(shop)).toBe(false);
    await userEvent.click(shop);
    expect(expanded(shop)).toBe("true");
    expect(shown(shop)).toBe(true);
    await userEvent.click(shop);
    expect(expanded(shop)).toBe("false");
    expect(shown(shop)).toBe(false);
  });

  test("opening one panel closes the other", async () => {
    await userEvent.click(bar("Shop submenu"));
    await userEvent.click(bar("Learn submenu"));
    expect(expanded(bar("Shop submenu"))).toBe("false");
    expect(expanded(bar("Learn submenu"))).toBe("true");
  });

  test("Enter opens it with focus staying on the button, and Tab goes to the first link", async () => {
    const shop = bar("Shop submenu");
    shop.focus();
    await userEvent.keyboard("{Enter}");
    expect(expanded(shop)).toBe("true");
    expect(document.activeElement).toBe(shop);
    if (webkit) return;
    await userEvent.tab();
    expect(document.activeElement.textContent).toBe("Beans");
  });

  test("a tap on another button closes the open panel, where taps bring neither hover nor focus", () => {
    bar("Shop submenu").click();
    expect(expanded(bar("Shop submenu"))).toBe("true");
    bar("Learn submenu").click();
    expect(expanded(bar("Shop submenu"))).toBe("false");
    expect(expanded(bar("Learn submenu"))).toBe("true");
  });

  test("Esc closes it and returns focus to the button", async () => {
    const shop = bar("Shop submenu");
    await userEvent.click(shop);
    document.querySelector("#Bar-1 a").focus();
    await userEvent.keyboard("{Escape}");
    expect(expanded(shop)).toBe("false");
    expect(document.activeElement).toBe(shop);
  });

  test("Esc closes a panel opened by the mouse without moving focus", async () => {
    await userEvent.hover(document.querySelector(".menu--bar > li"));
    expect(expanded(bar("Shop submenu"))).toBe("true");
    document.getElementById("after").focus();
    await userEvent.keyboard("{Escape}");
    expect(expanded(bar("Shop submenu"))).toBe("false");
    expect(document.activeElement.id).toBe("after");
  });

  test("tabbing out of the panel closes it", async () => {
    const shop = bar("Shop submenu");
    await userEvent.click(shop);
    document.querySelector("#Bar-1 li:last-child a").focus();
    await userEvent.tab();
    await userEvent.tab();
    expect(expanded(shop)).toBe("false");
  });

  test("a click outside closes it, a click inside does not", async () => {
    const shop = bar("Shop submenu");
    await userEvent.click(shop);
    await userEvent.click(inBar('a[href="#gear"]'));
    expect(expanded(shop)).toBe("true");
    await userEvent.click(document.getElementById("after"));
    expect(expanded(shop)).toBe("false");
  });

  test("the mouse opens it on hover and closes it on leaving", async () => {
    const item = document.querySelector(".menu--bar > li");
    await userEvent.hover(item);
    expect(expanded(bar("Shop submenu"))).toBe("true");
    await userEvent.hover(document.getElementById("after"));
    expect(expanded(bar("Shop submenu"))).toBe("false");
  });

  test("moving from the link into the panel keeps it open", async () => {
    await userEvent.hover(inBar('a[href="#shop"]'));
    await userEvent.hover(inBar('a[href="#gear"]'));
    expect(expanded(bar("Shop submenu"))).toBe("true");
  });

  test("a panel opened from the keyboard stays when the mouse passes over and away", async () => {
    const shop = bar("Shop submenu");
    shop.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.hover(document.querySelector(".menu--bar > li"));
    await userEvent.hover(document.getElementById("after"));
    expect(expanded(shop)).toBe("true");
  });

  test("a long menu scrolls inside its panel instead of running off the screen", async () => {
    const panel = document.getElementById("Bar-1");
    for (let i = 0; i < 30; i++) {
      panel.insertAdjacentHTML(
        "beforeend",
        `<li><a class="menu__link" href="#more-${i}">More ${i}</a></li>`,
      );
    }
    await userEvent.click(bar("Shop submenu"));
    const box = panel.getBoundingClientRect();
    expect(box.height).toBeLessThanOrEqual(innerHeight - 120);
    expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight);
    expect(getComputedStyle(panel).overflowY).toBe("auto");
  });

  test("a mouse drifting over another item does not close the panel the keyboard is in", async () => {
    const shop = bar("Shop submenu");
    shop.focus();
    await userEvent.keyboard("{Enter}");
    const first = document.querySelector("#Bar-1 a");
    first.focus();
    await userEvent.hover(inBar('a[href="#learn"]'));
    expect(expanded(shop)).toBe("true");
    expect(document.activeElement).toBe(first);
  });

  test("a link without children has no button", () => {
    expect(
      document.querySelector(".menu--bar > li:last-child .menu__toggle"),
    ).toBeNull();
  });

  test("the third level is an indented list inside the panel", async () => {
    await userEvent.click(bar("Shop submenu"));
    const decaf = inBar('a[href="#decaf"]');
    expect(decaf.closest(".menu__sublist")).not.toBeNull();
    expect(decaf.getBoundingClientRect().left).toBeGreaterThan(
      inBar('a[href="#beans"]').getBoundingClientRect().left,
    );
  });
});

describe("phone drawer", () => {
  test("the buttons expand their lists in place, and several can stay open", async () => {
    document.getElementById("MenuDrawer").showModal();
    await userEvent.click(drawer("Shop submenu"));
    await userEvent.click(drawer("Learn submenu"));
    expect(shown(drawer("Shop submenu"))).toBe(true);
    expect(shown(drawer("Learn submenu"))).toBe(true);
    await userEvent.click(drawer("Shop submenu"));
    expect(shown(drawer("Shop submenu"))).toBe(false);
    expect(shown(drawer("Learn submenu"))).toBe(true);
  });

  test("a link closes the drawer; a button does not", async () => {
    const dialog = document.getElementById("MenuDrawer");
    dialog.showModal();
    await userEvent.click(drawer("Shop submenu"));
    expect(dialog.open).toBe(true);
    document.querySelector(".menu--drawer a[href='#about']").click();
    expect(dialog.open).toBe(false);
  });

  test("opening a link in a new tab or window leaves the drawer as it is", () => {
    const dialog = document.getElementById("MenuDrawer");
    dialog.showModal();
    const link = document.querySelector(".menu--drawer a[href='#about']");
    const click = (init) =>
      link.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, ...init }),
      );
    click({ ctrlKey: true });
    click({ metaKey: true });
    click({ shiftKey: true });
    click({ button: 1 });
    expect(dialog.open).toBe(true);
    link.target = "_blank";
    click({});
    expect(dialog.open).toBe(true);
  });

  test.skipIf(webkit)(
    "widening the window to the header row closes it",
    async () => {
      await page.viewport(390, 800);
      const dialog = document.getElementById("MenuDrawer");
      dialog.showModal();
      await page.viewport(1366, 800);
      await expect.poll(() => dialog.open, { timeout: 5000 }).toBe(false);
    },
  );
});
