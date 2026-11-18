import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";
import buyBoxLiquid from "../../snippets/buy-box.liquid?raw";
import galleryLiquid from "../../snippets/product-gallery.liquid?raw";

const styles = (liquid) =>
  liquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

// A product without media: the buy box holds the placeholder and the info.
const render = () => {
  document.body.innerHTML = `
    <style>
      :root { --space-xl: 48px; --space-s: 12px; --space-m: 16px; --radius-card: 12px;
        --color-hover: #eee; --color-foreground-muted: #666; --page-margin: 20px; --page-width: 1200px; }
      body { margin: 0; }
      ${criticalCss}
      ${styles(buyBoxLiquid)}
      ${styles(galleryLiquid)}
    </style>
    <main><div class="shopify-section"><div class="buy-box section-full">
      <div class="gallery gallery--empty" aria-hidden="true"><svg class="gallery__placeholder" viewBox="0 0 200 100"></svg></div>
      <div class="buy-box__info">info</div>
    </div></div></main>`;
};

const box = (selector) =>
  document.querySelector(selector).getBoundingClientRect();

afterEach(() => {
  document.body.innerHTML = "";
});

describe("placeholder image", () => {
  test("is a square the width of the media column, left of the info on a wide screen", async () => {
    await page.viewport(1366, 900);
    render();
    const placeholder = box(".gallery--empty");
    expect(placeholder.width).toBeCloseTo(placeholder.height, 0);
    expect(placeholder.width).toBeGreaterThan(400);
    expect(box(".gallery__placeholder").height).toBeCloseTo(
      placeholder.height,
      0,
    );
    expect(box(".buy-box__info").left).toBeGreaterThanOrEqual(
      placeholder.right,
    );
  });

  test("sits above the info on a phone, as wide as the page content", async () => {
    await page.viewport(390, 800);
    render();
    const placeholder = box(".gallery--empty");
    expect(box(".buy-box__info").top).toBeGreaterThanOrEqual(
      placeholder.bottom,
    );
    expect(placeholder.width).toBeCloseTo(390 - 40, 0);
    expect(placeholder.height).toBeCloseTo(placeholder.width, 0);
  });

  test("shows its picture in the muted colour on a soft background", async () => {
    await page.viewport(1366, 900);
    render();
    expect(
      getComputedStyle(document.querySelector(".gallery--empty"))
        .backgroundColor,
    ).toBe("rgb(238, 238, 238)");
    expect(
      getComputedStyle(document.querySelector(".gallery__placeholder")).fill,
    ).toBe("rgb(102, 102, 102)");
  });
});
