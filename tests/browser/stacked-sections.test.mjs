import { afterEach, beforeEach, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { stackSections } from "../../assets/stacked-sections.js";

let cleanup;
let storage;

// The marker styles live in critical.css, which the test page doesn't load.
const markerStyles = `<style>.snap-marker { position: absolute; inset-inline-start: 0; width: 1px; visibility: hidden; }</style>`;

// sticky: pin sections as critical.css does; footer: page content after main.
const render = (sections, { sticky = false, footer = 0 } = {}) => {
  const pinned = sticky
    ? `<style>.shopify-section { position: sticky; top: 0; background: white; }</style>`
    : "";
  document.body.innerHTML = `${markerStyles}${pinned}<main id="MainContent" style="position:relative">${sections
    .map(
      ({ height, full = true, id = "", empty = false }) =>
        `<div class="shopify-section" style="height:${height}px"><div ${full ? 'class="section-full"' : ""} ${id ? `id="${id}"` : ""} ${empty ? "data-empty" : ""}>x</div></div>`,
    )
    .join(
      "",
    )}</main><div style="height:${footer}px"></div><a id="jump" href="#two" style="position:fixed;top:0;left:0">jump</a>`;
  storage = new Map();
  cleanup = stackSections({
    storage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  });
};

const markers = () => [...document.querySelectorAll(".snap-marker")];
const sections = () => [...document.querySelectorAll(".shopify-section")];
const nextFrame = () => new Promise((done) => requestAnimationFrame(done));

beforeEach(async () => {
  await page.viewport(1366, 800);
});

afterEach(() => {
  cleanup?.();
  document.body.innerHTML = "";
  history.replaceState(null, "", location.pathname + location.search);
  scrollTo(0, 0);
});

// Reports whether the module took the click, then stops the test page from navigating.
const click = (link, init = {}) => {
  let taken;
  addEventListener(
    "click",
    (event) => {
      taken = event.defaultPrevented;
      event.preventDefault();
    },
    { once: true },
  );
  link.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, ...init }),
  );
  return taken;
};

test("adds a marker per section, at its natural place", () => {
  render([{ height: 800 }, { height: 800 }, { height: 50, full: false }]);
  expect(markers().map((m) => [m.style.top, m.style.height])).toEqual([
    ["0px", "800px"],
    ["800px", "800px"],
    ["1600px", "50px"],
  ]);
});

test("marks the first marker and short sections", () => {
  render([{ height: 800 }, { height: 50, full: false }, { height: 800 }]);
  expect(markers().map((m) => m.className)).toEqual([
    "snap-marker snap-marker--first",
    "snap-marker snap-marker--end",
    "snap-marker",
  ]);
});

test("a tall section sticks by its bottom edge", () => {
  render([{ height: 800 }, { height: 1800 }]);
  const stickTops = sections().map((s) =>
    s.style.getPropertyValue("--stick-top"),
  );
  expect(stickTops).toEqual(["0px", `${innerHeight - 1800}px`]);
});

test("snapping starts after the markers are placed", async () => {
  render([{ height: 800 }]);
  expect(document.documentElement.classList.contains("stack-ready")).toBe(
    false,
  );
  await nextFrame();
  expect(document.documentElement.classList.contains("stack-ready")).toBe(true);
});

test("cleanup before the first frame leaves snapping off", async () => {
  render([{ height: 800 }]);
  cleanup();
  cleanup = null;
  await nextFrame();
  expect(document.documentElement.classList.contains("stack-ready")).toBe(
    false,
  );
});

test("an anchor link to a section replaces the browser's own jump", () => {
  render([{ height: 800 }, { height: 800, id: "two" }]);
  expect(click(document.querySelector("#jump"))).toBe(true);
});

test("leaves modified clicks and other pages' links to the browser", () => {
  render([{ height: 800 }, { height: 800, id: "two" }]);
  const link = document.querySelector("#jump");
  expect(click(link, { metaKey: true })).toBe(false);
  link.target = "_blank";
  expect(click(link)).toBe(false);
  link.removeAttribute("target");
  link.href = "?variant=1#two";
  expect(click(link)).toBe(false);
});

