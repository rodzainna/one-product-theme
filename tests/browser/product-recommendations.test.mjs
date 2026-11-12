import { afterEach, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import "../../assets/product-recommendations.js";

const URL =
  "/recommendations/products?section_id=s&product_id=1&limit=4&intent=related";

// The section as the page renders it, empty, `before` pixels down the page.
const render = (before = 0) => {
  document.body.innerHTML = `
    <style>body { margin: 0; }</style>
    <div style="height: ${before}px"></div>
    <div class="shopify-section">
      <product-recommendations id="Recs" data-url="${URL}" data-empty></product-recommendations>
    </div>
    <div style="height: 3000px"></div>`;
  return document.getElementById("Recs");
};

// What the API returns for the section: filled, or still empty.
const respond = (body, ok = true) =>
  vi
    .spyOn(window, "fetch")
    .mockResolvedValue(new Response(body, { status: ok ? 200 : 500 }));
const filled = `<div class="shopify-section"><product-recommendations id="Recs" data-url="${URL}">
  <h2>You may also like</h2><ul><li><a href="/products/a?pr_prod_strat=x">A</a></li></ul>
</product-recommendations></div>`;
const empty = `<div class="shopify-section"><product-recommendations id="Recs" data-url="${URL}" data-empty></product-recommendations></div>`;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  scrollTo(0, 0);
});

describe("product recommendations", () => {
  test("loads once near the screen and swaps the products in", async () => {
    await page.viewport(800, 600);
    const fetch = respond(filled);
    const section = render();
    await expect.poll(() => section.hasAttribute("data-empty")).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(URL);
    expect(section.querySelector("a").getAttribute("href")).toBe(
      "/products/a?pr_prod_strat=x",
    );
  });

  test("waits until the section is within 400px of the screen", async () => {
    await page.viewport(800, 600);
    const fetch = respond(filled);
    const section = render(1500);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(fetch).not.toHaveBeenCalled();
    scrollTo(0, 600);
    await expect.poll(() => section.hasAttribute("data-empty")).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("stays empty when there's nothing to recommend", async () => {
    await page.viewport(800, 600);
    const fetch = respond(empty);
    const section = render();
    await expect.poll(() => fetch.mock.calls.length).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(section.hasAttribute("data-empty")).toBe(true);
    expect(section.childElementCount).toBe(0);
  });

  test("stays empty when the request fails", async () => {
    await page.viewport(800, 600);
    const fetch = respond(filled, false);
    const section = render();
    await expect.poll(() => fetch.mock.calls.length).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(section.hasAttribute("data-empty")).toBe(true);
  });

  test("doesn't fetch again when the server already filled it", async () => {
    await page.viewport(800, 600);
    const fetch = respond(filled);
    document.body.innerHTML = filled;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(fetch).not.toHaveBeenCalled();
  });
});
