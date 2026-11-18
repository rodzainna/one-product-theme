import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import aboutLiquid from "../../blocks/_footer-about.liquid?raw";
import menuLiquid from "../../blocks/_footer-menu.liquid?raw";
import newsletterLiquid from "../../blocks/_newsletter.liquid?raw";
import criticalCss from "../../assets/critical.css?raw";
import footerLiquid from "../../sections/footer.liquid?raw";
import buttonLiquid from "../../snippets/button.liquid?raw";
import inputLiquid from "../../snippets/input.liquid?raw";
import socialLiquid from "../../snippets/social-icon.liquid?raw";

const styles = (liquid) =>
  liquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

// What the footer renders with an about block, a link list, selectors, payment icons and policies.
const render = ({ name = "Kalayo Coffee" } = {}) => {
  document.body.innerHTML = `
    <style>
      :root { --space-2xs: 4px; --space-xs: 8px; --space-s: 12px; --space-m: 16px; --space-l: 32px; --space-xl: 48px;
        --content-width: min(1200px, calc(100% - 40px)); --control-h: 44px; --target-min: 24px; --radius-input: 8px;
        --text-caption: 13px; --text-small: 14px; --text-lg: 18px; --text-h4: 22px; --leading-heading: 1.15;
        --color-border: #444; --color-foreground: #fff; --color-foreground-muted: #bbb; --color-hover: rgb(255 255 255 / 0.1);
        --control-pad-y: 4px; --control-pad-xs: 8px; --control-pad-s: 12px; --control-h-sm: 32px; --field-gap: 8px; --radius-button: 999px;
        --color-button: #e07a3f; --color-button-text: #1c130e; --color-background: #1c130e; --font-body: sans-serif; --weight-body: 400; --weight-ui: 600;
        --text-body: 16px; --leading-tight: 1.25; --leading-normal: 1.5; --duration: 0.2s; --ease: ease; --color-control-border: #888; --color-error: #f88; --radius-input: 8px; }
      body { margin: 0; }
      ${styles(footerLiquid)}
      ${styles(aboutLiquid)}
      ${styles(menuLiquid)}
      ${styles(newsletterLiquid)}
      ${criticalCss}
      ${styles(inputLiquid)}
      ${styles(buttonLiquid)}
      ${styles(socialLiquid)}
    </style>
    <footer class="footer">
      <div class="footer__inner">
        <div class="footer__blocks">
          <div class="shopify-block"><div class="footer-about">
            <a class="footer-about__name" href="/">${name}</a>
            <p class="footer-about__text">Roasts one coffee, and roasts it well.</p>
            <ul class="footer-about__social">
              <li><a class="footer-about__social-link" href="#" aria-label="Instagram"><svg class="social-icon" viewBox="0 0 24 24"></svg></a></li>
              <li><a class="footer-about__social-link" href="#" aria-label="Facebook"><svg class="social-icon" viewBox="0 0 24 24"></svg></a></li>
            </ul>
          </div></div>
          <div class="shopify-block"><nav class="footer-menu">
            <h2 class="footer-menu__heading">Shop</h2>
            <ul class="footer-menu__list">
              <li><a class="footer-menu__link" href="#">Our story</a></li>
              <li><a class="footer-menu__link" href="#">Contact</a></li>
            </ul>
          </nav></div>
          <div class="shopify-block"><div class="newsletter">
            <h2 class="newsletter__heading">Subscribe</h2>
            <form class="newsletter__form"><div class="newsletter__row">
              <div class="field"><label class="field__label visually-hidden" for="email">Email</label><input class="control input" id="email" type="email"></div>
              <button class="button" type="submit">Subscribe</button>
            </div></form>
          </div></div>
          <div class="shopify-block" id="empty">
          </div>
        </div>
        <div class="footer__bottom">
          <div class="footer__row" id="row-one">
            <div class="localization"><select><option>Australia (AUD $)</option></select></div>
            <ul class="footer__payment"><li><svg viewBox="0 0 38 24" width="38" height="24"></svg></li><li><svg viewBox="0 0 38 24" width="38" height="24"></svg></li></ul>
          </div>
          <div class="footer__row" id="row-two">
            <p class="footer__copyright">&copy; 2026 ${name}</p>
            <ul class="footer__policies">
              <li><a class="footer__policy" href="#">Privacy policy</a></li>
              <li><a class="footer__policy" href="#">Terms of service</a></li>
              <li><a class="footer__policy" href="#">Refund policy</a></li>
            </ul>
          </div>
          <p class="footer__disclaimer">A demo notice.</p>
        </div>
      </div>
    </footer>`;
};

const box = (selector) =>
  document.querySelector(selector).getBoundingClientRect();

beforeEach(() => render());

afterEach(() => {
  document.body.innerHTML = "";
});

describe("columns", () => {
  test("blocks sit side by side on a wide screen", async () => {
    await page.viewport(1366, 800);
    expect(box(".footer-menu").left).toBeGreaterThan(
      box(".footer-about").right,
    );
    expect(
      Math.abs(box(".footer-menu").top - box(".footer-about").top),
    ).toBeLessThan(2);
  });

  test("and stack on a phone", async () => {
    await page.viewport(390, 800);
    expect(box(".footer-menu").top).toBeGreaterThanOrEqual(
      box(".footer-about").bottom,
    );
    expect(box(".footer-menu").left).toBe(box(".footer-about").left);
  });
});

