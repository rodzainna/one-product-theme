import { afterEach, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";
import giftCardCss from "../../assets/gift-card.css?raw";
import iconButtonLiquid from "../../snippets/icon-button.liquid?raw";
import iconLiquid from "../../snippets/icon.liquid?raw";
import imageLiquid from "../../snippets/image.liquid?raw";

const stylesheet = (liquid) =>
  liquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )[1];
const imageCss = stylesheet(imageLiquid);
const iconCss = stylesheet(iconLiquid) + stylesheet(iconButtonLiquid);
const picture = (width, height) =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'/%3E`;
const logoMarkup = (width, height) => `<div class="gift-card__logo"
  style="--logo-max-width: 192px; --logo-max-height: 80px"><div class="image">
  <img alt="one-product-test" src="${picture(width, height)}" width="${width}" height="${height}"></div></div>`;

const tokens = `:root { --space-2xs: 4px; --space-s: 12px; --space-m: 16px; --space-xl: 48px; --page-margin: 20px;
  --color-background: #fff; --color-foreground: #000; --color-foreground-muted: #666; --color-qr-background: #fff;
  --text-small: 14px; --text-lg: 18px; --text-h1: 64px; --text-h4: 20px; --weight-ui: 500; --font-heading: serif;
  --control-h: 44px; --control-h-sm: 36px; --radius-full: 999px; --duration: 0.2s; --ease: ease; --color-hover: #eee; }
  body { margin: 0; }`;
const badge =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='60'/%3E";
const LONG = "Supercalifragilisticexpialidocious".repeat(3);
const decoded = () =>
  Promise.all([...document.images].map((image) => image.decode()));
const box = (selector) =>
  document.querySelector(selector).getBoundingClientRect();

const RAW = "RRGB8H89RR8GHJX9";
const render = ({
  message = "",
  wallet = true,
  logo = "",
  code = "RRGB 8H89 RR8G HJX9",
} = {}) => {
  document.body.innerHTML = `<style>${tokens} ${criticalCss} ${imageCss} ${iconCss} ${giftCardCss}</style>
    <main class="gift-card section-full"><div class="gift-card__card">
      ${logo || '<p class="gift-card__name">one-product-test</p>'}
      <h1 class="gift-card__balance">$100.00</h1>
      <p class="gift-card__notice">Expires on 1 Jan 2030</p>
      ${message ? `<figure class="gift-card__message"><figcaption>A message for you</figcaption><blockquote>${message}</blockquote></figure>` : ""}
      <p class="gift-card__hint">Use this gift card at checkout</p>
      <div class="gift-card__code-row">
        <p class="gift-card__code" data-code>${code}</p>
        <button class="icon-button" type="button" aria-label="Copy gift card code" data-copy="${RAW}">
          <svg class="icon" viewBox="0 0 24 24"><rect x="8" y="8" width="14" height="14" /></svg></button>
        <span class="gift-card__copy-status" role="status" data-copy-status data-copied="Copied"
          data-failed="Couldn't copy. The code is selected."></span>
      </div>
      <div class="gift-card__qr" data-qr="shopify-giftcard-v1-ABC"></div>
      ${wallet ? `<a class="gift-card__wallet" href="#"><img src="${badge}" alt="Add to Apple Wallet" width="180" height="60"></a>` : ""}
      <a class="button" href="#">Visit the shop</a>
    </div></main>`;
};

// A module only runs on its first import, so each load gets its own address.
let loads = 0;
const load = () =>
  import(/* @vite-ignore */ `../../assets/gift-card.js?run=${++loads}`);

afterEach(() => {
  document.body.innerHTML = "";
  delete globalThis.QRCode;
  vi.resetModules();
});

