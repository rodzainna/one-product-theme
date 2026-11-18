import { beforeAll, describe, expect, test } from "vitest";
import { get } from "./store.mjs";

let html;
beforeAll(async () => {
  html = await get("/policies/privacy-policy");
});

// Shopify writes this page's markup; the styles in assets/critical.css depend on it.
describe("a policy page", () => {
  test("sits in the theme's layout, in main, with Shopify's title and body", () => {
    const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
    expect(html).toContain('<header class="site-header');
    expect(html).toContain('<footer class="footer');
    expect(main).toMatch(/<div class="shopify-policy__container">/);
    expect(main).toMatch(
      /<div class="shopify-policy__title">\s*<h1>[^<]+<\/h1>/,
    );
    expect(main).toMatch(
      /<div class="shopify-policy__body">\s*<div class="rte">/,
    );
  });
});
