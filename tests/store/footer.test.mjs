import { beforeAll, describe, expect, test } from "vitest";
import { get } from "./store.mjs";

let home;
beforeAll(async () => {
  home = await get("/");
});

const footer = (html) =>
  html.slice(html.indexOf('<footer class="footer'), html.indexOf("</footer>"));

describe("footer", () => {
  test("is a full-width footer in the dark colour scheme", () => {
    expect(footer(home)).toMatch(
      /<footer class="footer full-width color-scheme-3">/,
    );
  });

  test("names the link column by its heading", () => {
    const html = footer(home);
    const id = html.match(/aria-labelledby="([^"]+-heading)"/)?.[1];
    expect(id).toBeDefined();
    expect(html).toMatch(
      new RegExp(`<h2 class="footer-menu__heading" id="${id}">Shop</h2>`),
    );
  });

  test("shows the store name as the link to the home page, with the copyright below", () => {
    const html = footer(home);
    expect(html).toMatch(
      /<a class="footer-about__name" href="\/">\s*[^<]+\s*<\/a>/,
    );
    expect(html).toMatch(
      /<p class="footer__copyright">\s*&copy;\s*\d{4}\s+[^<]+<\/p>/,
    );
  });

  test("lists the store's policies, each linking to its page", () => {
    const list = footer(home).match(
      /<ul class="footer__policies" aria-label="Policies">([\s\S]*?)<\/ul>/,
    )?.[1];
    expect(list).toBeDefined();
    expect(list).toMatch(/<a class="footer__policy" href="\/policies\/[^"]+">/);
  });

  test("lists the usual policies in a fixed order: privacy, terms, refund, shipping", () => {
    const hrefs = [
      ...footer(home).matchAll(
        /<a class="footer__policy" href="\/policies\/([^"]+)">/g,
      ),
    ].map((match) => match[1]);
    const usual = [
      "privacy-policy",
      "terms-of-service",
      "refund-policy",
      "shipping-policy",
    ].filter((handle) => hrefs.includes(handle));
    expect(hrefs.filter((handle) => usual.includes(handle))).toEqual(usual);
    expect(usual.length, "fill in the test store's policies").toBeGreaterThan(
      1,
    );
  });

  test("shows a short description under the store name", () => {
    expect(footer(home)).toMatch(
      /<a class="footer-about__name"[^>]*>[\s\S]*?<\/a>\s*<p class="footer-about__text">[^<]+<\/p>/,
    );
  });

  test("puts the selectors in the brand column, after the social icons", () => {
    const html = footer(home);
    const about = html.slice(
      html.indexOf('<div class="footer-about"'),
      html.indexOf('<nav class="footer-menu"'),
    );
    expect(about).toMatch(/id="Footer-[^"]+-country-form"/);
    expect(about).toMatch(/id="Footer-[^"]+-language-form"/);
    expect(about.indexOf("footer-about__social")).toBeLessThan(
      about.indexOf("-country-form"),
    );
  });

  test("shows the country and language as short codes, with a globe before the country", () => {
    const html = footer(home);
    expect(html).toMatch(/<form[^>]*id="Footer-[^"]+-country-form"/);
    expect(html).toMatch(
      /<svg\s+class="icon icon--sm"[\s\S]*?<circle cx="12" cy="12" r="10"/,
    );
    expect(html).toMatch(
      /<option[^>]*value="AU"[^>]*aria-label="Australia \(AUD\)"[^>]*>\s*AU · AUD\s*<\/option>/,
    );
    expect(html).toMatch(/<form[^>]*id="Footer-[^"]+-language-form"/);
    expect(html).toMatch(
      /<option[^>]*lang="fr"[^>]*aria-label="Français"[^>]*>\s*FR\s*<\/option>/,
    );
    expect(html).not.toMatch(/Australia \(AUD \$\)/);
  });

  test("labels the selectors for screen readers", () => {
    const html = footer(home);
    expect(html).toMatch(/for="Footer-[^"]+-country">Country or region</);
    expect(html).toMatch(/for="Footer-[^"]+-language">Language</);
  });

  test("gives its fields ids that don't clash with the header's", () => {
    const ids = home.match(/\sid="[^"]+"/g);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("social links are named by network and show an icon (skipped while the store has none set)", ({
    skip,
  }) => {
    const list = footer(home).match(
      /<ul class="footer-about__social" aria-label="Social media">([\s\S]*?)<\/ul>/,
    )?.[1];
    if (!list) skip();
    for (const link of list.match(/<a\s[^>]*>[\s\S]*?<\/a>/g)) {
      expect(link).toMatch(
        /aria-label="(Instagram|Facebook|TikTok|YouTube|Pinterest|X)"/,
      );
      expect(link).toMatch(/<svg class="social-icon"[^>]*aria-hidden="true"/);
    }
  });

  test("has an email sign-up posting to the customer form, tagged as a newsletter", () => {
    const form = footer(home).match(
      /<form[^>]*class="newsletter__form"[\s\S]*?<\/form>/,
    )?.[0];
    expect(form).toBeDefined();
    expect(form).toMatch(/method="post"/);
    expect(form).toMatch(/name="form_type"[^>]*value="customer"/);
    expect(form).toMatch(/name="contact\[tags\]"[^>]*value="newsletter"/);
    expect(form).toMatch(
      /<input[^>]*type="email"[^>]*name="contact\[email\]"[^>]*autocomplete="email"[^>]*required/,
    );
    expect(form).toMatch(/class="field__label visually-hidden"[^>]*>Email</);
    expect(form).toMatch(
      /<button\s+class="button"\s+type="submit"\s*>\s*Subscribe\s*<\/button>/,
    );
  });

  test("names the sign-up form after its heading", () => {
    expect(footer(home)).toMatch(
      /<form[^>]*class="newsletter__form"[^>]*aria-label="Subscribe to our emails"/,
    );
  });

  test("wraps every footer block in the element the layout rules rely on", () => {
    const blocks = footer(home).match(
      /<div class="footer__blocks">([\s\S]*?)<div class="footer__bottom">/,
    )?.[1];
    expect(
      blocks.match(/<div id="shopify-block-[^"]+" class="shopify-block">/g),
    ).toHaveLength(3);
  });

  test("names the sign-up with a heading", () => {
    expect(footer(home)).toMatch(
      /<h2 class="newsletter__heading">Subscribe to our emails<\/h2>/,
    );
  });

  test("prints no Follow on Shop button while the store hasn't turned it on", () => {
    expect(footer(home)).not.toMatch(/follow-on-shop/);
  });
});
