import { afterEach, beforeEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";

const render = (sections) => {
  document.documentElement.className = "snap";
  document.documentElement.style.setProperty("--header-group-h", "80px");
  document.body.innerHTML = `<style>${criticalCss}</style><main>${sections
    .map(
      ({ full = true, empty = false }) =>
        `<div class="shopify-section"><div class="${full ? "section-full" : ""}" ${empty ? "data-empty" : ""}>${empty ? "" : "x"}</div></div>`,
    )
    .join("")}</main>`;
};

const sections = () => [
  ...document.querySelectorAll("main > .shopify-section"),
];
const minHeight = (section) =>
  parseFloat(getComputedStyle(section.firstElementChild).minHeight);
const snap = (section) => getComputedStyle(section).scrollSnapAlign;

beforeEach(async () => {
  await page.viewport(1366, 800);
});

afterEach(() => {
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  document.body.innerHTML = "";
});

test("the first full-screen section shares the first screen with the header", () => {
  render([{}, {}]);
  expect(sections().map(minHeight)).toEqual([720, 800]);
});

test("a sticky header leaves every later section the screen below it", () => {
  render([{}, {}]);
  document.documentElement.className = "snap header-sticky";
  document.documentElement.style.setProperty("--header-group-h", "120px");
  document.documentElement.style.setProperty("--header-h", "80px");
  // The first screen also shows the announcement bar above the header.
  expect(sections().map(minHeight)).toEqual([680, 720]);
});

test("without a sticky header later sections fill the whole screen", () => {
  render([{}, {}]);
  document.documentElement.style.setProperty("--header-group-h", "120px");
  document.documentElement.style.setProperty("--header-h", "80px");
  expect(sections().map(minHeight)).toEqual([680, 800]);
});

test("an empty first section doesn't take the first section's place", () => {
  render([{ full: false, empty: true }, {}, {}]);
  expect(sections().slice(1).map(minHeight)).toEqual([720, 800]);
});

test("only sections that slide over another get the stack shadow", () => {
  render([{ full: false, empty: true }, {}, { full: false, empty: true }, {}]);
  document.documentElement.className = "snap stack stack-ready";
  // Theme tokens come from snippets/css-variables.liquid, which the test page doesn't load.
  document.documentElement.style.setProperty("--ease-linear", "linear");
  const shadow = CSS.supports("animation-timeline: view()")
    ? "stack-shadow"
    : "none";
  expect(
    sections().map((section) => getComputedStyle(section).animationName),
  ).toEqual(["none", "none", "none", shadow]);
});

test("before stacking is ready, the first section with content and empty ones don't snap", () => {
  render([
    { full: false, empty: true },
    {},
    { full: false },
    { full: false, empty: true },
    {},
  ]);
  expect(sections().map(snap)).toEqual([
    "none",
    "none",
    "end",
    "none",
    "start",
  ]);
});
