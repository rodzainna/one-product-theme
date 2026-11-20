import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";

const render = () => {
  document.body.innerHTML = `<style>
      :root { --color-border: #444; --color-background: #fff; --radius-card: 12px;
        --focus-ring: 3px solid #00f; --focus-offset: 2px; }
      body { margin: 0; padding: 40px; }
      ${criticalCss}
    </style>
    <button id="before" type="button">Before</button>
    <article class="linked-card" style="width: 280px; height: 200px">
      <h2><a class="linked-card__link" href="#card">A card</a></h2>
    </article>`;
};

const card = () => document.querySelector(".linked-card");
const link = () => document.querySelector(".linked-card__link");

afterEach(() => {
  document.body.innerHTML = "";
});

describe("a linked card", () => {
  test("has a border, rounded corners and clips what overflows it", async () => {
    await page.viewport(800, 600);
    render();
    const style = getComputedStyle(card());
    expect(style.borderTopWidth).toBe("1px");
    expect(style.borderTopLeftRadius).toBe("12px");
    expect(style.overflow).toBe("hidden");
  });

  test("shares its box with the plain card, which has no link", async () => {
    await page.viewport(800, 600);
    render();
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div class="card">Plain</div>',
    );
    const linked = getComputedStyle(card());
    const plain = getComputedStyle(document.querySelector(".card"));
    for (const property of [
      "borderTopWidth",
      "borderTopLeftRadius",
      "overflow",
    ]) {
      expect(plain[property]).toBe(linked[property]);
    }
  });

  test("is one link: pressing anywhere on the card hits it", async () => {
    await page.viewport(800, 600);
    render();
    const { left, top, width, height } = card().getBoundingClientRect();
    const hit = document.elementFromPoint(left + width - 8, top + height - 8);
    expect(hit.closest("a")).toBe(link());
  });

  test("shows the focus ring on the card, not on the link, for keyboard focus", async () => {
    await page.viewport(800, 600);
    render();
    document.getElementById("before").focus();
    await userEvent.tab();
    // Safari's Tab skips links unless Option is held, so focus it as the keyboard would.
    if (document.activeElement !== link()) link().focus();
    expect(document.activeElement).toBe(link());
    expect(getComputedStyle(link()).outlineStyle).toBe("none");
    const ring = getComputedStyle(card());
    expect(ring.outlineStyle).toBe("solid");
    expect(ring.outlineWidth).toBe("3px");
    expect(ring.outlineOffset).toBe("2px");
  });

  test("shows no ring on the card until it's focused", async () => {
    await page.viewport(800, 600);
    render();
    expect(getComputedStyle(card()).outlineStyle).toBe("none");
  });

  test("underlines its title when the pointer is over any part of the card", async () => {
    await page.viewport(800, 600);
    render();
    expect(getComputedStyle(link()).textDecorationLine).toBe("none");
    await userEvent.hover(card());
    expect(getComputedStyle(link()).textDecorationLine).toBe("underline");
  });
});
