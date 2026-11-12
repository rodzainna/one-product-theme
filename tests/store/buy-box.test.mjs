import { beforeAll, describe, expect, test } from "vitest";
import locale from "../../locales/en.default.json" with { type: "json" };
import { product, section, sectionId } from "./store.mjs";

const t = locale.products.product;
const taxLines = [
  t.tax_included,
  t.duties_and_tax_included,
  t.duties_included,
].map((line) => line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const text = (html) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<tool-tip[\s\S]*?<\/tool-tip>/g, "")
    // The tax line depends on the store's tax setting; the tax note tests cover it.
    .replace(
      new RegExp(`<p class="price__note">(${taxLines.join("|")})</p>`, "g"),
      "",
    )
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
  part(
    html,
    /<div class="price price--lg">[\s\S]*?<\/tool-tip>[\s\S]*?<\/div>/,
    "price",
  );
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

describe("tax note", () => {
  const tooltip = (h) =>
    part(h, /<tool-tip class="tooltip">[\s\S]*?<\/tool-tip>/, "tax tooltip");

  test("an ⓘ on the price line names and describes itself through its popover", () => {
    const price = priceBlock(html["test-sale"]);
    const tip = tooltip(price);
    const id = tip.match(/popovertarget="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(tip).toContain(`aria-describedby="${id}"`);
    expect(tip).toContain(`popover id="${id}"`);
    expect(tip).toContain(`aria-label="${t.tax_info_label}"`);
  });

  test("the visible line and the ⓘ text agree on what's included", () => {
    const expected = {
      [t.duties_and_tax_included]: [t.tax_info_duties_and_tax_included],
      [t.tax_included]: [t.tax_info_included],
      [t.duties_included]: [t.tax_info_duties_included],
      none: [t.tax_info_excluded],
    };
    for (const handle of ["test-regular", "test-sale", "test-unit-price"]) {
      const price = priceBlock(html[handle]);
      const line =
        [t.duties_and_tax_included, t.tax_included, t.duties_included].find(
          (note) => price.includes(`<p class="price__note">${note}</p>`),
        ) ?? "none";
      const bubble = text(
        tooltip(price).match(
          /<span class="tooltip__bubble"[\s\S]*?<\/span>/,
        )[0],
      );
      expect(expected[line]).toContain(bubble);
    }
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
