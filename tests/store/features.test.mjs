import { beforeAll, describe, expect, test } from "vitest";
import { get, section, sectionId } from "./store.mjs";

let page, features;
beforeAll(async () => {
  page = await get("/");
  features = await section("/", await sectionId("/", "features"));
});

describe("features", () => {
  test("is a list (by role, since Shopify wraps each block in a div) under an h2, with an h3 and an icon per feature", () => {
    expect(features).toMatch(/<h2 class="features__heading">[^<]+<\/h2>/);
    expect(features).toMatch(/<div class="features__list" role="list">/);
    expect(
      features.match(/<div class="feature" role="listitem"/g),
    ).toHaveLength(4);
    expect(features.match(/<h3 class="feature__title">/g)).toHaveLength(4);
    expect(features.match(/<span class="feature__icon">/g)).toHaveLength(4);
  });

  test("keeps the icons decorative", () => {
    expect(features).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  test("comes after the buy box on the home page", () => {
    const order = [
      ...page.matchAll(/<div id="shopify-section-[^"]*__(\w+)"/g),
    ].map((m) => m[1]);
    expect(order.indexOf("features")).toBeGreaterThan(
      order.indexOf("featured_product"),
    );
  });

  test("has no background image or parallax when none is set", () => {
    expect(features).not.toContain("features__media");
    expect(features).not.toMatch(/class="features [^"]*parallax/);
  });

  test("passes the icon sizes, 44px on mobile and 48px on desktop by default", () => {
    expect(features).toContain("--features-icon-mobile: 44px");
    expect(features).toContain("--features-icon-desktop: 48px");
  });

  test("sets balanced column counts for four features: four wide, two in between", () => {
    expect(features).toContain("--features-columns: 4");
    expect(features).toContain("--features-columns-mid: 2");
  });
});
