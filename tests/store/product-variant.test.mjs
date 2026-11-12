import { beforeAll, describe, expect, test } from "vitest";
import locale from "../../locales/en.default.json" with { type: "json" };
import { product, section, sectionId, variantId } from "./store.mjs";

const t = locale.products.product;

const pills = (html) =>
  [
    ...html.matchAll(
      /<label class="pill( pill--unavailable)?">\s*<input([^>]*)>([\s\S]*?)<\/label>/g,
    ),
  ].map(([, unavailable, attributes, label]) => ({
    name: attributes.match(/value="([^"]*)"/)[1],
    id: attributes.match(/data-option-value-id="(\d+)"/)[1],
    checked: /\schecked(?=[\s>=]|$)/.test(attributes),
    soldOut: Boolean(unavailable),
    soldOutText: label.includes(
      `<span class="visually-hidden"> (${t.sold_out})</span>`,
    ),
  }));
const checked = (html) =>
  pills(html)
    .filter((pill) => pill.checked)
    .map((pill) => pill.name);
const soldOut = (html) =>
  pills(html)
    .filter((pill) => pill.soldOut)
    .map((pill) => pill.name);
const valueId = (html, name) =>
  pills(html).find((pill) => pill.name === name).id;

const part = (html, pattern, name) => {
  const match = html.match(pattern);
  expect(match, `no ${name} in the section`).not.toBeNull();
  return match[0];
};
const idInput = (html) =>
  part(html, /<input\s+type="hidden"\s+name="id"[^>]*>/, "variant id input");
const addButton = (html) =>
  part(html, /<button[^>]*name="add"[^>]*>[\s\S]*?<\/button>/, "add button");
const accelerated = (html) =>
  part(
    html,
    /<div\s+class="buy-buttons__accelerated"[^>]*>/,
    "accelerated checkout",
  );
