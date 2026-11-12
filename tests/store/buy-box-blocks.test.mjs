import { describe, expect, test } from "vitest";
import { section, sectionId } from "./store.mjs";

const render = async (handle) => {
  const path = `/products/${handle}`;
  return section(path, await sectionId(path, "main"));
};
const text = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("rating", () => {
  test("shows the reviews metafields as stars, a score and a count", async () => {
    const html = await render("test-two-options");
    const rating = html.match(/<p\s+class="product-rating"[\s\S]*?<\/p>/)?.[0];
    expect(rating).toBeTruthy();
    expect(rating).toMatch(/--rating-percent: 90\.0%/);
    expect(text(rating)).toBe("Rated 4.5 out of 5 4.5 · 126 reviews");
  });

  test("renders nothing for a product without a rating", async () => {
    expect(await render("test-regular")).not.toMatch(/class="product-rating/);
  });
});

describe("pickup availability", () => {
  test("names the nearest pickup location and links to the store list", async () => {
    const html = await render("test-regular");
    const pickup =
      html.match(/<div class="pickup"[\s\S]*?<\/dialog>/)?.[0] ?? "";
    expect(text(pickup)).toMatch(/^Pickup available at \S/);
    expect(pickup).toMatch(/data-dialog-open="Pickup-[^"]+-dialog"/);
    expect(pickup).toMatch(/<dialog[\s\S]*<address>/);
  });
});

describe("gift card", () => {
  test("a gift card has the recipient form, off until its checkbox is checked", async () => {
    const html = await render("test-gift-card");
    expect(html).toMatch(
      /name="properties\[__shopify_send_gift_card_to_recipient\]"\s+value="true"/,
    );
    expect(html).toMatch(
      /<fieldset class="gift-card-recipient__fields"[^>]*\shidden\s+disabled/,
    );
    for (const field of [
      "Recipient email",
      "Recipient name",
      "Message",
      "Send on",
      "__shopify_offset",
    ]) {
      expect(html).toContain(`name="properties[${field}]"`);
    }
  });

  test("other products don't", async () => {
    expect(await render("test-regular")).not.toContain("gift-card-recipient");
  });
});
