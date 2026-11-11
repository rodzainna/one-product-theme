import { beforeAll, describe, expect, test } from "vitest";
import locale from "../../locales/en.default.json" with { type: "json" };
import { product, section, sectionId, variantId } from "./store.mjs";

const soldOut = locale.products.product.sold_out;

const selectedOption = (html) => {
  const match = html.match(/<option\s+value="(\d+)"\s+selected\s*>([^<]*)/);
  expect(match, "no selected <option> in the section").not.toBeNull();
  return { value: match[1], label: match[2] };
};

// The current price is the first plain <span>; on sale a hidden "Sale price" label comes before it.
const price = (html) => {
  const match = html.match(
    /<div class="price[^"]*">[\s\S]*?<span>([^<]*)<\/span>/,
  );
  expect(match, "no price in the section").not.toBeNull();
  return match[1].trim();
};

const sizeSoldOut = "/products/test-size-sold-out";
const severalPrices = "/products/test-several-prices";
let sizes, prices, sizesSection, pricesSection;

beforeAll(async () => {
  [sizes, prices, sizesSection, pricesSection] = await Promise.all([
    product("test-size-sold-out"),
    product("test-several-prices"),
    sectionId(sizeSoldOut, "main"),
    sectionId(severalPrices, "main"),
  ]);
});

describe("product section renders the variant in ?variant=", () => {
  test("a sold-out size is selected and marked sold out", async () => {
    const s = variantId(sizes, "S");
    const html = await section(`${sizeSoldOut}?variant=${s}`, sizesSection);
    const { value, label } = selectedOption(html);
    expect(value).toBe(String(s));
    expect(label).toContain(`(${soldOut})`);
  });

  test("an in-stock size is selected and not marked sold out", async () => {
    const l = variantId(sizes, "L");
    const html = await section(`${sizeSoldOut}?variant=${l}`, sizesSection);
    const { value, label } = selectedOption(html);
    expect(value).toBe(String(l));
    expect(label).not.toContain(soldOut);
  });

  test("the price follows the selected variant", async () => {
    const m = prices.variants.find((v) => v.title === "M");
    const html = await section(
      `${severalPrices}?variant=${m.id}`,
      pricesSection,
    );
    expect(price(html)).toMatch(
      new RegExp(`^\\D*${(m.price / 100).toFixed(2).replace(".", "\\.")}$`),
    );
    expect(m.price).not.toBe(prices.variants[0].price);
  });

  test("without ?variant= the first available size is selected", async () => {
    const firstAvailable = sizes.variants.find((v) => v.available);
    expect(firstAvailable, "the first size must be sold out").not.toBe(
      sizes.variants[0],
    );
    const html = await section(sizeSoldOut, sizesSection);
    expect(selectedOption(html).value).toBe(String(firstAvailable.id));
  });
});
