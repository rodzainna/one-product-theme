import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { ProductSelectEvent } from "@shopify/events";
import galleryLiquid from "../../snippets/product-gallery.liquid?raw";
import "../../assets/product-gallery.js";

const stylesheet =
  galleryLiquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

const MEDIA = ["red", "blue", "video", "youtube"];

// The gallery as Liquid renders it, starting on `current`, marking `variantMedia` as the variant's.
const gallery = ({ current = "red", variantMedia = "red" } = {}) => `
  <product-gallery class="gallery" id="Gallery" data-variant-media="${variantMedia}">
    <ul class="gallery__track" aria-label="Product media">
      ${MEDIA.map((id) => {
        const body =
          id === "video"
            ? `<video src="data:video/mp4,"></video>`
            : id === "youtube"
              ? `<iframe src="about:blank?youtube" title="YouTube"></iframe>`
              : `<div class="image" style="aspect-ratio: 1; background: ${id}"></div>`;
        return `<li class="gallery__item" data-media-id="${id}" ${id === current ? "data-current" : ""}>${body}</li>`;
      }).join("")}
    </ul>
    <ul class="gallery__thumbs">
      ${MEDIA.map((id) => `<li><button type="button" class="gallery__thumb" data-media-id="${id}" aria-label="Show ${id}" aria-current="${id === current}"></button></li>`).join("")}
    </ul>
  </product-gallery>
`;

const render = (options) => {
  document.body.innerHTML = `
    <style>
      :root { --space-xs: 8px; --space-s: 12px; --space-xl: 32px; --radius-sm: 6px; --radius-card: 12px;
        --radius-full: 999px; --badge-pad: 4px; --duration: 0s; --ease: ease;
        --color-foreground: rgb(34, 34, 34); --color-background: rgb(255, 255, 255);
        --color-control-border: rgb(120, 120, 120); --focus-ring: 2px solid blue; --focus-offset: 2px; }
      * { box-sizing: border-box; }
      body { margin: 0; }
      ${stylesheet}
    </style>
    <div class="shopify-section">${gallery(options)}<div id="Picker"></div></div>
  `;
  return document.getElementById("Gallery");
};

const current = () =>
  document.querySelector(".gallery__item[data-current]")?.dataset.mediaId;
const currentThumb = () =>
  document.querySelector('.gallery__thumb[aria-current="true"]')?.dataset
    .mediaId;

// Fires the picker's standard event; the promise resolves with the re-rendered section.
const pick = (variantMedia, { variant = {} } = {}) => {
  const { promise, resolve } = ProductSelectEvent.createPromise();
  document.getElementById("Picker").dispatchEvent(
    new ProductSelectEvent({
      product: { id: 1 },
      selectedOptions: [],
      promise,
    }),
  );
  const doc = new DOMParser().parseFromString(
    gallery({ variantMedia }),
    "text/html",
  );
  resolve({ variant, doc });
  return promise;
};

afterEach(async () => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  await page.viewport(414, 896);
});