test("Back after an anchor link returns to the section it left", async () => {
  render([{ height: 800 }, { height: 800 }, { height: 800, id: "two" }]);
  scrollTo({ top: 800, behavior: "instant" });
  await userEvent.click(page.getByRole("link", { name: "jump" }));
  await expect.poll(() => Math.round(scrollY)).toBe(1600);
  history.back();
  await expect.poll(() => Math.round(scrollY)).toBe(800);
});

test("ignores a malformed hash", () => {
  history.replaceState(null, "", "#%E0%A4%A");
  expect(() => render([{ height: 800 }])).not.toThrow();
});

test("follows a section's height change", async () => {
  render([{ height: 800 }, { height: 800 }, { height: 800 }]);
  sections()[0].style.height = "900px";
  await expect.poll(() => markers()[1].style.top).toBe("900px");
});

test("an anchor link scrolls to its section's marker and moves focus", async () => {
  render([{ height: 800 }, { height: 800, id: "two" }, { height: 800 }]);
  await userEvent.click(page.getByRole("link", { name: "jump" }));
  await expect.poll(() => Math.round(scrollY)).toBe(800);
  expect(document.activeElement.id).toBe("two");
  expect(location.hash).toBe("#two");
});

test("selecting a section in the theme editor scrolls to it", async () => {
  render([{ height: 800 }, { height: 800 }, { height: 800 }]);
  sections()[2].dispatchEvent(
    new CustomEvent("shopify:section:select", { bubbles: true }),
  );
  expect(Math.round(scrollY)).toBe(1600);
});

test("rebuilds when the theme editor re-renders a section", () => {
  render([{ height: 800 }, { height: 800 }]);
  const fresh = sections()[1].cloneNode(true);
  fresh.style.height = "500px";
  sections()[1].replaceWith(fresh);
  fresh.dispatchEvent(
    new CustomEvent("shopify:section:load", { bubbles: true }),
  );
  expect(markers().map((m) => m.style.height)).toEqual(["800px", "500px"]);
});

test("drops a section the theme editor is deleting", () => {
  render([{ height: 800 }, { height: 800 }, { height: 800 }]);
  sections()[1].dispatchEvent(
    new CustomEvent("shopify:section:unload", { bubbles: true }),
  );
  expect(markers().map((m) => m.style.top)).toEqual(["0px", "800px"]);
});

test("a deleted current section stops being marked current", () => {
  render([{ height: 800 }, { height: 800 }]);
  sections()[0].dispatchEvent(
    new CustomEvent("shopify:section:unload", { bubbles: true }),
  );
  expect(sections().map((s) => s.hasAttribute("data-current"))).toEqual([
    false,
    true,
  ]);
});

test("remembers the current section when the page is hidden", () => {
  render([{ height: 800 }, { height: 800 }, { height: 800 }]);
  scrollTo({ top: 1600, behavior: "instant" });
  dispatchEvent(new PageTransitionEvent("pagehide"));
  expect([...storage.values()]).toEqual(["2"]);
});

test("cleanup removes the markers and listeners", async () => {
  render([{ height: 800 }, { height: 800, id: "two" }]);
  cleanup();
  cleanup = null;
  expect(markers()).toHaveLength(0);
  expect(click(document.querySelector("#jump"))).toBe(false);
});

test("an anchor to a short section lands with its bottom at the bottom of the screen", async () => {
  render([
    { height: 800 },
    { height: 800 },
    { height: 300, full: false, id: "two" },
    { height: 800 },
  ]);
  await userEvent.click(page.getByRole("link", { name: "jump" }));
  await expect.poll(() => Math.round(scrollY)).toBe(1100);
});

test("clicking the link for the current hash adds no history entry", async () => {
  render([{ height: 800 }, { height: 800, id: "two" }]);
  const link = page.getByRole("link", { name: "jump" });
  await userEvent.click(link);
  const length = history.length;
  await userEvent.click(link);
  expect(history.length).toBe(length);
});

