import { beforeAll, describe, expect, test } from "vitest";
import locale from "../../locales/en.default.json" with { type: "json" };
import { product, section, sectionId } from "./store.mjs";

const t = locale.products.product;
const text = (html) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<span class="visually-hidden">[\s\S]*?<\/span>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const part = (html, pattern, name) => {
  const match = html.match(pattern);
  expect(match, `no ${name} in the section`).not.toBeNull();
  return match[0];
};
const priceBlock = (html) =>
  part(html, /<div class="price price--lg">[\s\S]*?<\/div>/, "price");
const addButton = (html) =>
  part(html, /<button[^>]*name="add"[^>]*>[\s\S]*?<\/button>/, "add button");

// All test products use the default product template, so one section id serves them all.
const rendered = [
  "test-regular",
  "test-sale",
  "test-sold-out",
  "test-unit-price",
];
const html = {};
const json = {};
let main;

beforeAll(async () => {
  main = await sectionId("/products/test-regular", "main");
  await Promise.all([
    ...rendered.map(async (handle) => {
      html[handle] = await section(`/products/${handle}`, main);
    }),
    ...[...rendered, "test-size-sold-out"].map(async (handle) => {
      json[handle] = await product(handle);
    }),
  ]);
});

describe("product title", () => {
  test("is the page's h1, after the vendor", () => {
    const title = part(html["test-regular"], /<h1[^>]*>[^<]*<\/h1>/, "h1");
    expect(text(title)).toBe(json["test-regular"].title);
    const vendor = html["test-regular"].indexOf(
      '<p class="product-title__vendor">',
    );
    expect(vendor).toBeGreaterThan(-1);
    expect(vendor).toBeLessThan(html["test-regular"].indexOf("<h1"));
  });
});

describe("price", () => {
  test("regular: one amount and no badge", () => {
    const price = priceBlock(html["test-regular"]);
    expect(text(price)).toMatch(/^\D*20\.00$/);
  });

  test("sale: sale price, crossed-out compare-at and a Sale badge, with hidden labels", () => {
    const price = priceBlock(html["test-sale"]);
    expect(price).toContain(`>${t.sale_price}</span>`);
    expect(price).toContain(`>${t.regular_price}</span>`);
    expect(price).toMatch(/<s class="price__compare">\D*20\.00<\/s>/);
    expect(text(price)).toMatch(
      new RegExp(`^\\D*15\\.00 \\D*20\\.00 ${t.on_sale}$`),
    );
  });

  test("sold out: a Sold out badge and no Sale badge", () => {
    const price = priceBlock(html["test-sold-out"]);
    expect(text(price)).toMatch(new RegExp(`^\\D*20\\.00 ${t.sold_out}$`));
  });

  test("unit price: on its own line, read as 'per'", () => {
    const note = part(
      html["test-unit-price"],
      /<p class="price__note">[\s\S]*?<\/p>/,
      "unit price",
    );
    expect(text(note)).toMatch(/^\D*8\.80 \/ 100g$/);
    // text() adds spaces between tags, so check the visible slash's own spacing.
    expect(note).toContain('<span aria-hidden="true"> / </span>');
    expect(note).toContain(`>${t.unit_price}</span>`);
    expect(note).toContain(
      `&nbsp;${locale.accessibility.unit_price_separator}&nbsp;`,
    );
  });
});

describe("add to cart", () => {
  test("the quantity label is for screen readers only, as in the kit", () => {
    const label = part(
      html["test-regular"],
      /<label class="field__label[^"]*" for="Product-quantity-[^"]+">/,
      "quantity label",
    );
    expect(label).toContain("visually-hidden");
  });

  test("is enabled while the variant is available", () => {
    const button = addButton(html["test-regular"]);
    expect(button).not.toMatch(/\sdisabled[\s>]/);
    expect(text(button)).toBe(t.add_to_cart);
  });

  test("stays enabled for a sold-out size of an in-stock product (needs variant JS)", async () => {
    const path = "/products/test-size-sold-out";
    const s = json["test-size-sold-out"].variants.find((v) => v.title === "S");
    expect(s.available).toBe(false);
    const sold = await section(`${path}?variant=${s.id}`, main);
    const button = addButton(sold);
    expect(button).not.toMatch(/\sdisabled[\s>]/);
    expect(text(button)).toBe(t.add_to_cart);
  });

  test("becomes a disabled Sold out button when every variant is sold out", () => {
    const button = addButton(html["test-sold-out"]);
    expect(button).toMatch(/\sdisabled[\s>]/);
    expect(text(button)).toBe(t.sold_out);
  });
});
