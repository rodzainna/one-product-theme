import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";

// Shopify's own policy stylesheet, which loads with the page and which these styles have to beat.
const shopifyPolicyCss = `
  .shopify-policy__container { max-width: 65ch; margin: 0 auto; padding-left: 20px; padding-right: 20px; }
  .shopify-policy__title { text-align: center; }`;

const render = async (width) => {
  await page.viewport(width, 800);
  document.body.innerHTML = `
    <style>
      :root { --space-l: 24px; --space-xl: 48px; --page-margin: 24px; --text-h2: 44px; --text-h3: 28px; --text-h4: 20px; --text-h1: 64px; }
      body { margin: 0 }
      ${criticalCss}
      ${shopifyPolicyCss}
    </style>
    <main><div class="shopify-policy__container">
      <div class="shopify-policy__title"><h1>Privacy policy</h1></div>
      <div class="shopify-policy__body"><div class="rte">
        <p>Last updated: November 11, 2026</p><h2>Personal information</h2><h3>Contact details</h3><p>Text</p>
      </div></div>
    </div></main>`;
};

const box = (selector) =>
  document.querySelector(selector).getBoundingClientRect();
const size = (selector) =>
  parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("a policy page", () => {
  test("reads in a column of about 45rem, centred, with room above the title", async () => {
    await render(1366);
    const container = box(".shopify-policy__container");
    expect(container.width).toBe(45 * 16);
    expect(container.left + container.width / 2).toBeCloseTo(1366 / 2, 0);
    expect(
      box(".shopify-policy__title h1").top - box("main").top,
    ).toBeGreaterThanOrEqual(48);
  });

  test("lines the title up with the text instead of centring it", async () => {
    await render(1366);
    expect(
      getComputedStyle(document.querySelector(".shopify-policy__title"))
        .textAlign,
    ).toBe("start");
    expect(box(".shopify-policy__title h1").left).toBe(
      box(".shopify-policy__body p").left,
    );
  });

  test("keeps headings in proportion to the text", async () => {
    await render(1366);
    expect(size(".shopify-policy__title h1")).toBe(44);
    expect(size(".shopify-policy__body h2")).toBe(28);
    expect(size(".shopify-policy__body h3")).toBe(20);
  });

  test("keeps the page margin on a phone", async () => {
    await render(390);
    expect(box(".shopify-policy__body p").left).toBe(24);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  });
});
