import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { CLOSE_DELAY, GAP } from "../../assets/tooltip.js";
import tooltipLiquid from "../../snippets/tooltip.liquid?raw";

const stylesheet =
  tooltipLiquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

const render = ({
  left = "50%",
  top = "50%",
  text = "Tax included. Shipping calculated at checkout.",
} = {}) => {
  document.body.innerHTML = `
    <style>
      :root { --target-min: 24px; --radius-full: 999px; --radius-sm: 6px;
        --control-pad-xs: 0.5rem; --control-pad-s: 0.75rem; --control-pad-m: 1rem;
        --color-foreground: #222; --color-background: #fff; --color-foreground-muted: #555;
        --color-hover: #eee; --text-caption: 13px; --weight-body: 400; --duration: 0s; --ease: ease; }
      body { margin: 0; }
      ${stylesheet}
      .host { position: fixed; left: ${left}; top: ${top}; }
    </style>
    <p class="host">Price
      <tool-tip class="tooltip">
        <button class="tooltip__button" type="button" aria-label="Tax and shipping"
          aria-describedby="tip" popovertarget="tip">i</button>
        <span class="tooltip__bubble" popover id="tip">${text}</span>
      </tool-tip>
    </p>
    <button type="button" id="elsewhere">Elsewhere</button>
  `;
};

const button = () => page.getByRole("button", { name: "Tax and shipping" });
const bubble = () => document.getElementById("tip");
const isOpen = () => bubble().matches(":popover-open");
const rect = (element) => element.getBoundingClientRect();
// A pointer crossing the tooltip's edge, dispatched in one tick. Playwright's own moves take a
// variable time, which made the tests that race the close delay fail on a busy machine.
const pointer = (type) =>
  document
    .querySelector("tool-tip")
    .dispatchEvent(new PointerEvent(type, { pointerType: "mouse" }));

beforeEach(async () => {
  await import("../../assets/tooltip.js");
  await page.viewport(800, 600);
});

afterEach(async () => {
  await userEvent.unhover(document.body);
  document.body.innerHTML = "";
});

describe("accessibility", () => {
  test("the button is named, described by the bubble text and 24px square", async () => {
    render();
    await expect.element(button()).toHaveAccessibleName("Tax and shipping");
    await expect
      .element(button())
      .toHaveAccessibleDescription(
        "Tax included. Shipping calculated at checkout.",
      );
    const box = rect(button().element());
    expect([box.width, box.height]).toEqual([24, 24]);
  });
});

describe("opening and closing", () => {
  test("a click opens it and a second click closes it (tap and Enter use the same path)", async () => {
    render();
    button().element().click();
    expect(isOpen()).toBe(true);
    button().element().click();
    expect(isOpen()).toBe(false);
  });

  test("Esc closes it and keeps focus on the button", async () => {
    render();
    button().element().focus();
    await userEvent.keyboard("{Enter}");
    expect(isOpen()).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(button().element());
  });

  test("clicking elsewhere closes it", async () => {
    render();
    button().element().click();
    await userEvent.click(page.getByRole("button", { name: "Elsewhere" }));
    expect(isOpen()).toBe(false);
  });

  test("mouse hover opens it, and leaving closes it after the delay", async () => {
    render();
    await userEvent.hover(button());
    expect(isOpen()).toBe(true);
    pointer("pointerleave");
    expect(isOpen()).toBe(true);
    await wait(CLOSE_DELAY + 100);
    expect(isOpen()).toBe(false);
  });

  test("the pointer can cross the gap onto the bubble without closing it (WCAG 1.4.13)", async () => {
    render();
    await userEvent.hover(button());
    await frame();
    // Leave the tooltip, as a pointer crossing the gap does, and reach the bubble in time.
    pointer("pointerleave");
    pointer("pointerenter");
    await wait(CLOSE_DELAY + 100);
    expect(isOpen()).toBe(true);
  });

  test("a hover-close timer doesn't close a bubble reopened by click", async () => {
    render();
    await userEvent.hover(button());
    pointer("pointerleave");
    await userEvent.keyboard("{Escape}");
    expect(isOpen()).toBe(false);
    button().element().click();
    await wait(CLOSE_DELAY + 100);
    expect(isOpen()).toBe(true);
  });

  test("a click pins a hover-opened bubble, and the next click closes it", async () => {
    render();
    await userEvent.hover(button());
    await userEvent.click(button());
    expect(isOpen()).toBe(true);
    await userEvent.hover(page.getByRole("button", { name: "Elsewhere" }));
    await wait(CLOSE_DELAY + 100);
    expect(isOpen()).toBe(true);
    await userEvent.click(button());
    expect(isOpen()).toBe(false);
  });
});

describe("placement", () => {
  test("centred above the button when there's room", async () => {
    render();
    button().element().click();
    await frame();
    const b = rect(button().element());
    const r = rect(bubble());
    expect(
      Math.abs(r.left + r.width / 2 - (b.left + b.width / 2)),
    ).toBeLessThan(1);
    expect(Math.round(b.top - r.bottom)).toBe(GAP);
    expect(bubble().style.visibility).toBe("");
  });

  test("the stylesheet leaves placement to the browser until the script runs", () => {
    expect(stylesheet).not.toMatch(/inset:\s*auto/);
    expect(stylesheet).not.toMatch(/margin:\s*0/);
  });

  test("below the button when there's no room above", async () => {
    render({ top: "2px" });
    button().element().click();
    await frame();
    expect(
      Math.round(rect(bubble()).top - rect(button().element()).bottom),
    ).toBe(GAP);
  });

  test.each([
    ["left", "0px"],
    ["right", "calc(100% - 40px)"],
  ])("kept 8px inside the %s edge", async (_, left) => {
    render({
      left,
      text: "A longer note that is wide enough to reach past the edge of the screen.",
    });
    button().element().click();
    await frame();
    const r = rect(bubble());
    expect(r.left).toBeGreaterThanOrEqual(GAP - 0.5);
    expect(r.right).toBeLessThanOrEqual(
      document.documentElement.clientWidth - GAP + 0.5,
    );
  });

  test("follows the button when the page scrolls", async () => {
    render();
    document.querySelector(".host").style.position = "absolute";
    document.body.style.height = "3000px";
    button().element().click();
    await frame();
    scrollBy(0, 100);
    await frame();
    await frame();
    expect(
      Math.round(rect(button().element()).top - rect(bubble()).bottom),
    ).toBe(GAP);
    scrollTo(0, 0);
  });
});
