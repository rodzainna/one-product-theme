import { afterEach, describe, expect, test } from "vitest";
import imageLiquid from "../../snippets/image.liquid?raw";
import tileLiquid from "../../blocks/_tile.liquid?raw";

const css = (liquid) =>
  liquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

const pixel = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

const render = (inner, size = "width: 400px; height: 300px") => {
  document.body.innerHTML = `
    <style>
      :root { --space-l: 24px; --space-2xs: 4px; --text-h2: 32px; --text-small: 14px;
        --leading-tight: 1.1; --color-scrim: #140c08; --color-on-scrim: #fff;
        --color-accent: #c60; --duration-zoom: 0s; --ease: ease; }
      body { margin: 0; }
      ${css(tileLiquid)}
      /* As on the page, the image snippet's rules come after the block's. */
      ${css(imageLiquid)}
    </style>
    <div style="${size}; display: flex"><a class="tile" href="/">${inner}</a></div>`;
  return document.querySelector(".tile");
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("tile photo", () => {
  test("fills the whole tile, whatever shape the photo is", () => {
    const tile = render(
      `<div class="image tile__image"><img alt="" src="${pixel}" width="1600" height="400"></div><div class="tile__text"><h3 class="tile__title">T</h3></div>`,
    );
    const photo = tile.querySelector("img").getBoundingClientRect();
    const box = tile.getBoundingClientRect();
    expect(Math.round(photo.width)).toBe(Math.round(box.width));
    expect(Math.round(photo.height)).toBe(Math.round(box.height));
  });

  test("keeps the text above the photo, at the bottom", () => {
    const tile = render(
      `<div class="image tile__image"><img alt="" src="${pixel}"></div><div class="tile__text"><h3 class="tile__title">T</h3></div>`,
    );
    const text = tile.querySelector(".tile__text").getBoundingClientRect();
    const box = tile.getBoundingClientRect();
    expect(Math.round(text.bottom)).toBe(Math.round(box.bottom));
  });

  test("puts the gradient above the photo and under the text", () => {
    const tile = render(
      `<div class="image tile__image"><img alt="" src="${pixel}"></div><div class="tile__text"><h3 class="tile__title">Title</h3></div>`,
    );
    const box = tile.getBoundingClientRect();
    const overPhoto = document.elementFromPoint(box.left + 10, box.top + 10);
    expect(overPhoto.classList.contains("tile__image")).toBe(true);
    expect(overPhoto.tagName).not.toBe("IMG");

    const title = tile.querySelector(".tile__title").getBoundingClientRect();
    const overText = document.elementFromPoint(title.left + 5, title.top + 5);
    expect(tile.querySelector(".tile__text").contains(overText)).toBe(true);
  });

  test("gives a tile with no photo a dark base, so the light text stays readable", () => {
    const tile = render(
      `<div class="tile__text"><h3 class="tile__title">Title</h3></div>`,
    );
    expect(getComputedStyle(tile).backgroundColor).toBe("rgb(20, 12, 8)");
  });
});

describe("tile focus ring", () => {
  test("is the light on-scrim colour, whatever the colour scheme's accent is", () => {
    render("");
    const rule = [...document.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules])
      .find((candidate) => candidate.selectorText === "a.tile:focus-visible");
    expect(rule.style.outlineColor).toBe("var(--color-on-scrim)");
  });
});
