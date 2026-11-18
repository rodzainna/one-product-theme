import { beforeAll, describe, expect, test } from "vitest";
import { products } from "./products.mjs";
import { product, section, sectionId, variantId } from "./store.mjs";

const path = "/products/test-two-options";
const gallery = (html) => {
  const match = html.match(/<product-gallery[\s\S]*?<\/product-gallery>/);
  expect(match, "no gallery in the section").not.toBeNull();
  return match[0];
};
const items = (html) =>
  [
    ...gallery(html).matchAll(
      /<li\s+class="gallery__item"\s+data-media-id="(\d+)"([^>]*)>([\s\S]*?)<\/li>/g,
    ),
  ].map(([, id, attributes, body]) => ({
    id,
    current: /data-current/.test(attributes),
    body,
  }));
const current = (html) => items(html).filter((item) => item.current);
const variantMedia = (html) =>
  gallery(html).match(/data-variant-media="(\d*)"/)[1];
const alt = (item) => item.body.match(/alt="([^"]*)"/)?.[1];

let id, json;
beforeAll(async () => {
  id = await sectionId(path, "main");
  json = await product("test-two-options");
});

describe("product gallery", () => {
  test("renders every media type in product order", async () => {
    const html = await section(path, id);
    const bodies = items(html).map((item) => item.body);
    expect(bodies).toHaveLength(
      products.find((p) => p.handle === "test-two-options").files.length,
    );
    expect(
      bodies.slice(0, 3).every((body) => /class="image\b/.test(body)),
    ).toBe(true);
    // Players wait in a template behind a poster, so none loads with the page.
    const player = (body) =>
      body.match(/<template>([\s\S]*?)<\/template>/)?.[1] ?? "";
    expect(bodies[3]).toMatch(
      /aria-label="Play video: A flower opening \(CC0\)"/,
    );
    expect(player(bodies[3])).toMatch(/<video[^>]*\scontrols/);
    expect(player(bodies[3])).not.toMatch(/autoplay/);
    expect(player(bodies[4])).toMatch(
      /<iframe[^>]*src="https:\/\/www\.youtube\.com\/embed\/[^"]*autoplay=1[^"]*enablejsapi=1/,
    );
    expect(bodies[5]).toMatch(
      /aria-label="Load 3D model: Avocado 3D model \(CC0\)"/,
    );
    expect(player(bodies[5])).toMatch(/<model-viewer\s/);
    expect(bodies[5].replace(/<template>[\s\S]*?<\/template>/, "")).toMatch(
      /data-shopify-xr\s/,
    );
    expect(gallery(html)).toMatch(
      /<script type="application\/json" data-models>/,
    );
  });

  test("square shape crops every image to 1:1", async () => {
    const html = await section(path, id);
    const images = items(html).filter(
      (item) => !item.body.includes("product-media"),
    );
    expect(images).toHaveLength(3);
    expect(images.every((item) => item.body.includes("--image-ratio: 1"))).toBe(
      true,
    );
  });

  test("starts on the selected variant's media and marks it for the script", async () => {
    const html = await section(path, id);
    expect(current(html).map(alt)).toEqual(["Red test image"]);
    expect(variantMedia(html)).toBe(current(html)[0].id);
  });

  test("?variant= starts on that variant's media, placed first so phones show it", async () => {
    const blue = variantId(json, "S / Blue");
    const html = await section(`${path}?variant=${blue}`, id);
    expect(current(html).map(alt)).toEqual(["Blue test image"]);
    expect(items(html)[0].current).toBe(true);
    expect(items(html)[0].body).toMatch(/fetchpriority="high"/);
    const thumbs = [
      ...gallery(html).matchAll(/aria-label="Show ([^,]+), (\d) of 6"/g),
    ];
    expect(thumbs.slice(0, 2).map(([, name, n]) => `${n} ${name}`)).toEqual([
      "1 Red test image",
      "2 Blue test image",
    ]);
    expect(variantMedia(html)).toBe(current(html)[0].id);
  });

  test("a missing combination marks no variant media", async () => {
    const values = json.options.flatMap((option) => option.values);
    expect(values).toContain("L");
    const html = await section(path, id);
    const ids = [
      ...html.matchAll(/value="(L|Blue)"\s+data-option-value-id="(\d+)"/g),
    ].map((match) => match[2]);
    const missing = await section(`${path}?option_values=${ids.join(",")}`, id);
    expect(variantMedia(missing)).toBe("");
  });

  test("one thumbnail per media, the current one marked, video and 3D badged", async () => {
    const html = await section(path, id);
    const thumbs = [
      ...gallery(html).matchAll(
        /<button[\s\S]*?class="gallery__thumb"[\s\S]*?<\/button>/g,
      ),
    ].map(([thumb]) => thumb);
    expect(thumbs).toHaveLength(items(html).length);
    expect(
      thumbs.filter((thumb) => /aria-current="true"/.test(thumb)),
    ).toHaveLength(1);
    expect(
      thumbs.filter((thumb) => thumb.includes("gallery__badge")),
    ).toHaveLength(3);
    expect(thumbs[0]).toMatch(/aria-label="Show Red test image, 1 of 6"/);
  });

  test("a product without media shows a placeholder image instead of the gallery", async () => {
    const html = await section(
      "/products/test-regular",
      await sectionId("/products/test-regular", "main"),
    );
    expect(html).not.toMatch(/<product-gallery/);
    expect(html).toMatch(
      /<div class="gallery gallery--empty" aria-hidden="true">\s*<svg[^>]*class="gallery__placeholder"/,
    );
  });
});
