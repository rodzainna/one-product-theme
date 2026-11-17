import { afterEach, beforeEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import dialogLiquid from "../../snippets/dialog.liquid?raw";
import modalLiquid from "../../snippets/search-modal.liquid?raw";

const styles = (liquid) =>
  liquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

// The base dialog styles first, as in the theme, so the search modal has to win over them.
const render = () => {
  document.body.innerHTML = `
    <style>
      :root { --space-2xs: 4px; --space-xs: 8px; --space-s: 12px; --space-m: 16px; --space-xl: 32px; --page-margin: 20px;
        --control-h: 44px; --control-pad-s: 12px; --control-pad-y: 4px; --radius-card: 12px; --radius-input: 8px;
        --color-background: #fff; --color-foreground: #000; --color-border: #ccc; --color-control-border: #888;
        --color-overlay: rgb(0 0 0 / 0.6); --scrollbar-width: 0px; --focus-ring: 3px solid #a8410f; --focus-offset: 2px;
        --text-lg: 18px; --duration-spin: 0.8s; --ease-linear: linear; }
      body { margin: 0; }
      ${styles(dialogLiquid)}
      ${styles(modalLiquid)}
    </style>
    <predictive-search><dialog class="dialog search-modal" id="modal">
      <form class="search-modal__form">
        <div class="search-modal__bar">
          <div class="search-modal__field">
            <svg class="icon" id="search-icon" width="24" height="24"></svg>
            <span class="search-modal__loader"><svg class="icon" width="24" height="24"></svg></span>
            <input class="search-modal__input" type="search">
          </div>
          <button class="search-modal__close" type="button">Close</button>
        </div>
      </form>
      <div class="search-modal__results"></div>
    </dialog></predictive-search>`;
  return document.getElementById("modal");
};

beforeEach(async () => {
  await page.viewport(1000, 700);
});

afterEach(() => {
  document.querySelector("dialog")?.close();
  document.body.innerHTML = "";
});

test("it's a card centred across the window, 36rem wide, with all four corners rounded", () => {
  const modal = render();
  modal.showModal();
  const box = modal.getBoundingClientRect();
  expect(box.width).toBe(576);
  expect(box.left).toBe((1000 - 576) / 2);
  const style = getComputedStyle(modal);
  expect(style.borderTopLeftRadius).toBe("12px");
  expect(style.borderBottomRightRadius).toBe("12px");
});

test("on a phone it's centred and leaves a margin each side", async () => {
  await page.viewport(390, 700);
  const modal = render();
  modal.showModal();
  const box = modal.getBoundingClientRect();
  expect(box.left).toBeGreaterThanOrEqual(16);
  expect(box.left + box.width / 2).toBe(195);
});

test("it sits a sixth of the way down the window and grows downward as results arrive", () => {
  const modal = render();
  modal.showModal();
  const top = modal.getBoundingClientRect().top;
  expect(top).toBe(105); // 15% of the 700px window
  const results = modal.querySelector(".search-modal__results");
  results.innerHTML = `<p style="height: 200px">x</p>`;
  expect(modal.getBoundingClientRect().top).toBe(top);
  expect(modal.getBoundingClientRect().height).toBeGreaterThan(200);
});

test("the field and Close share a row inside the card", () => {
  const modal = render();
  modal.showModal();
  const field = modal
    .querySelector(".search-modal__field")
    .getBoundingClientRect();
  const close = modal
    .querySelector(".search-modal__close")
    .getBoundingClientRect();
  const bar = modal.getBoundingClientRect();
  const centre = (box) => box.top + box.height / 2;
  expect(Math.abs(centre(field) - centre(close))).toBeLessThan(2);
  expect(field.left).toBeGreaterThanOrEqual(bar.left);
  expect(close.right).toBeLessThanOrEqual(bar.right);
});

test("the results area is hidden until there is something in it", () => {
  const modal = render();
  modal.showModal();
  const results = modal.querySelector(".search-modal__results");
  expect(getComputedStyle(results).display).toBe("none");
  results.innerHTML = "<p>x</p>";
  expect(getComputedStyle(results).display).toBe("block");
});

test("a tall list of results scrolls inside the modal instead of growing it past the window", async () => {
  await page.viewport(1000, 500);
  const modal = render();
  modal.querySelector(".search-modal__results").innerHTML =
    `<p style="height: 2000px">x</p>`;
  modal.showModal();
  const box = modal.getBoundingClientRect();
  const results = modal.querySelector(".search-modal__results");
  expect(box.height).toBeLessThanOrEqual(500);
  expect(results.scrollHeight).toBeGreaterThan(results.clientHeight);
});

test("while searching, a spinning loader takes the search icon's place at the same size", () => {
  const modal = render();
  modal.showModal();
  const icon = modal.querySelector("#search-icon");
  const loader = modal.querySelector(".search-modal__loader");
  const shown = (element) => getComputedStyle(element).display !== "none";
  expect([shown(icon), shown(loader)]).toEqual([true, false]);
  const field = modal
    .querySelector(".search-modal__input")
    .getBoundingClientRect();

  document.querySelector("predictive-search").setAttribute("data-loading", "");
  expect([shown(icon), shown(loader)]).toEqual([false, true]);
  expect(getComputedStyle(loader).animationName).toBe("search-modal-spin");
  expect(loader.getBoundingClientRect().width).toBe(24);
  expect(
    modal.querySelector(".search-modal__input").getBoundingClientRect().left,
  ).toBe(field.left);
});