describe("product-gallery on desktop", () => {
  const desktop = () => page.viewport(1200, 800);

  test("shows only the current media", async () => {
    await desktop();
    render();
    const shown = [...document.querySelectorAll(".gallery__item")].filter(
      (item) => getComputedStyle(item).display !== "none",
    );
    expect(shown.map((item) => item.dataset.mediaId)).toEqual(["red"]);
  });

  test("a thumbnail makes its media current and marks itself", async () => {
    await desktop();
    render();
    await userEvent.click(page.getByRole("button", { name: "Show blue" }));
    expect(current()).toBe("blue");
    expect(currentThumb()).toBe("blue");
    expect(
      document.querySelectorAll('.gallery__thumb[aria-current="true"]'),
    ).toHaveLength(1);
  });

  test("picking a variant jumps to the media the server marks as the variant's", async () => {
    await desktop();
    render();
    await pick("blue");
    await expect.poll(current).toBe("blue");
    expect(currentThumb()).toBe("blue");
  });

  test("a variant without its own media leaves the gallery where it is", async () => {
    await desktop();
    render({ current: "video" });
    await pick("");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(current()).toBe("video");
  });

  test("a picker in another section doesn't move this gallery", async () => {
    await desktop();
    render();
    const other = document.createElement("div");
    other.className = "shopify-section";
    other.innerHTML = `<div id="Other"></div>`;
    document.body.append(other);
    const { promise, resolve } = ProductSelectEvent.createPromise();
    document
      .getElementById("Other")
      .dispatchEvent(new ProductSelectEvent({ product: { id: 2 }, promise }));
    resolve({
      variant: {},
      doc: new DOMParser().parseFromString(
        gallery({ variantMedia: "blue" }),
        "text/html",
      ),
    });
    await promise;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(current()).toBe("red");
  });

  test("leaving a video pauses it", async () => {
    await desktop();
    render({ current: "video" });
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause");
    await userEvent.click(page.getByRole("button", { name: "Show red" }));
    expect(pause).toHaveBeenCalledTimes(1);
  });

  test("leaving a YouTube video asks its player to pause", async () => {
    await desktop();
    render({ current: "youtube" });
    const frame = document.querySelector("iframe");
    const post = vi.spyOn(frame.contentWindow, "postMessage");
    await userEvent.click(page.getByRole("button", { name: "Show red" }));
    expect(JSON.parse(post.mock.calls[0][0])).toMatchObject({
      func: "pauseVideo",
    });
  });

  test("the row doesn't scroll, so it isn't a tab stop", async () => {
    await desktop();
    render();
    await expect
      .poll(() =>
        document.querySelector(".gallery__track").hasAttribute("tabindex"),
      )
      .toBe(false);
  });
});

describe("product-gallery players", () => {
  const poster = (id, player) => `
    <li class="gallery__item" data-media-id="${id}" data-current>
      <div class="product-media">
        <button type="button" class="product-media__poster" aria-label="Play ${id}"></button>
        <template>${player}</template>
      </div>
    </li>`;
  const renderPoster = (player) => {
    document.body.innerHTML = `<div class="shopify-section"><product-gallery id="Gallery"><ul class="gallery__track">${poster("clip", player)}</ul></product-gallery></div>`;
  };

  test("a pressed poster becomes the player, which starts and takes focus", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    renderPoster(`<video controls src="data:video/mp4,"></video>`);
    await userEvent.click(page.getByRole("button", { name: "Play clip" }));
    expect(document.querySelector(".product-media__poster")).toBeNull();
    expect(document.querySelector("template")).toBeNull();
    expect(play).toHaveBeenCalledTimes(1);
    await expect.poll(() => document.activeElement.localName).toBe("video");
  });

  test("a YouTube poster becomes its iframe", async () => {
    renderPoster(
      `<iframe src="about:blank?youtube&autoplay=1" title="Clip"></iframe>`,
    );
    await userEvent.click(page.getByRole("button", { name: "Play clip" }));
    expect(document.querySelector("iframe").title).toBe("Clip");
    await expect.poll(() => document.activeElement.localName).toBe("iframe");
  });

  test("a tapped poster that isn't current becomes current", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    document.body.innerHTML = `<div class="shopify-section"><product-gallery id="Gallery"><ul class="gallery__track">
      <li class="gallery__item" data-media-id="a" data-current><div></div></li>
      <li class="gallery__item" data-media-id="clip"><div class="product-media">
        <button type="button" class="product-media__poster" aria-label="Play clip"></button>
        <template><video src="data:video/mp4,"></video></template></div></li>
    </ul></product-gallery></div>`;
    await userEvent.click(page.getByRole("button", { name: "Play clip" }));
    expect(current()).toBe("clip");
  });

  test("a 3D viewer takes focus on its keyboard control once defined, unless the shopper moved on", async () => {
    const model = (id, isCurrent) => `
      <li class="gallery__item" data-media-id="${id}" ${isCurrent ? "data-current" : ""}><div class="product-media">
        <button type="button" class="product-media__poster" aria-label="Load ${id}"></button>
        <template><model-viewer id="${id}"></model-viewer></template></div></li>`;
    document.body.innerHTML = `<div class="shopify-section"><product-gallery id="Gallery"><ul class="gallery__track">
      ${model("first", true)}${model("second", false)}</ul></product-gallery></div>`;
    await userEvent.click(page.getByRole("button", { name: "Load first" }));
    await userEvent.click(page.getByRole("button", { name: "Load second" }));
    // Stands in for <model-viewer>, which Shopify defines after it appears.
    customElements.define(
      "model-viewer",
      class extends HTMLElement {
        constructor() {
          super();
          this.focused = 0;
          this.attachShadow({ mode: "open" }).innerHTML =
            `<div tabindex="0" aria-label="Model"></div>`;
          this.shadowRoot.firstChild.addEventListener(
            "focus",
            () => this.focused++,
          );
        }
      },
    );
    const control = (id) =>
      document.getElementById(id).shadowRoot.activeElement?.ariaLabel ?? null;
    await expect.poll(() => control("second")).toBe("Model");
    expect(document.getElementById("first").focused).toBe(0);
  });
});