const isDisabled = (tag) => /\sdisabled[\s>]/.test(tag);
const isHidden = (tag) => /\shidden[\s>]/.test(tag);
const buttonText = (html) =>
  addButton(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
// The current price is the first plain <span>; on sale a hidden "Sale price" label comes before it.
const price = (html) =>
  html
    .match(/<div class="price[^"]*">[\s\S]*?<span>([^<]*)<\/span>/)?.[1]
    .trim() ?? null;

const sizeSoldOut = "/products/test-size-sold-out";
const severalPrices = "/products/test-several-prices";
const twoOptions = "/products/test-two-options";
let sizes, prices, two, main, twoStart;

// All test products use the default product template, so one section id serves them all.
beforeAll(async () => {
  [sizes, prices, two, main] = await Promise.all([
    product("test-size-sold-out"),
    product("test-several-prices"),
    product("test-two-options"),
    sectionId(sizeSoldOut, "main"),
  ]);
  twoStart = await section(twoOptions, main);
});

const pick = (...names) =>
  section(
    `${twoOptions}?option_values=${names.map((name) => valueId(twoStart, name)).join(",")}`,
    main,
  );

describe("the picker renders the variant in ?variant=", () => {
  test("a sold-out size is checked, marked sold out and can't be bought", async () => {
    const html = await section(
      `${sizeSoldOut}?variant=${variantId(sizes, "S")}`,
      main,
    );
    expect(checked(html)).toEqual(["S"]);
    expect(soldOut(html)).toEqual(["S"]);
    expect(pills(html).find((pill) => pill.name === "S").soldOutText).toBe(
      true,
    );
    expect(isDisabled(addButton(html))).toBe(true);
    expect(buttonText(html)).toBe(t.sold_out);
    expect(isHidden(accelerated(html))).toBe(true);
  });

  test("an in-stock size is checked and can be bought", async () => {
    const l = variantId(sizes, "L");
    const html = await section(`${sizeSoldOut}?variant=${l}`, main);
    expect(checked(html)).toEqual(["L"]);
    expect(idInput(html)).toContain(`value="${l}"`);
    expect(isDisabled(addButton(html))).toBe(false);
    expect(buttonText(html)).toBe(t.add_to_cart);
    expect(isHidden(accelerated(html))).toBe(false);
  });

  test("without ?variant= the first available size is checked", async () => {
    const firstAvailable = sizes.variants.find((v) => v.available);
    expect(firstAvailable, "the first size must be sold out").not.toBe(
      sizes.variants[0],
    );
    const html = await section(sizeSoldOut, main);
    expect(checked(html)).toEqual([firstAvailable.title]);
    expect(idInput(html)).toContain(`value="${firstAvailable.id}"`);
  });

  test("the price follows the selected variant", async () => {
    const m = prices.variants.find((v) => v.title === "M");
    const html = await section(`${severalPrices}?variant=${m.id}`, main);
    expect(price(html)).toMatch(
      new RegExp(`^\\D*${(m.price / 100).toFixed(2).replace(".", "\\.")}$`),
    );
    expect(m.price).not.toBe(prices.variants[0].price);
  });
});

describe("the picker renders the option values in ?option_values=", () => {
  test("each value carries its option value id, and the first available variant starts checked", () => {
    expect(checked(twoStart)).toEqual(["S", "Red"]);
    expect(pills(twoStart).every((pill) => /^\d+$/.test(pill.id))).toBe(true);
    expect(soldOut(twoStart)).toEqual([]);
  });

  test("picks the matching variant, sold out included", async () => {
    const html = await pick("M", "Blue");
    expect(checked(html)).toEqual(["M", "Blue"]);
    expect(idInput(html)).toContain(`value="${variantId(two, "M / Blue")}"`);
    expect(buttonText(html)).toBe(t.sold_out);
    expect(isHidden(accelerated(html))).toBe(true);
  });

  test("marks a value sold out only when nothing after it can be bought (top-down)", async () => {
    // With Blue picked, M stays available because M / Red is in stock.
    expect(soldOut(await pick("M", "Blue"))).toEqual(["Blue"]);
    expect(soldOut(await pick("M", "Red"))).toEqual(["Blue"]);
    expect(soldOut(await pick("S", "Red"))).toEqual([]);
  });

  test("a combination with no variant is Unavailable, with no price and an empty id", async () => {
    const html = await pick("L", "Blue");
    expect(checked(html)).toEqual(["L", "Blue"]);
    expect(idInput(html)).toMatch(/value=""/);
    expect(price(html)).toBeNull();
    expect(isDisabled(addButton(html))).toBe(true);
    expect(buttonText(html)).toBe(t.unavailable);
    expect(isHidden(accelerated(html))).toBe(true);
  });
});

describe("the picker and the form", () => {
  test("the form sends only the hidden variant id; the picker sits outside it", () => {
    const form = part(twoStart, /<form[\s\S]*?<\/form>/, "product form");
    expect(form.match(/name="id"/g)).toHaveLength(1);
    expect(form).not.toContain("<variant-picker");
    expect(twoStart).not.toMatch(/<select[^>]*name="id"/);
  });

  test("every part the script swaps has an id", () => {
    for (const prefix of [
      "Price-",
      "Product-id-",
      "Product-plans-",
      "Product-add-",
      "Product-accelerated-",
    ]) {
      expect(twoStart, prefix).toMatch(new RegExp(`id="${prefix}[^"]+"`));
    }
  });

  test("on the product's own page the picker may update the URL", () => {
    expect(part(twoStart, /<variant-picker[^>]*>/, "picker")).toMatch(
      /\sdata-update-url[\s>]/,
    );
  });

  test("the picker carries Shopify's standard event data and option names", async () => {
    const data = JSON.parse(
      part(
        twoStart,
        /<script type="application\/json" data-event-data>([\s\S]*?)<\/script>/,
        "event data",
      ).replace(/^[^>]*>|<\/script>$/g, ""),
    );
    expect(data.product).toMatchObject({
      id: two.id,
      handle: "test-two-options",
    });
    const blue = await pick("M", "Blue");
    const picked = JSON.parse(
      blue.match(/data-event-data>([\s\S]*?)<\/script>/)[1],
    ).product.selectedVariant;
    expect(picked).toMatchObject({
      id: Number(variantId(two, "M / Blue")),
      availableForSale: false,
    });
    expect(twoStart).toMatch(
      /data-option-value-id="\d+"\s+data-option-name="Size"/,
    );
  });

  test("a product with only the default variant has no picker", async () => {
    const html = await section("/products/test-regular", main);
    expect(html).not.toContain("<variant-picker");
    expect(idInput(html)).toMatch(/value="\d+"/);
  });
});
