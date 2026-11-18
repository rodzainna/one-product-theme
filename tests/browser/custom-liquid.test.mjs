import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";
import sectionLiquid from "../../sections/custom-liquid.liquid?raw";

const styles = (liquid) =>
  liquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

// What the section renders, inside the shopify-section wrapper the layout gives it.
const render = ({ fullScreen = false } = {}) => {
  document.body.innerHTML = `
    <style>
      :root { --page-width: 75rem; --page-margin: 20px; --space-l: 32px; --header-offset: 0px;
        --color-background: #e9dcc5; --color-foreground: #2a1d15; }
      body { margin: 0; }
      ${criticalCss}
      ${styles(sectionLiquid)}
    </style>
    <main><div class="shopify-section">
      <div class="custom-liquid-section full-width${fullScreen ? " section-full" : ""}">
        <div class="custom-liquid-section__content"><p id="merchant">Embed</p></div>
      </div>
    </div></main>`;
};

const box = (selector) =>
  document.querySelector(selector).getBoundingClientRect();

beforeEach(async () => {
  await page.viewport(1366, 800);
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("layout", () => {
  test("spans the whole window while its content sits in the page's centred column", () => {
    render();
    expect(box(".custom-liquid-section").width).toBe(1366);
    expect(box(".custom-liquid-section__content").width).toBe(1200);
    expect(box(".custom-liquid-section__content").left).toBe(83);
  });

  test("leaves room above and below the content", () => {
    render();
    const section = box(".custom-liquid-section");
    const content = box("#merchant");
    expect(content.top - section.top).toBe(32);
    expect(section.bottom - content.bottom).toBeGreaterThanOrEqual(32);
  });

  test("on a phone the content keeps the page margin", async () => {
    await page.viewport(390, 800);
    render();
    expect(box(".custom-liquid-section__content").left).toBe(20);
    expect(box(".custom-liquid-section__content").width).toBe(350);
  });
});

describe("wide embeds", () => {
  test.each([320, 390])(
    "an embed wider than the window scrolls inside the section, not the page, at %ipx",
    async (width) => {
      await page.viewport(width, 800);
      render();
      document.querySelector("#merchant").style.width = "3000px";
      const content = document.querySelector(".custom-liquid-section__content");
      expect(content.scrollWidth).toBeGreaterThan(width);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
    },
  );
});

describe("full screen", () => {
  test("fills the window and centres its content", () => {
    render({ fullScreen: true });
    const section = box(".custom-liquid-section");
    const content = box("#merchant");
    expect(section.height).toBeGreaterThanOrEqual(800);
    const above = content.top - section.top;
    const below = section.bottom - content.bottom;
    expect(Math.abs(above - below)).toBeLessThan(2);
  });
});
