import { afterEach, beforeEach, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { sectionDots } from "../../assets/section-dots.js";
import { stackSections } from "../../assets/stacked-sections.js";

let cleanups = [];

// The marker styles live in critical.css, which the test page doesn't load.
const styles = `<style>
  .snap-marker { position: absolute; inset-inline-start: 0; width: 1px; visibility: hidden; }
  .color-scheme-dark { --color-foreground: rgb(255, 255, 255); --color-background: rgb(0, 0, 0); }
  .section-dots { position: fixed; top: 0; right: 0; }
</style>`;

const section = ({ id, heading = "", scheme = "", height = 800 }) =>
  `<div class="shopify-section" id="${id}" style="height:${height}px"><div class="${height === 800 ? "section-full" : ""} ${scheme}">${heading ? `<h2>${heading}</h2>` : ""}</div></div>`;

const render = (sections, { dotsFirst = false } = {}) => {
  document.body.innerHTML = `${styles}<main id="MainContent" style="position:relative">${sections
    .map(section)
    .join(
      "",
    )}</main><nav class="section-dots" aria-label="Page sections" data-fallback-label="Section [number]"><ol></ol></nav>`;
  const storage = { getItem: () => null, setItem: () => {} };
  cleanups = dotsFirst
    ? [sectionDots(), stackSections({ storage })]
    : [stackSections({ storage }), sectionDots()];
};

const dots = () => [...document.querySelectorAll(".section-dots__dot")];
const current = () =>
  dots().findIndex((dot) => dot.getAttribute("aria-current") === "true");

beforeEach(async () => {
  await page.viewport(1366, 800);
});

afterEach(() => {
  cleanups.reverse().forEach((cleanup) => cleanup());
  cleanups = [];
  document.body.innerHTML = "";
  history.replaceState(null, "", location.pathname + location.search);
  scrollTo(0, 0);
});

test("links each dot to its section, named after its heading", () => {
  render([{ id: "one", heading: "Our beans" }, { id: "two" }]);
  expect(dots().map((dot) => [dot.hash, dot.textContent])).toEqual([
    ["#one", "Our beans"],
    ["#two", "Section 2"],
  ]);
});

test("marks the section crossing the middle of the screen", async () => {
  render([{ id: "one" }, { id: "two" }, { id: "three" }]);
  await expect.poll(current).toBe(0);
  scrollTo({ top: 1600, behavior: "instant" });
  await expect.poll(current).toBe(2);
});

test("marks a short section once it has fully arrived", async () => {
  render([{ id: "one" }, { id: "two" }, { id: "short", height: 300 }]);
  scrollTo({ top: 1100, behavior: "instant" });
  await expect.poll(current).toBe(2);
});

test("takes the current section's colours", async () => {
  render([{ id: "one" }, { id: "two", scheme: "color-scheme-dark" }]);
  scrollTo({ top: 800, behavior: "instant" });
  const nav = document.querySelector(".section-dots");
  await expect
    .poll(() => nav.style.getPropertyValue("--color-foreground"))
    .toBe("rgb(255, 255, 255)");
});

test("a dot scrolls to its section and moves focus there", async () => {
  render([{ id: "one" }, { id: "two" }, { id: "three", heading: "Brew" }]);
  await userEvent.click(page.getByRole("link", { name: "Brew" }));
  await expect.poll(() => Math.round(scrollY)).toBe(1600);
  expect(document.activeElement.id).toBe("three");
});

test("follows the theme editor adding a section", () => {
  render([{ id: "one" }, { id: "two" }]);
  const main = document.querySelector("main");
  main.insertAdjacentHTML("beforeend", section({ id: "new", heading: "New" }));
  main.lastElementChild.dispatchEvent(
    new CustomEvent("shopify:section:load", { bubbles: true }),
  );
  expect(dots().map((dot) => dot.textContent)).toEqual([
    "Section 1",
    "Section 2",
    "New",
  ]);
});

test("cleanup removes the dots and stops following rebuilds", () => {
  render([{ id: "one" }, { id: "two" }]);
  cleanups.pop()();
  expect(dots()).toHaveLength(0);
  document.querySelector("main").dispatchEvent(
    new CustomEvent("stacked-sections:change", {
      detail: { sections: [], index: 0 },
    }),
  );
  expect(dots()).toHaveLength(0);
});

test("works whichever module starts first", async () => {
  render([{ id: "one" }, { id: "two" }], { dotsFirst: true });
  expect(dots()).toHaveLength(2);
  expect(current()).toBe(0);
});

test("marks the current section on start, before any scroll", () => {
  render([{ id: "one" }, { id: "two" }]);
  expect(current()).toBe(0);
});

test("keeps keyboard focus on a dot while the current section changes", async () => {
  render([{ id: "one" }, { id: "two" }, { id: "three" }]);
  dots()[2].focus();
  scrollTo({ top: 800, behavior: "instant" });
  await expect.poll(current).toBe(1);
  expect(document.activeElement).toBe(dots()[2]);
});

test("Escape hides the open label until the visitor moves on", () => {
  render([{ id: "one" }, { id: "two" }]);
  const nav = document.querySelector(".section-dots");
  dots()[1].focus();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(nav.classList.contains("section-dots--dismissed")).toBe(true);
  dots()[0].focus();
  expect(nav.classList.contains("section-dots--dismissed")).toBe(false);
});

test("takes colours from the section's own scheme, not a nested one", async () => {
  render([{ id: "one" }, { id: "two" }]);
  const card = document.createElement("div");
  card.className = "color-scheme-dark";
  document.querySelector("#one > div").append(card);
  document
    .querySelector("main")
    .dispatchEvent(new CustomEvent("stacked-sections:request"));
  const nav = document.querySelector(".section-dots");
  expect(nav.style.getPropertyValue("--color-foreground")).not.toBe(
    "rgb(255, 255, 255)",
  );
});

test("cleanup removes the borrowed colours", () => {
  render([{ id: "one", scheme: "color-scheme-dark" }]);
  const nav = document.querySelector(".section-dots");
  expect(nav.style.getPropertyValue("--color-foreground")).toBe(
    "rgb(255, 255, 255)",
  );
  cleanups.pop()();
  expect(nav.style.getPropertyValue("--color-foreground")).toBe("");
});
