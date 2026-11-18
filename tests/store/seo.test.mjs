import { beforeAll, describe, expect, test } from "vitest";
import { get } from "./store.mjs";

const pages = {
  home: "/",
  product: "/products/test-regular",
  productWithImage: "/products/test-sale",
  cart: "/cart",
  search: "/search?q=x",
};

const head = {};
beforeAll(async () => {
  for (const [name, url] of Object.entries(pages)) {
    const html = await get(url);
    head[name] = html.slice(0, html.indexOf("</head>"));
  }
});

const meta = (html, key) =>
  html.match(
    new RegExp(`<meta\\s+(?:name|property)="${key}"\\s+content="([^"]*)"`),
  )?.[1];

describe("every page", () => {
  test.each(Object.keys(pages))(
    "%s has one title and a canonical link",
    (name) => {
      expect(head[name].match(/<title>/g)).toHaveLength(1);
      expect(head[name]).toMatch(
        /<link\s+rel="canonical"\s+href="https:\/\/[^"]+"/,
      );
    },
  );

  test.each(Object.keys(pages))(
    "%s has Open Graph and Twitter card tags",
    (name) => {
      for (const key of [
        "og:site_name",
        "og:url",
        "og:title",
        "og:type",
        "twitter:card",
        "twitter:title",
      ]) {
        expect(meta(head[name], key), `${name} ${key}`).toBeTruthy();
      }
    },
  );

  test.each(Object.keys(pages))(
    "%s gives both social tags the same description, its own when it has one",
    (name) => {
      const own = meta(head[name], "description");
      const og = meta(head[name], "og:description");
      expect(meta(head[name], "twitter:description")).toBe(og);
      if (own) expect(og).toBe(own);
    },
  );
});

describe("descriptions", () => {
  test("a page with a description uses it", () => {
    expect(meta(head.product, "description")).toBe(
      "One variant in stock, no image.",
    );
  });

  test("the store name is never used as a stand-in description", () => {
    for (const name of Object.keys(pages)) {
      expect(meta(head[name], "description") ?? "").not.toBe(
        meta(head[name], "og:site_name"),
      );
    }
  });
});

describe("sharing image and card", () => {
  test("a product with an image shares it and gets the large card", () => {
    expect(meta(head.productWithImage, "og:image")).toMatch(/test-sale/);
    expect(meta(head.productWithImage, "twitter:card")).toBe(
      "summary_large_image",
    );
  });

  test("a page without an image gets the plain summary card", () => {
    expect(meta(head.product, "og:image")).toBeUndefined();
    expect(meta(head.product, "twitter:card")).toBe("summary");
  });
});

describe("structured data", () => {
  test("a product page has Google's product data", () => {
    const json = head.product.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    )?.[1];
    expect(JSON.parse(json)["@type"]).toBe("Product");
  });

  test("other pages don't claim a product", () => {
    expect(head.home).not.toMatch(/application\/ld\+json/);
  });
});
