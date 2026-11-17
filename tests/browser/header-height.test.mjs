import { afterEach, expect, test } from "vitest";
import { trackHeaderHeight } from "../../assets/header-height.js";

let observer;

// Each height becomes a section of the group; `header` names the one holding the site header.
const render = (heights, header = heights.length - 1) => {
  document.body.innerHTML = `<div class="header-group">${heights
    .map(
      (h, n) =>
        `<div style="height:${h}px">${n === header ? '<div class="site-header"></div>' : ""}</div>`,
    )
    .join("")}</div>`;
  return document.querySelector(".header-group");
};

const value = (name = "--header-group-h") =>
  document.documentElement.style.getPropertyValue(name);

afterEach(() => {
  observer?.disconnect();
  for (const name of ["--header-group-h", "--header-above-h", "--header-h"]) {
    document.documentElement.style.removeProperty(name);
  }
});

test("matches the header group's height", () => {
  const group = render([40, 80]);
  observer = trackHeaderHeight(group);
  expect(value()).toBe("120px");
});

test("follows a height change", async () => {
  const group = render([40, 80]);
  observer = trackHeaderHeight(group);
  group.firstElementChild.style.height = "0px";
  await expect.poll(() => value()).toBe("80px");
});

test("is 0px without a header group", () => {
  document.body.innerHTML = "";
  observer = trackHeaderHeight(null);
  expect(value()).toBe("0px");
  expect(value("--header-above-h")).toBe("0px");
  expect(value("--header-h")).toBe("0px");
});

test("splits what sits above the header from the header below it", async () => {
  const group = render([40, 80]);
  observer = trackHeaderHeight(group);
  expect(value("--header-above-h")).toBe("40px");
  expect(value("--header-h")).toBe("80px");
  group.firstElementChild.style.height = "60px";
  await expect.poll(() => value("--header-above-h")).toBe("60px");
  expect(value("--header-h")).toBe("80px");
  expect(value()).toBe("140px");
});

test("without an announcement bar the header is the whole group", () => {
  const group = render([80]);
  observer = trackHeaderHeight(group);
  expect(value("--header-above-h")).toBe("0px");
  expect(value("--header-h")).toBe("80px");
});

test("an announcement bar moved below the header stays with the sticky part", () => {
  const group = render([80, 40], 0);
  observer = trackHeaderHeight(group);
  expect(value("--header-above-h")).toBe("0px");
  expect(value("--header-h")).toBe("120px");
});

test("without a header section the whole group scrolls away", () => {
  const group = render([40], -1);
  observer = trackHeaderHeight(group);
  expect(value("--header-above-h")).toBe("40px");
  expect(value("--header-h")).toBe("0px");
});
