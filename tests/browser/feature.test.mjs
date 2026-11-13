import { afterEach, describe, expect, test } from "vitest";
import featureLiquid from "../../blocks/_feature.liquid?raw";

const stylesheet =
  featureLiquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

const render = (icon, { size = "" } = {}) => {
  document.body.innerHTML = `
    <style>
      :root { --space-s: 12px; --space-2xs: 4px; --text-h4: 20px; --color-accent: #c60; }
      body { margin: 0; ${size} }
      ${stylesheet}
    </style>
    <div class="feature" role="listitem" style="width: 320px">
      ${icon}
      <h3 class="feature__title">Title</h3>
      <p class="feature__text">Text</p>
    </div>`;
  return document.querySelector(".feature");
};

const tracks = (element) =>
  getComputedStyle(element).gridTemplateColumns.split(" ").length;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("feature block layout on phones", () => {
  test("puts the icon beside the text", () => {
    const feature = render('<span class="feature__icon"><svg></svg></span>');
    expect(tracks(feature)).toBe(2);
  });

  test("gives the text the whole row when there is no icon", () => {
    expect(tracks(render(""))).toBe(1);
  });

  test("sizes the icon column and an uploaded icon from the section's mobile size", () => {
    const feature = render(
      '<div class="image feature__icon feature__icon--image"><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div>',
      { size: "--features-icon-mobile: 60px;" },
    );
    const box = feature.querySelector(".feature__icon").getBoundingClientRect();
    expect(Math.round(box.width)).toBe(60);
    expect(Math.round(box.height)).toBe(60);
    expect(getComputedStyle(feature).gridTemplateColumns.split(" ")[0]).toBe(
      "60px",
    );
  });

  test("falls back to 44px when the section sets no size", () => {
    const feature = render('<span class="feature__icon"><svg></svg></span>');
    expect(getComputedStyle(feature).gridTemplateColumns.split(" ")[0]).toBe(
      "44px",
    );
  });
});