test("remembers the last section when the footer fills the middle of the screen", () => {
  render([{ height: 800 }, { height: 800 }], { footer: 1000 });
  scrollTo({ top: 1800, behavior: "instant" });
  dispatchEvent(new PageTransitionEvent("pagehide"));
  expect([...storage.values()]).toEqual(["1"]);
});

test("focus moving into a covered section brings it back on screen", async () => {
  render([{ height: 800 }, { height: 800 }, { height: 800 }], { sticky: true });
  const button = document.createElement("button");
  button.textContent = "back";
  sections()[0].append(button);
  scrollTo({ top: 1600, behavior: "instant" });
  button.focus();
  await expect.poll(() => Math.round(scrollY)).toBe(0);
});

test("does nothing on phones", async () => {
  await page.viewport(400, 800);
  render([{ height: 800 }, { height: 800 }]);
  dispatchEvent(new PageTransitionEvent("pagehide"));
  expect(markers().map((m) => m.style.top)).toEqual(["", ""]);
  expect(storage.size).toBe(0);
});

test("works when the browser blocks session storage", () => {
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    get() {
      throw new DOMException("Blocked", "SecurityError");
    },
  });
  const errors = [];
  const onError = (event) => {
    errors.push(event.error);
    event.preventDefault();
  };
  addEventListener("error", onError);
  try {
    document.body.innerHTML = `<main id="MainContent"><div class="shopify-section"></div></main>`;
    cleanup = stackSections();
    dispatchEvent(new PageTransitionEvent("pagehide"));
  } finally {
    removeEventListener("error", onError);
    delete window.sessionStorage;
  }
  expect(errors).toEqual([]);
});

test("announces the current section as it changes", async () => {
  render([{ height: 800 }, { height: 800 }, { height: 800 }, { height: 800 }]);
  const seen = [];
  document
    .querySelector("main")
    .addEventListener("stacked-sections:change", ({ detail }) =>
      seen.push(detail.index),
    );
  scrollTo({ top: 1600, behavior: "instant" });
  await expect.poll(() => seen).toEqual([2]);
  scrollTo({ top: 1700, behavior: "instant" });
  await nextFrame();
  await nextFrame();
  expect(seen).toEqual([2]);
});

test("re-announces when section heights change without a scroll", async () => {
  render([{ height: 800 }, { height: 800 }, { height: 800 }]);
  const seen = [];
  document
    .querySelector("main")
    .addEventListener("stacked-sections:change", ({ detail }) =>
      seen.push(detail.index),
    );
  sections()[0].style.height = "300px";
  await expect.poll(() => seen).toEqual([1]);
});

test("marks only the current section, and cleanup clears it", async () => {
  render([{ height: 800 }, { height: 800 }, { height: 800 }]);
  const marked = () => sections().map((s) => s.hasAttribute("data-current"));
  expect(marked()).toEqual([true, false, false]);
  scrollTo({ top: 1600, behavior: "instant" });
  await expect.poll(marked).toEqual([false, false, true]);
  cleanup();
  cleanup = null;
  expect(marked()).toEqual([false, false, false]);
});

test("an empty section is never current and is left out of the announcement", async () => {
  render([{ height: 800 }, { height: 0, full: false }, { height: 800 }]);
  const main = document.querySelector("main");
  const seen = [];
  main.addEventListener("stacked-sections:change", ({ detail }) =>
    seen.push([detail.sections.length, detail.index]),
  );
  main.dispatchEvent(new CustomEvent("stacked-sections:request"));
  expect(seen).toEqual([[2, 0]]);
  scrollTo({ top: 300, behavior: "instant" });
  await nextFrame();
  await nextFrame();
  expect(sections().map((s) => s.hasAttribute("data-current"))).toEqual([
    true,
    false,
    false,
  ]);
});

test("announces when an empty section gains content", async () => {
  render([{ height: 800 }, { height: 0, full: false }, { height: 800 }]);
  const seen = [];
  document
    .querySelector("main")
    .addEventListener("stacked-sections:change", ({ detail }) =>
      seen.push(detail.sections.length),
    );
  sections()[1].style.height = "300px";
  await expect.poll(() => seen).toEqual([3]);
});

