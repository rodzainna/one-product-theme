import { beforeAll, describe, expect, test } from "vitest";
import locale from "../../locales/en.default.json" with { type: "json" };
import { STORE_URL, cartSession, get, product } from "./store.mjs";

const t = locale.cart;
const drawer = (html) =>
  html.match(/<div id="shopify-section-cart-drawer"[\s\S]*?<\/dialog>/)?.[0];

let regular;
beforeAll(async () => {
  regular = (await product("test-regular")).variants[0].id;
});

describe("cart drawer", () => {
  test("renders on product pages but not on /cart", async () => {
    expect(drawer(await get("/products/test-regular"))).toContain(
      'id="CartDrawer"',
    );
    expect(await get("/cart")).not.toContain('id="CartDrawer"');
  });

  test("an empty drawer shows the message and no totals", async () => {
    const html = drawer(await get("/products/test-regular"));
    expect(html).toContain(t.empty);
    expect(html).not.toContain('class="cart-summary"');
  });

  test("with items it lists the lines, the note toggle and Check out for its own form", async () => {
    const page = await cartSession([{ id: regular, quantity: 2 }]);
    const html = drawer(await page("/products/test-regular"));
    expect(html).toContain('class="cart-line"');
    expect(html).toContain('<h3 class="cart-line__title"');
    expect(html).toContain(`<summary>${t.note_toggle}</summary>`);
    expect(html).toMatch(/name="checkout"[\s\S]{0,200}form="CartDrawerForm"/);
    expect(html).toMatch(/data-line-key="\d+:[0-9a-f]+"/);
  });

  test("/cart/add.js returns the drawer and the header icon with the new count", async () => {
    const productPage = await get("/products/test-regular");
    const header = productPage.match(
      /id="shopify-section-(sections--\d+__header)"/,
    )[1];
    const body = new FormData();
    body.append("id", regular);
    body.append("quantity", "3");
    body.append("sections", `cart-drawer,${header}`);
    body.append("sections_url", "/products/test-regular");
    const response = await fetch(new URL("/cart/add.js", STORE_URL), {
      method: "POST",
      headers: { Accept: "application/json" },
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.sections["cart-drawer"]).toContain('id="CartDrawerLines"');
    expect(data.sections["cart-drawer"]).toMatch(/value="3"/);
    expect(data.sections[header]).toMatch(
      /data-cart-icon[\s\S]*icon-button__badge" aria-hidden="true">3</,
    );
  });
});
