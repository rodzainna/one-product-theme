import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import "../../assets/sticky-add-to-cart.js";

// A buy box section with its bar, then a tall section; `overlap` pulls it up over the button,
// `sticky` makes the sections stack as on home and story pages, `marker` adds a snap marker.
const render = ({
  before = 0,
  overlap = 0,
  spacer = 300,
  sticky = false,
  marker = false,
} = {}) => {
  const position = sticky ? "position: sticky; top: 0" : "position: relative";
  document.body.innerHTML = `
    <style>body { margin: 0; } .sticky-bar { position: fixed; inset: auto 0 0; margin: 0; height: 60px; padding: 0; border: 0; }</style>
    <div style="height: ${before}px"></div>
    <main>
      <div class="shopify-section" style="${position}; background: white">
        <div class="buy-box__info">
          <div style="height: ${spacer}px"></div>
          <button id="Add" name="add">Add to cart</button>
          <div style="height: 50px"></div>
          <sticky-add-to-cart class="sticky-bar" data-button="Add" popover="manual"><button>Add to cart</button></sticky-add-to-cart>
        </div>
      </div>
      ${marker ? '<div class="snap-marker" style="position: absolute; top: 0; height: 10px"></div>' : ""}
      <div class="shopify-section" style="${position}; height: 3000px; margin-top: -${overlap}px; background: white"></div>
    </main>`;
  return document.querySelector("sticky-add-to-cart");
};
const settle = () =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
const open = (bar) => bar.matches(":popover-open");
const room = () =>
  getComputedStyle(document.documentElement).getPropertyValue("--sticky-bar-h");

afterEach(() => {
  for (const bar of document.querySelectorAll("sticky-add-to-cart"))
    bar.remove();
  document.body.innerHTML = "";
  scrollTo(0, 0);
});

describe("sticky add to cart", () => {
  test("stays hidden while Add to cart is on screen", async () => {
    await page.viewport(800, 600);
    const bar = render();
    await settle();
    expect(open(bar)).toBe(false);
    expect(room()).toBe("");
  });

  test("shows in the top layer once Add to cart scrolls above the screen, and hides on the way back", async () => {
    await page.viewport(800, 600);
    const bar = render();
    scrollTo(0, 800);
    await expect.poll(() => open(bar)).toBe(true);
    expect(room()).toBe("60px");
    scrollTo(0, 0);
    await expect.poll(() => open(bar)).toBe(false);
    expect(room()).toBe("");
  });

  test("shows when the next stacked section slides over Add to cart, and stays on top of it", async () => {
    await page.viewport(800, 600);
    const bar = render({ sticky: true });
    scrollTo(0, 500);
    await expect.poll(() => open(bar)).toBe(true);
    const { left, top, height } = bar.getBoundingClientRect();
    expect(
      document
        .elementFromPoint(left + 10, top + height / 2)
        .closest("sticky-add-to-cart"),
    ).toBe(bar);
  });

  test("skips a snap marker when finding the next section", async () => {
    await page.viewport(800, 600);
    const bar = render({ marker: true });
    await settle();
    expect(open(bar)).toBe(false);
  });

  test("shows while Add to cart is below the screen once the shopper is into the details", async () => {
    await page.viewport(800, 300);
    const bar = render({ before: 100 });
    await settle();
    expect(open(bar)).toBe(true);
  });

  test("waits while the details are still in the lower half of the screen", async () => {
    await page.viewport(800, 300);
    const bar = render({ before: 200 });
    await settle();
    expect(open(bar)).toBe(false);
  });

  test("follows a swapped Add to cart, looked up by id", async () => {
    await page.viewport(800, 600);
    // The old button would still be on screen at 600; only the new one, at the top, is above it.
    const bar = render({ before: 400, spacer: 500 });
    await settle();
    expect(open(bar)).toBe(false);
    const fresh = document.createElement("button");
    fresh.id = "Add";
    document.getElementById("Add").removeAttribute("id");
    document.querySelector(".buy-box__info").prepend(fresh);
    scrollTo(0, 600);
    await expect.poll(() => open(bar)).toBe(true);
  });

  test("a hidden bar doesn't take the room a visible one needs", async () => {
    await page.viewport(800, 600);
    const bar = render();
    const other = document.createElement("sticky-add-to-cart");
    other.dataset.button = "Missing";
    other.setAttribute("popover", "manual");
    document.body.append(other);
    scrollTo(0, 800);
    await expect.poll(() => open(bar)).toBe(true);
    await settle();
    expect(room()).toBe("60px");
  });

  test("with two buy boxes, only the one the shopper has reached shows its bar", async () => {
    await page.viewport(800, 600);
    const box = (id) => `
      <div class="shopify-section" style="position: relative">
        <div class="buy-box__info">
          <div style="height: 300px"></div>
          <button id="${id}">Add to cart</button>
          <div style="height: 300px"></div>
          <sticky-add-to-cart class="sticky-bar" data-button="${id}" popover="manual"><button>Add</button></sticky-add-to-cart>
        </div>
      </div>
      <div class="shopify-section" style="height: 1500px"></div>`;
    document.body.innerHTML = `
      <style>body { margin: 0; } .sticky-bar { position: fixed; inset: auto 0 0; margin: 0; height: 60px; padding: 0; border: 0; }</style>
      <main>${box("First")}${box("Second")}</main>`;
    const [first, second] = document.querySelectorAll("sticky-add-to-cart");
    // Between the two: the first buy box's bar.
    scrollTo(0, 1000);
    await expect.poll(() => open(first)).toBe(true);
    expect(open(second)).toBe(false);
    // In the second buy box, with its Add to cart on screen: no bar.
    scrollTo(0, 2150);
    await expect.poll(() => open(first)).toBe(false);
    expect(open(second)).toBe(false);
    expect(room()).toBe("");
    // Past the second: only its bar.
    scrollTo(0, 3000);
    await expect.poll(() => open(second)).toBe(true);
    expect(open(first)).toBe(false);
    expect(room()).toBe("60px");
  });

  test("hides over a later buy box that has no bar of its own", async () => {
    await page.viewport(800, 600);
    document.body.innerHTML = `
      <style>body { margin: 0; } .sticky-bar { position: fixed; inset: auto 0 0; margin: 0; height: 60px; padding: 0; border: 0; }</style>
      <main>
        <div class="shopify-section"><div class="buy-box">
          <div class="buy-box__info">
            <button id="First">Add to cart</button>
            <sticky-add-to-cart class="sticky-bar" data-button="First" popover="manual"><button>Add</button></sticky-add-to-cart>
          </div>
        </div></div>
        <div class="shopify-section" style="height: 1000px"></div>
        <div class="shopify-section"><div class="buy-box" style="height: 600px"><button>Add to cart</button></div></div>
        <div class="shopify-section" style="height: 1500px"></div>
      </main>`;
    const bar = document.querySelector("sticky-add-to-cart");
    scrollTo(0, 200);
    await expect.poll(() => open(bar)).toBe(true);
    scrollTo(0, 1100);
    await expect.poll(() => open(bar)).toBe(false);
    expect(room()).toBe("");
  });
});