describe("product-gallery thumbnails", () => {
  test("the row scrolls, not the page, to bring the current thumbnail into view", async () => {
    await page.viewport(1200, 800);
    document.documentElement.style.height = "3000px";
    render();
    const row = document.querySelector(".gallery__thumbs");
    row.style.width = "120px";
    for (const thumb of row.querySelectorAll("button")) {
      thumb.style.width = thumb.style.height = "64px";
    }
    scrollTo(0, 200);
    document.getElementById("Gallery").show("youtube");
    const thumb = row.querySelector('[data-media-id="youtube"]');
    await expect
      .poll(() => {
        const box = thumb.getBoundingClientRect();
        const rowBox = row.getBoundingClientRect();
        return box.left >= rowBox.left - 1 && box.right <= rowBox.right + 1;
      })
      .toBe(true);
    expect(row.scrollLeft).toBeGreaterThan(0);
    expect(scrollY).toBe(200);
    document.documentElement.style.height = "";
  });
});

describe("product-gallery on phones", () => {
  const phone = () => page.viewport(390, 844);

  test("is a swipe row that takes keyboard focus, without thumbnails", async () => {
    await phone();
    render();
    const track = document.querySelector(".gallery__track");
    expect(track.scrollWidth).toBeGreaterThan(track.clientWidth);
    await expect.poll(() => track.tabIndex).toBe(0);
    expect(
      getComputedStyle(document.querySelector(".gallery__thumbs")).display,
    ).toBe("none");
  });

  test("picking a variant scrolls the row to its media, not the page", async () => {
    await phone();
    document.documentElement.style.height = "3000px";
    render();
    scrollTo(0, 100);
    await pick("video");
    // The row snaps each media to its centre.
    const centre = (element) => {
      const box = element.getBoundingClientRect();
      return Math.round(box.left + box.width / 2);
    };
    const track = document.querySelector(".gallery__track");
    const item = document.querySelector('[data-media-id="video"]');
    await expect
      .poll(() => Math.abs(centre(item) - centre(track)))
      .toBeLessThan(2);
    expect(scrollY).toBe(100);
    document.documentElement.style.height = "";
  });

  test("swiping makes the media in view current", async () => {
    await phone();
    render();
    const track = document.querySelector(".gallery__track");
    const item = document.querySelector('[data-media-id="video"]');
    track.scrollLeft = item.offsetLeft - track.offsetLeft;
    await expect.poll(current).toBe("video");
  });

  test("a media that only peeks in doesn't become current", async () => {
    await phone();
    render();
    const track = document.querySelector(".gallery__track");
    const [, second] = track.children;
    const width = second.clientWidth;
    // The second media mostly in view, the third not yet.
    track.style.scrollSnapType = "none";
    track.scrollLeft = second.offsetLeft - track.offsetLeft - width * 0.3;
    await expect.poll(current).toBe("blue");
    // Centring it lets the third peek in.
    track.scrollLeft =
      second.offsetLeft - track.offsetLeft - (track.clientWidth - width) / 2;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(current()).toBe("blue");
  });
});
