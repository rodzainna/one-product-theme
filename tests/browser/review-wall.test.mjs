import { afterEach, describe, expect, test, vi } from "vitest";
import wallLiquid from "../../sections/review-wall.liquid?raw";
import "../../assets/review-wall.js";

const stylesheet =
  wallLiquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

// Shopify wraps each block in a div, and that wrapper is the grid item.
const card = (height = 100) =>
  `<div class="shopify-block"><article class="review" style="height: ${height}px"></article></div>`;

const render = (items) => {
  document.body.innerHTML = `
    <style>
      :root { --space-m: 16px; --space-xs: 8px; --space-xl: 32px; --space-l: 24px; }
      body { margin: 0; }
      ${stylesheet}
    </style>
    <review-wall class="review-wall__grid">${items}</review-wall>`;
  return document.querySelector("review-wall");
};

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const span = (item) => item.style.getPropertyValue("--review-span");

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("review wall rows", () => {
  test("gives each card enough 8px rows for its height and the margin below it", () => {
    const wall = render(card(100) + card(200));
    const [first, second] = wall.children;
    expect(span(first)).toBe(String(Math.ceil((100 + 16) / 8)));
    expect(span(second)).toBe(String(Math.ceil((200 + 16) / 8)));
    expect(wall.hasAttribute("data-masonry")).toBe(true);
  });

  test("measures again when a card changes height", async () => {
    const wall = render(card(100));
    const [item] = wall.children;
    item.firstElementChild.style.height = "300px";
    await vi.waitFor(() =>
      expect(span(item)).toBe(String(Math.ceil((300 + 16) / 8))),
    );
  });

  test("measures a card added later, and watches it from then on", async () => {
    const wall = render(card(100));
    // Let the first measurements settle, so only the new card can trigger the next one.
    await frame();
    await frame();
    const observe = vi.spyOn(ResizeObserver.prototype, "observe");
    wall.insertAdjacentHTML("beforeend", card(160));
    const added = wall.children[1];
    await vi.waitFor(() => expect(observe).toHaveBeenCalledWith(added));
    await vi.waitFor(() =>
      expect(span(added)).toBe(String(Math.ceil((160 + 16) / 8))),
    );
  });

  test("keeps the editor's placeholder for a blank review in a column", () => {
    const wall = render(
      `${card()}<div class="shopify-block"><div class="review-empty"></div></div>`,
    );
    expect(getComputedStyle(wall.children[1]).gridColumnEnd).not.toBe("-1");
  });

  test("leaves out a block that rendered nothing", () => {
    const wall = render(`${card()}<div class="shopify-block">\n</div>`);
    expect(getComputedStyle(wall.children[1]).display).toBe("none");
    expect(getComputedStyle(wall.children[0]).display).not.toBe("none");
  });

  test("lets anything that isn't a review, such as an app block, take a full row", () => {
    const wall = render(`${card()}<div class="shopify-block"><p>App</p></div>`);
    const [review, app] = wall.children;
    expect(getComputedStyle(app).gridColumnEnd).toBe("-1");
    expect(getComputedStyle(review).gridColumnEnd).not.toBe("-1");
  });
});

describe("review videos", () => {
  const withVideo = () =>
    render(`
      ${card()}
      <button type="button" data-dialog-open="review-a">Watch</button>
      <dialog id="review-a"><template data-review-video><video></video></template></dialog>`);

  test("puts the video in the dialog when its button is pressed, once", () => {
    const wall = withVideo();
    const dialog = wall.querySelector("dialog");
    expect(dialog.querySelector("video")).toBeNull();
    wall.querySelector("button").click();
    wall.querySelector("button").click();
    expect(dialog.querySelectorAll("video")).toHaveLength(1);
    expect(dialog.querySelector("template")).toBeNull();
  });

  test("pauses the video when the dialog closes", () => {
    const wall = withVideo();
    wall.querySelector("button").click();
    const video = wall.querySelector("video");
    video.pause = vi.fn();
    wall.querySelector("dialog").dispatchEvent(new Event("close"));
    expect(video.pause).toHaveBeenCalledOnce();
  });

  test("ignores a button whose dialog has no video", () => {
    const wall = render(`
      <button type="button" data-dialog-open="review-b">Read</button>
      <dialog id="review-b"><p>Text</p></dialog>`);
    expect(() => wall.querySelector("button").click()).not.toThrow();
    expect(() =>
      wall.querySelector("dialog").dispatchEvent(new Event("close")),
    ).not.toThrow();
  });
});
