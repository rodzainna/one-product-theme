import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";
import imageLiquid from "../../snippets/image.liquid?raw";
import sectionLiquid from "../../sections/image-with-text.liquid?raw";

const css = (liquid) =>
  liquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

const pixel = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

const render = async ({
  reverse = false,
  single = false,
  width = 1200,
  height = 800,
  title = "Title",
} = {}) => {
  await page.viewport(width, height);
  document.body.innerHTML = `
    <style>
      :root { --space-xl: 32px; --space-m: 16px; --text-small: 14px;
        --text-lg: 18px; --radius-card: 8px; --content-grid: minmax(16px, 1fr) minmax(0, 1000px) minmax(16px, 1fr); }
      ${criticalCss}
      body { margin: 0; }
      ${css(sectionLiquid)}
      /* As on the page, the image snippet's rules come after the section's. */
      ${css(imageLiquid)}
    </style>
    <div class="image-text${reverse ? " image-text--reverse" : ""}">
      <div class="image-text__grid${single ? " image-text__grid--single" : ""}">
        <div class="image-text__frame">
          <div class="image-text__media"><div class="image"><img alt="" src="${pixel}" width="1800" height="1200"></div></div>
        </div>
        ${single ? "" : `<div class="image-text__copy"><p class="image-text__eyebrow">${title}</p><h2 class="image-text__heading">${title}</h2><div class="image-text__text"><p>${title}</p></div></div>`}
      </div>
    </div>`;
  const rect = (selector) =>
    document.querySelector(selector).getBoundingClientRect();
  return {
    frame: rect(".image-text__frame"),
    copy: single ? null : rect(".image-text__copy"),
    grid: rect(".image-text__grid"),
    rect,
  };
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("image", () => {
  test("fills its frame, whatever shape the photo is", async () => {
    const { frame, rect } = await render();
    const image = rect(".image-text__media img");
    expect(Math.round(image.width)).toBe(Math.round(frame.width));
    expect(Math.round(image.height)).toBe(Math.round(frame.height));
  });

  test("never grows taller than 45rem", async () => {
    expect((await render({ height: 1400 })).frame.height).toBe(720);
  });
});

describe("sides", () => {
  test("puts the image on the left by default, and the text beside it", async () => {
    const { frame, copy } = await render();
    expect(frame.right).toBeLessThanOrEqual(copy.left);
  });

  test("puts the image on the right when flipped", async () => {
    const { frame, copy } = await render({ reverse: true });
    expect(copy.right).toBeLessThanOrEqual(frame.left);
  });

  test("stacks the image above the text on a phone, even when flipped", async () => {
    const { frame, copy } = await render({ reverse: true, width: 390 });
    expect(frame.bottom).toBeLessThanOrEqual(copy.top);
  });

  test("a lone image takes the full width", async () => {
    const { frame, grid } = await render({ single: true });
    expect(Math.round(frame.width)).toBe(Math.round(grid.width));
  });
});

describe("first section", () => {
  test("fits the screen under the header even with the sticky bar showing", async () => {
    await page.viewport(1366, 800);
    document.documentElement.style.setProperty("--header-group-h", "80px");
    document.documentElement.style.setProperty("--sticky-bar-h", "70px");
    document.body.innerHTML = `
      <style>
        :root { --space-xl: 32px; --radius-card: 8px; --content-grid: minmax(16px, 1fr) minmax(0, 1000px) minmax(16px, 1fr); }
        body { margin: 0; }
        ${criticalCss}
        ${css(sectionLiquid)}
      </style>
      <main><div class="shopify-section">
        <div class="image-text full-width section-full">
          <div class="image-text__grid">
            <div class="image-text__frame"></div>
            <div class="image-text__copy">Text</div>
          </div>
        </div>
      </div></main>`;
    const section = document
      .querySelector(".image-text")
      .getBoundingClientRect();
    expect(Math.round(section.height)).toBe(800 - 80);
    document.documentElement.removeAttribute("style");
  });
});

describe("a long unbroken word in the copy", () => {
  test("wraps inside the column on a phone, in the eyebrow, heading and text", async () => {
    const { grid, rect } = await render({
      width: 360,
      title: "Supercalifragilisticexpialidocious".repeat(3),
    });
    for (const selector of [
      ".image-text__eyebrow",
      ".image-text__heading",
      ".image-text__text p",
    ]) {
      expect(rect(selector).right, selector).toBeLessThanOrEqual(grid.right);
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360);
  });
});
