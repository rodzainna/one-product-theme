import { afterEach, beforeEach, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";

// The page's focus tokens: buttons and links get the full ring, fields a slimmer one flush to the border.
const render = () => {
  document.body.innerHTML = `
    <style>
      :root { --focus-ring: 3px solid #a8410f; --focus-offset: 2px; --focus-ring-field: 2px solid #a8410f; --focus-offset-field: 0px;
        --control-h: 44px; --color-control-border: #888; --radius-input: 8px;
        --color-background: #fff; --color-foreground: #000; --text-body: 16px; --leading-tight: 1.25; }
      ${criticalCss}
    </style>
    <input class="control" id="text" type="text" aria-label="Name">
    <textarea class="control" id="area" aria-label="Note"></textarea>
    <select class="control" id="select" aria-label="Country"><option>AU</option></select>
    <button id="button" type="button">Buy</button>
    <a id="link" href="#">Link</a>`;
};

const ring = (selector) => {
  const style = getComputedStyle(document.querySelector(selector));
  return [style.outlineWidth, style.outlineStyle, style.outlineOffset];
};

// A key press before focus() gives keyboard focus in every engine; WebKit doesn't Tab to links by default.
const focusByKeyboard = async (selector) => {
  await userEvent.keyboard("{Tab}");
  document.querySelector(selector).focus();
  expect(document.activeElement).toBe(document.querySelector(selector));
};

beforeEach(async () => {
  await page.viewport(800, 600);
  render();
});

afterEach(() => {
  document.body.innerHTML = "";
});

test.each(["#text", "#area", "#select"])(
  "%s shows a 2px ring flush against its border",
  async (selector) => {
    await focusByKeyboard(selector);
    expect(ring(selector)).toEqual(["2px", "solid", "0px"]);
  },
);

test("buttons and links keep the full 3px ring with its 2px gap", async () => {
  for (const selector of ["#button", "#link"]) {
    await focusByKeyboard(selector);
    expect(ring(selector)).toEqual(["3px", "solid", "2px"]);
  }
});
