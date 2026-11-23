import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const template = readFileSync("templates/gift_card.liquid", "utf8");
const body = template.slice(template.indexOf("<body>"));

describe("gift card template", () => {
  test("is a standalone page with a language and the platform scripts", () => {
    expect(template).toContain("{% layout none %}");
    expect(template).toContain('lang="{{ request.locale.iso_code }}"');
    expect(template).toContain("{{ content_for_header }}");
  });

  test("shows the logo or the shop name, the code, the balance and a way back", () => {
    expect(body).toContain("settings.gift_card_logo");
    expect(body).toContain(
      "--logo-max-width: {{ settings.gift_card_logo_max_width }}px",
    );
    expect(body).toContain(
      "--logo-max-height: {{ settings.gift_card_logo_max_height }}px",
    );
    expect(body).toContain("alt: shop.name");
    expect(body).toContain("{{ shop.name | escape }}");
    expect(body).toContain("gift_card.code | format_code");
    expect(body).toContain("gift_card.balance | money");
    expect(body).toContain("routes.root_url");
  });

  test("draws the QR code from the identifier with Shopify's library", () => {
    expect(template).toContain("'vendor/qrcode.js' | shopify_asset_url");
    expect(body).toContain('data-qr="{{ gift_card.qr_identifier | escape }}"');
  });

  test("offers Apple Wallet only when there is a pass", () => {
    expect(body).toContain("{%- if gift_card.pass_url -%}");
    expect(body).toContain("add-to-apple-wallet.svg");
  });

  test("puts the amount in the top part and the code, QR code and way back in the bottom part", () => {
    const top = body.indexOf('class="gift-card__top"');
    const bottom = body.indexOf('class="gift-card__bottom"');
    const at = (text) => body.indexOf(text);
    expect(top).toBeGreaterThan(-1);
    expect(bottom).toBeGreaterThan(top);
    for (const text of [
      "gift_card.balance | money",
      "gift_card.expires_on_html",
    ]) {
      expect(at(text), text).toBeGreaterThan(top);
      expect(at(text), text).toBeLessThan(bottom);
    }
    for (const text of [
      "gift_card.code | format_code",
      "data-qr=",
      "routes.root_url",
    ]) {
      expect(at(text), text).toBeGreaterThan(bottom);
    }
  });

  test("labels the page as a gift card above the amount", () => {
    expect(body).toContain("'gift_card.title' | t");
    expect(body.indexOf("gift_card.title")).toBeLessThan(
      body.indexOf("gift-card__balance"),
    );
  });

  test("keeps the QR code, the wallet link and the scripts for an unusable card", () => {
    expect(body).not.toMatch(/is_usable -%}\s*<div\s+class="gift-card__qr"/);
    expect(body).not.toMatch(/is_usable -%}\s*{%- if gift_card.pass_url/);
    expect(template).not.toMatch(/{% if is_usable %}\s*<script/);
  });

  test("names an expired card and a disabled card differently", () => {
    expect(body).toContain("{%- if gift_card.expired -%}");
    expect(body).toContain("{%- elsif gift_card.enabled == false -%}");
    expect(body).toContain("'gift_card.disabled' | t");
  });

  test("passes the expiry date's markup through a translation key ending in _html", () => {
    expect(body).toContain("time_tag: format: 'date'");
    expect(body).toContain("'gift_card.expires_on_html' | t");
  });

  test("hides the checkout hint for an unusable card", () => {
    expect(body).toMatch(/{%- if is_usable -%}\s*<p class="gift-card__hint">/);
  });

  test("escapes the sender's message and keeps its line breaks", () => {
    expect(body).toContain("gift_card.message | escape | newline_to_br");
  });

  test("uses every class its stylesheet styles", () => {
    const css = readFileSync("assets/gift-card.css", "utf8");
    const classes = new Set(css.match(/\.gift-card[\w-]*/g));
    for (const name of classes) {
      expect(body, name).toContain(name.slice(1));
    }
  });

  test("puts a copy button next to the code that holds the code without spaces", () => {
    expect(body).toContain("icon: 'copy'");
    expect(body).toContain('data-copy="{{ gift_card.code | escape }}"');
    expect(body).toMatch(/role="status"\s+data-copy-status/);
    expect(body).toContain("'gift_card.copied' | t");
    expect(body).toContain("'gift_card.copy_failed' | t");
  });
});