describe("gift card page", () => {
  test("is one centred card no wider than 28rem", async () => {
    await page.viewport(1366, 800);
    render();
    const card = box(".gift-card__card");
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(card.width).toBe(28 * rem);
    expect(Math.abs(card.left + card.width / 2 - 1366 / 2)).toBeLessThan(2);
  });

  test("fills the screen and centres the card up and down", async () => {
    await page.viewport(1366, 800);
    render();
    const main = box(".gift-card");
    const card = box(".gift-card__card");
    expect(main.height).toBeGreaterThanOrEqual(800);
    expect(
      Math.abs(card.top - main.top - (main.bottom - card.bottom)),
    ).toBeLessThan(2);
  });

  test.each([320, 390])(
    "has no sideways scroll at %ipx with a long code and message",
    async (width) => {
      await page.viewport(width, 700);
      render({ message: LONG, code: LONG });
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
    },
  );

  test("draws the QR code on a light square with room around it", async () => {
    await page.viewport(390, 700);
    render();
    document
      .querySelector(".gift-card__qr")
      .insertAdjacentHTML(
        "beforeend",
        '<canvas width="160" height="160"></canvas>',
      );
    const qr = box(".gift-card__qr");
    expect(box(".gift-card__qr canvas").height).toBe(160);
    expect(qr.height).toBe(160 + 2 * 16);
    expect(
      getComputedStyle(document.querySelector(".gift-card__qr"))
        .backgroundColor,
    ).toBe("rgb(255, 255, 255)");
  });

  test("scales a wide logo down to the QR box width and keeps its shape", async () => {
    await page.viewport(1366, 800);
    render({ logo: logoMarkup(960, 160) });
    await decoded();
    const logo = box(".gift-card__logo img");
    expect(logo.width).toBe(192);
    expect(logo.width).toBeLessThanOrEqual(160 + 2 * 16);
    expect(logo.height).toBeCloseTo(32, 0);
  });

  test("scales a tall logo down to the max height and keeps its shape", async () => {
    await page.viewport(1366, 800);
    render({ logo: logoMarkup(160, 960) });
    await decoded();
    const logo = box(".gift-card__logo img");
    expect(logo.height).toBeCloseTo(80, 0);
    expect(logo.width).toBeCloseTo(80 / 6, 0);
  });

  test("does not stretch a logo smaller than its limits", async () => {
    await page.viewport(1366, 800);
    render({ logo: logoMarkup(60, 20) });
    await decoded();
    expect(box(".gift-card__logo img").width).toBe(60);
  });

  test("keeps the logo inside a phone screen", async () => {
    await page.viewport(200, 700);
    render({ logo: logoMarkup(960, 160) });
    await decoded();
    expect(box(".gift-card__logo img").width).toBeLessThanOrEqual(200 - 2 * 20);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(200);
  });

  test("hides the QR box until the script has drawn something", async () => {
    await page.viewport(390, 700);
    render();
    expect(
      getComputedStyle(document.querySelector(".gift-card__qr")).display,
    ).toBe("none");
  });

  test("stacks the Apple Wallet badge without a gap from the line box", async () => {
    await page.viewport(390, 700);
    render();
    expect(box(".gift-card__wallet img").height).toBe(60);
    expect(box(".gift-card__wallet").height).toBe(60);
  });
});

describe("gift card copy button", () => {
  test("keeps the code centred with the button beside it, not under it", async () => {
    await page.viewport(1366, 800);
    render();
    const code = box(".gift-card__code");
    const button = box("[data-copy]");
    expect(Math.abs(code.left + code.width / 2 - 1366 / 2)).toBeLessThan(2);
    expect(button.left).toBeGreaterThanOrEqual(code.right);
    expect(
      Math.abs(button.top + button.height / 2 - (code.top + code.height / 2)),
    ).toBeLessThan(2);
    expect(button.width).toBe(44);
  });

  test.each([320, 390])("keeps the button on screen at %ipx", async (width) => {
    await page.viewport(width, 700);
    render({ code: LONG });
    expect(box("[data-copy]").right).toBeLessThanOrEqual(width);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
  });

  test("keeps the real code on one line at 320px by shrinking the spacer first", async () => {
    await page.viewport(320, 700);
    render();
    const code = box(".gift-card__code");
    const size = parseFloat(
      getComputedStyle(document.querySelector(".gift-card__code")).fontSize,
    );
    expect(code.height).toBeLessThan(size * 2);
    expect(box("[data-copy]").right).toBeLessThanOrEqual(320);
  });

  test("puts the Copied message under the code without moving the layout", async () => {
    await page.viewport(1366, 800);
    render();
    const before = box(".gift-card__qr").top;
    const status = document.querySelector("[data-copy-status]");
    status.textContent = "Copied";
    expect(box(".gift-card__qr").top).toBe(before);
    expect(box("[data-copy-status]").top).toBeGreaterThanOrEqual(
      box(".gift-card__code-row").bottom - 1,
    );
  });
});

describe("gift card script: copying", () => {
  const stubClipboard = (writeText) =>
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  const status = () => document.querySelector("[data-copy-status]").textContent;

  test("copies the code without spaces and says so, then clears the message", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      render();
      const writeText = vi.fn().mockResolvedValue();
      stubClipboard(writeText);
      await load();
      document.querySelector("[data-copy]").click();
      await vi.advanceTimersByTimeAsync(0);
      expect(writeText).toHaveBeenCalledWith(RAW);
      expect(status()).toBe("Copied");
      await vi.advanceTimersByTimeAsync(3000);
      expect(status()).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });

  test("selects the code and says so when the browser refuses", async () => {
    render();
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    await load();
    document.querySelector("[data-copy]").click();
    await expect.poll(status).toBe("Couldn't copy. The code is selected.");
    expect(getSelection().toString()).toContain("RRGB 8H89 RR8G HJX9");
  });
});

describe("gift card script", () => {
  test("draws each QR code at least 120px wide from the identifier", async () => {
    render();
    const calls = [];
    globalThis.QRCode = class {
      constructor(element, options) {
        calls.push({ element, options });
      }
    };
    await load();
    expect(calls).toHaveLength(1);
    expect(calls[0].element).toBe(document.querySelector("[data-qr]"));
    expect(calls[0].options.text).toBe("shopify-giftcard-v1-ABC");
    expect(calls[0].options.width).toBeGreaterThanOrEqual(120);
    expect(calls[0].options.width).toBe(160);
    expect(calls[0].options.height).toBe(calls[0].options.width);
  });

  test("does nothing, and throws nothing, when the library did not load", async () => {
    render();
    await expect(load()).resolves.toBeDefined();
    expect(document.querySelector("[data-qr]").childElementCount).toBe(0);
  });
});
