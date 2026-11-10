import { afterEach, expect, test } from "vitest";
import { trackHeaderHeight } from "../../assets/header-height.js";

let observer;

const render = (heights) => {
  document.body.innerHTML = `<div class="header-group">${heights
    .map((h) => `<div style="height:${h}px"></div>`)
    .join("")}</div>`;
  return document.querySelector(".header-group");
};

const value = () =>
  document.documentElement.style.getPropertyValue("--header-group-h");

afterEach(() => {
  observer?.disconnect();
  document.documentElement.style.removeProperty("--header-group-h");
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
  await expect.poll(value).toBe("80px");
});

test("is 0px without a header group", () => {
  document.body.innerHTML = "";
  observer = trackHeaderHeight(null);
  expect(value()).toBe("0px");
});
