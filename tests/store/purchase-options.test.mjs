import { beforeAll, describe, expect, test } from "vitest";
import locale from "../../locales/en.default.json" with { type: "json" };
import { section, sectionId } from "./store.mjs";

const t = locale.products.product;
const path = "/products/test-several-prices";
const text = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const plans = (html) =>
  text(
    html.match(
      /<fieldset class="choice-group[\s\S]*?<\/div>\s*<div class="buy-buttons__row"/,
    )[0],
  );
const price = (html) =>
  text(html.match(/<div\s+class="product-price"[\s\S]*?<\/div>/)[0]);

let id;
beforeAll(async () => {
  id = await sectionId(path, "main");
});

describe("purchase options", () => {
  test("lists one-time first, then each plan group under its name", async () => {
    const options = plans(await section(path, id));
    expect(options).toMatch(/^Purchase options One-time purchase \$10\.00 /);
    expect(options).toContain("Prepaid 4 deliveries, every 2 weeks");
    expect(options).toContain(
      "Subscribe & save Every 2 weeks $9.00 Every 4 weeks $9.00",
    );
  });

  test("a prepaid plan shows the price per delivery and the amount charged at checkout", async () => {
    expect(plans(await section(path, id))).toContain(
      t.plan_prepaid
        .replace("{{ price }}", "$8.50")
        .replace("{{ total }}", "$34.00"),
    );
  });

  test("?selling_plan= checks that plan and prices the product by it", async () => {
    const html = await section(path, id);
    const label = html
      .split("<label")
      .find((part) => part.includes(">Every 2 weeks<"));
    const planId = label?.match(/name="selling_plan"\s+value="(\d+)"/)?.[1];
    expect(planId).toBeTruthy();
    const chosen = await section(`${path}?selling_plan=${planId}`, id);
    expect(chosen).toMatch(new RegExp(`value="${planId}"[^>]*checked`));
    expect(price(chosen)).toMatch(/\$9\.00/);
  });
});

describe("buy buttons", () => {
  test("no quantity rules line without B2B rules, and the limits follow the variant", async () => {
    const html = await section(path, id);
    expect(html).toMatch(/<p class="buy-buttons__rules"[^>]*><\/p>/);
    expect(html).toMatch(/data-variant-attributes="min max step disabled"/);
  });

  test("shows dynamic checkout by default", async () => {
    const html = await section(path, id);
    expect(html).toMatch(/class="buy-buttons__accelerated/);
  });
});
