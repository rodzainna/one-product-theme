import { beforeAll, describe, expect, test } from "vitest";
import locale from "../../locales/en.default.json" with { type: "json" };
import { cartSession, get, product, variantId } from "./store.mjs";

const t = locale.cart;
const text = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const cart = (html) => html.split('<div class="cart" ')[1];
const summary = (html) => text(html.split('<div class="cart__summary">')[1]);
// Each line's markup, in cart order (newest first).
const lines = (html) => html.split('<div class="cart-line">').slice(1);
const line = (html, title) =>
  lines(html).find((part) => part.includes(`>${title}</a>`));

let ids;
beforeAll(async () => {
  const [two, several, unit, regular, gift] = await Promise.all(
    [
      "test-two-options",
      "test-several-prices",
      "test-unit-price",
      "test-regular",
      "test-gift-card",
    ].map(product),
  );
  ids = {
    two: variantId(two, "M / Red"),
    several: variantId(several, "S"),
    plan: several.selling_plan_groups[0].selling_plans[0],
    unit: unit.variants[0].id,
    regular: regular.variants[0].id,
    gift: variantId(gift, "$25"),
  };
});

describe("cart page", () => {
  test("an empty cart shows the message and a way back, with no form", async () => {
    const html = await get("/cart");
    expect(text(cart(html))).toContain(t.empty);
    expect(html).toContain(`>${t.continue_shopping}<`);
    expect(html).not.toContain('class="cart-form"');
  });

  describe("with a full cart", () => {
    let html;
    beforeAll(async () => {
      const page = await cartSession([
        { id: ids.two, quantity: 2 },
        { id: ids.several, quantity: 1, selling_plan: ids.plan.id },
        { id: ids.unit, quantity: 1 },
        {
          id: ids.gift,
          quantity: 1,
          properties: {
            "Recipient email": "a@example.com",
            _hidden: "x",
          },
        },
      ]);
      html = await page("/cart");
    });

    test("lists each line's options, plan, unit price and visible properties", () => {
      expect(text(line(html, "Test two options"))).toContain(
        "Size: M Colour: Red",
      );
      expect(text(line(html, "Test several prices"))).toContain(ids.plan.name);
      expect(text(line(html, "Test unit price"))).toMatch(/\$8\.80 \/ .*100g/);
      const gift = text(line(html, "Test gift card"));
      expect(gift).toContain("Recipient email: a@example.com");
      expect(gift).not.toContain("_hidden");
    });

    test("line titles are h2 under the page's h1", () => {
      expect(html).toContain('<h2 class="cart-line__title"');
    });

    test("a product with only the default variant shows no option list", () => {
      expect(line(html, "Test unit price")).not.toContain("<dl");
    });

    test("each line has a small stepper posting updates[<line key>], from 1, and a Remove link", () => {
      for (const part of lines(html)) {
        expect(part).toContain('class="quantity quantity--sm"');
        expect(part).toMatch(
          /name="updates\[\d+:[0-9a-f]+\]"\s+value="\d+"\s+min="1"/,
        );
        expect(part).toMatch(/href="\/cart\/change\?id=[^"]+&quantity=0"/);
      }
      expect(line(html, "Test two options")).toMatch(
        /name="updates\[\d+:[0-9a-f]+\]"\s+value="2"/,
      );
    });

    test("loads the quantity script once for every line", () => {
      expect(html.match(/quantity-input\.js/g)).toHaveLength(1);
    });

    test("thumbnails are 5rem with files up to 3x", () => {
      const img = line(html, "Test two options").match(/<img[^>]+>/)[0];
      expect(img).toContain('sizes="5rem"');
      expect(img).toMatch(/width=80 80w, .*width=160 160w, .*width=240 240w/);
    });

    test("the note and Check out belong to the cart form", () => {
      const form = html.match(/<form class="cart-form" id="([^"]+)"/)[1];
      expect(html).toMatch(
        new RegExp(
          `<textarea[^>]*name="note"[^>]*form="${form}"|<textarea[^>]*form="${form}"[^>]*name="note"`,
        ),
      );
      expect(html).toMatch(
        new RegExp(`name="checkout"[\\s\\S]{0,200}form="${form}"`),
      );
    });

    test("shows the subtotal and the store's tax line", () => {
      expect(summary(html)).toMatch(/Subtotal \$\d+\.\d\d AUD/);
      expect(summary(html)).toContain(
        locale.products.product.tax_info_included,
      );
    });
  });

  describe("automatic discounts", () => {
    test("a product discount shows on its line, with the old line price struck", async () => {
      const page = await cartSession([{ id: ids.regular, quantity: 1 }]);
      const part = text(line(await page("/cart"), "Test regular"));
      expect(part).toContain("Test 10% off test-regular (−$2.00)");
      expect(part).toMatch(/Sale price \$18\.00 Regular price \$20\.00/);
    });

    test("an order discount shows in the totals", async () => {
      const page = await cartSession([{ id: ids.regular, quantity: 6 }]);
      const totals = summary(await page("/cart"));
      expect(totals).toContain("Test $5 off orders over $100 −$5.00");
      expect(totals).toContain("Subtotal $103.00 AUD");
    });
  });
});
