import { afterEach, beforeEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";

// A 40px announcement bar above an 80px header, then tall content.
const render = (classes) => {
  const style = document.documentElement.style;
  document.documentElement.className = classes;
  style.setProperty("--header-above-h", "40px");
  style.setProperty("--header-h", "80px");
  style.setProperty("--header-group-h", "120px");
  document.body.innerHTML = `<style>${criticalCss}</style>
    <div class="header-group"><div class="shopify-section" style="height:40px"></div><div class="shopify-section" style="height:80px"></div></div>
    <main><div class="shopify-section" style="height:3000px"></div></main>`;
};

const group = () => document.querySelector(".header-group");

beforeEach(async () => {
  await page.viewport(1366, 800);
});

afterEach(() => {
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  document.body.innerHTML = "";
  scrollTo(0, 0);
});

test("the announcement bar scrolls away and the header stays", async () => {
  render("header-sticky");
  scrollTo(0, 500);
  await expect.poll(() => scrollY).toBe(500);
  expect(group().getBoundingClientRect().top).toBe(-40);
});

test("without the setting the whole group scrolls away", async () => {
  render("");
  scrollTo(0, 500);
  await expect.poll(() => scrollY).toBe(500);
  expect(group().getBoundingClientRect().top).toBe(-500);
});

test("scrolling to an anchor leaves it clear of the header", () => {
  render("header-sticky");
  expect(getComputedStyle(document.documentElement).scrollPaddingTop).toBe(
    "80px",
  );
  render("");
  expect(getComputedStyle(document.documentElement).scrollPaddingTop).toBe(
    "auto",
  );
});

test("the header sits above the sections that stack under it", () => {
  render("header-sticky");
  document.documentElement.style.setProperty("--layer-header", "10");
  expect(getComputedStyle(group()).zIndex).toBe("10");
});

test("snapping rests at the very top through a point of its own, not the sticky group", () => {
  render("snap header-sticky");
  const top = getComputedStyle(document.body, "::before");
  expect(top.scrollSnapAlign).toMatch(/^start/);
  expect(getComputedStyle(group()).scrollSnapAlign).toBe("none");
  // The point is one header down, so its snap position (minus the scroll padding) is 0.
  expect(top.marginTop).toBe("80px");
  expect(group().getBoundingClientRect().top).toBe(0);
});

test("without a sticky header the group is the snap point at the top", () => {
  render("snap");
  expect(getComputedStyle(group()).scrollSnapAlign).toMatch(/^start/);
  expect(getComputedStyle(document.body, "::before").scrollSnapAlign).toBe(
    "none",
  );
});