describe("newsletter", () => {
  test("gets the widest column, with its field and button on one row", async () => {
    await page.viewport(1366, 800);
    const widths = [".footer-about", ".footer-menu", ".newsletter"].map(
      (selector) => box(selector).width,
    );
    expect(widths[2]).toBeGreaterThan(widths[0]);
    expect(widths[2]).toBeGreaterThan(widths[1]);
    expect(
      Math.abs(
        box(".newsletter .control").top - box(".newsletter .button").top,
      ),
    ).toBeLessThan(2);
  });

  test("keeps the field and button on one row on a phone", async () => {
    await page.viewport(390, 800);
    expect(box(".newsletter .button").right).toBeLessThanOrEqual(390);
    expect(
      Math.abs(
        box(".newsletter .control").top - box(".newsletter .button").top,
      ),
    ).toBeLessThan(2);
  });

  test("a block that prints nothing takes no column", async () => {
    await page.viewport(1366, 800);
    expect(getComputedStyle(document.getElementById("empty")).display).toBe(
      "none",
    );
    expect(box(".footer-about").width).toBeCloseTo(
      box(".footer-menu").width,
      0,
    );
  });
});

describe("bottom rows", () => {
  test("a wide screen puts the selectors and payment icons on one line, and the copyright and policies on the next", async () => {
    await page.viewport(1366, 800);
    const one = box("#row-one");
    const two = box("#row-two");
    expect(box(".localization").left).toBeLessThan(
      box(".footer__payment").left,
    );
    expect(
      Math.abs(box(".localization").top - box(".footer__payment").top),
    ).toBeLessThan(one.height);
    expect(two.top).toBeGreaterThanOrEqual(one.bottom);
    expect(box(".footer__policies").right).toBeCloseTo(
      box(".footer__inner").right,
      0,
    );
  });

  test("a phone stacks each row", async () => {
    await page.viewport(390, 800);
    expect(box(".footer__payment").top).toBeGreaterThanOrEqual(
      box(".localization").bottom,
    );
    expect(box(".footer__policies").top).toBeGreaterThanOrEqual(
      box(".footer__copyright").bottom,
    );
  });

  test("a wide screen separates policy links with a dot, and none comes before the first", async () => {
    await page.viewport(1366, 800);
    const before = (selector) =>
      getComputedStyle(document.querySelector(selector), "::before").content;
    expect(before(".footer__policies li:nth-child(2)")).toContain("·");
    expect(before(".footer__policies li:first-child")).not.toContain("·");
  });

  test("policy links are spaced apart on a phone, and by the dots alone on a wide screen", async () => {
    const gap = () =>
      getComputedStyle(document.querySelector(".footer__policies")).columnGap;
    await page.viewport(390, 800);
    expect(gap()).toBe("16px");
    await page.viewport(1366, 800);
    expect(gap()).toBe("0px");
  });

  test("a phone wraps policies in a row with no dots, so a wrapped line never starts with one", async () => {
    await page.viewport(390, 800);
    const tops = [...document.querySelectorAll(".footer__policy")].map(
      (link) => link.getBoundingClientRect().top,
    );
    expect(new Set(tops).size).toBeLessThan(tops.length);
    expect(
      getComputedStyle(
        document.querySelector(".footer__policies li:nth-child(2)"),
        "::before",
      ).content,
    ).not.toContain("·");
  });

  test("blocks that print nothing leave no gap or line above the bottom rows", async () => {
    await page.viewport(1366, 800);
    const blocks = document.querySelector(".footer__blocks");
    blocks.replaceChildren(
      Object.assign(document.createElement("div"), {
        className: "shopify-block",
      }),
    );
    const bottom = document.querySelector(".footer__bottom");
    expect(getComputedStyle(blocks).display).toBe("none");
    expect(getComputedStyle(bottom).borderTopWidth).toBe("0px");
    expect(getComputedStyle(bottom).marginTop).toBe("0px");
  });
});

describe("touch targets", () => {
  test("social icons are 20px with 4px around them, so each link is 28px square, 10px apart", () => {
    const [first, second] = [
      ...document.querySelectorAll(".footer-about__social-link"),
    ].map((link) => link.getBoundingClientRect());
    const icon = box(".footer-about__social-link .social-icon");
    expect([icon.width, icon.height]).toEqual([20, 20]);
    expect([first.width, first.height]).toEqual([28, 28]);
    expect(second.left - first.right).toBe(10);
  });

  test("footer and policy links are at least 24px tall", () => {
    for (const selector of [".footer-menu__link", ".footer__policy"]) {
      expect(box(selector).height).toBeGreaterThanOrEqual(24);
    }
  });
});

describe("long words", () => {
  test.each([320, 390])(
    "a very long store name doesn't widen the page at %ipx",
    async (width) => {
      await page.viewport(width, 800);
      const word = "Supercalifragilisticexpialidocious".repeat(3);
      render({ name: word });
      for (const heading of [".footer-menu__heading", ".newsletter__heading"]) {
        document.querySelector(heading).textContent = word;
      }
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
    },
  );
});