test("a section that empties out stops being current", async () => {
  render([{ height: 800 }, { height: 800 }, { height: 800 }]);
  scrollTo({ top: 1600, behavior: "instant" });
  await expect
    .poll(() => sections()[2].hasAttribute("data-current"))
    .toBe(true);
  sections()[2].style.height = "0px";
  await expect
    .poll(() => sections()[1].hasAttribute("data-current"))
    .toBe(true);
});

test("an empty first section takes no snap and is never current", () => {
  render([{ height: 0, full: false }, { height: 800 }, { height: 800 }]);
  const has = (name) => markers().map((m) => m.classList.contains(name));
  expect(has("snap-marker--empty")).toEqual([true, false, false]);
  expect(has("snap-marker--first")).toEqual([true, false, false]);
  expect(sections().map((s) => s.hasAttribute("data-current"))).toEqual([
    false,
    true,
    false,
  ]);
});

test("a section flagged empty passes the first marker to the next section", () => {
  render([{ height: 0, full: false, empty: true }, { height: 800 }]);
  const has = (name) => markers().map((m) => m.classList.contains(name));
  expect(has("snap-marker--first")).toEqual([false, true]);
});

test("a short first section after an empty one rests at the top, not by its end", () => {
  render([
    { height: 0, full: false, empty: true },
    { height: 300, full: false },
    { height: 800 },
  ]);
  const has = (name) => markers().map((m) => m.classList.contains(name));
  expect(has("snap-marker--end")).toEqual([false, false, false]);
});

test("an empty short section is not marked to snap by its end", () => {
  render([
    { height: 800 },
    { height: 0, full: false },
    { height: 300, full: false },
  ]);
  const has = (name) => markers().map((m) => m.classList.contains(name));
  expect(has("snap-marker--end")).toEqual([false, false, true]);
});

test("a page of empty sections marks none current", () => {
  render([
    { height: 0, full: false },
    { height: 0, full: false },
  ]);
  expect(sections().some((s) => s.hasAttribute("data-current"))).toBe(false);
});

test("an anchor to an empty section lands where the next section rests", async () => {
  render([
    { height: 800 },
    { height: 800 },
    { height: 0, full: false, id: "two" },
    { height: 300, full: false },
    { height: 800 },
  ]);
  await userEvent.click(page.getByRole("link", { name: "jump" }));
  await expect.poll(() => Math.round(scrollY)).toBe(1100);
});

test("a page of empty sections announces once, with no current section", () => {
  render([
    { height: 0, full: false },
    { height: 0, full: false },
  ]);
  const main = document.querySelector("main");
  const seen = [];
  main.addEventListener("stacked-sections:change", ({ detail }) =>
    seen.push([detail.sections.length, detail.index]),
  );
  main.dispatchEvent(new CustomEvent("stacked-sections:request"));
  expect(seen).toEqual([[0, -1]]);
});

test("a section left empty clears its dot", async () => {
  render([{ height: 800 }, { height: 800 }]);
  const seen = [];
  document
    .querySelector("main")
    .addEventListener("stacked-sections:change", ({ detail }) =>
      seen.push(detail.sections.length),
    );
  sections().forEach((s) => (s.style.height = "0px"));
  await expect.poll(() => seen).toEqual([0]);
});

test("an anchor to an empty section lands on the section after it", async () => {
  render([
    { height: 800 },
    { height: 0, full: false, id: "two" },
    { height: 800 },
  ]);
  scrollTo({ top: 0, behavior: "instant" });
  await userEvent.click(page.getByRole("link", { name: "jump" }));
  await expect.poll(() => Math.round(scrollY)).toBe(800);
});

test("announces again on request", () => {
  render([{ height: 800 }, { height: 800 }]);
  const main = document.querySelector("main");
  const seen = [];
  main.addEventListener("stacked-sections:change", ({ detail }) =>
    seen.push(detail.index),
  );
  main.dispatchEvent(new CustomEvent("stacked-sections:request"));
  expect(seen).toEqual([0]);
});
