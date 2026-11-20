import { beforeAll, describe, expect, test } from "vitest";
import { get } from "./store.mjs";

let first;
let second;
let empty;
let filtered;
let noMatch;
let pastEnd;
let withImage;
let withImageSecond;
let withImageFiltered;
const FILTERED =
  "/collections/all?filter.v.availability=1&filter.v.price.lte=15&sort_by=price-ascending";
beforeAll(async () => {
  first = await get("/collections/all");
  second = await get("/collections/all?page=2");
  empty = await get("/collections/test-empty");
  filtered = await get(FILTERED);
  noMatch = await get("/collections/all?filter.v.price.gte=99999");
  pastEnd = await get("/collections/all?page=99");
  withImage = await get("/collections/test-fillers");
  withImageSecond = await get("/collections/test-fillers?page=2");
  withImageFiltered = await get(
    "/collections/test-fillers?filter.v.availability=1",
  );
});

const cards = (html) =>
  html.match(/<article class="product-card linked-card">/g) ?? [];
const pagination = (html) =>
  html.match(/<nav class="pagination"[\s\S]*?<\/nav>/)?.[0];

describe("collection page", () => {
  test("has the collection's title as its one heading", () => {
    expect(first.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(first).toMatch(
      /<h1 class="collection__title h2">\s*Products\s*<\/h1>/,
    );
  });

  test("lists twelve products as cards, each with one link to its product", () => {
    expect(cards(first)).toHaveLength(12);
    const links = first.match(
      /<a class="linked-card__link" href="\/products\/[^"]+">/g,
    );
    expect(links).toHaveLength(12);
  });

  test("titles each card with an h2, so the headings go h1 then h2", () => {
    expect(first.match(/<h2 class="product-card__title">/g)).toHaveLength(12);
    expect(first).not.toMatch(/<h3 class="product-card__title">/);
  });

  test("a product whose first media is a video shows the video's preview image", async () => {
    const html = await get("/collections/all?sort_by=title-descending");
    const card = html
      .split('<article class="product-card linked-card">')
      .find((part) => part.includes('href="/products/test-video-first"'));
    expect(card).toMatch(/<img[^>]*src="[^"]*preview_images\//);
  });

  test("loads the first four cards' images at once and the rest lazily", async () => {
    // Title order puts products with photos first, so the first four have images to check.
    const html = await get("/collections/all?sort_by=title-descending");
    const loading = html
      .split('<article class="product-card linked-card">')
      .slice(1)
      .map((card) => card.match(/<img[^>]*loading="(\w+)"/)?.[1]);
    const firstFour = loading.slice(0, 4).filter(Boolean);
    const rest = loading.slice(4).filter(Boolean);
    expect(firstFour.length, "photos among the first four").toBeGreaterThan(0);
    expect(firstFour.every((value) => value === "eager")).toBe(true);
    expect(rest.length, "photos after the first four").toBeGreaterThan(0);
    expect(rest.every((value) => value === "lazy")).toBe(true);
  });
});

describe("pagination", () => {
  test("names the nav, marks the current page and offers Next on the first page", () => {
    const nav = pagination(first);
    expect(nav).toMatch(/aria-label="Pagination"/);
    expect(nav).toMatch(/<span[^>]*aria-current="page">1<\/span>/);
    expect(nav).toMatch(
      /<a[^>]*href="\/collections\/all\?page=2"[^>]*rel="next">Next<\/a>/,
    );
    expect(nav).not.toMatch(/rel="prev"/);
  });

  test("the second page holds the rest, with Previous and no Next", () => {
    expect(cards(second).length).toBeGreaterThan(0);
    expect(cards(second).length).toBeLessThan(12);
    const nav = pagination(second);
    expect(nav).toMatch(/rel="prev">Previous<\/a>/);
    expect(nav).toMatch(/<span[^>]*aria-current="page">2<\/span>/);
    expect(nav).not.toMatch(/rel="next"/);
  });

  test("names each page link by its number", () => {
    expect(pagination(first)).toMatch(/aria-label="Page 2"\s*>\s*2\s*<\/a>/);
  });

  test("shows no page links when everything fits on one page", async () => {
    const html = await get(
      "/collections/all?filter.v.price.gte=19&filter.v.price.lte=21",
    );
    expect(cards(html).length).toBeGreaterThan(0);
    expect(cards(html).length).toBeLessThan(12);
    expect(pagination(html)).toBeUndefined();
  });

  test("writes its page links with escaped ampersands", async () => {
    const html = await get(
      "/collections/all?filter.v.availability=1&sort_by=title-ascending",
    );
    const hrefs = pagination(html).match(/href="[^"]*"/g);
    expect(hrefs.length).toBeGreaterThanOrEqual(2);
    for (const href of hrefs) {
      expect(href).not.toMatch(/&(?!amp;)/);
      expect(href).not.toMatch(/&amp;amp;/);
    }
  });

  test("has no empty list items", () => {
    expect(pagination(first)).not.toMatch(/<li>\s*<\/li>/);
  });
});

describe("the collection's image", () => {
  const banner = (html) =>
    html.match(
      /<div\s+class="image image--cropped collection__banner"[^>]*>[\s\S]*?<\/div>/,
    )?.[0];

  test("shows as a 3:1 banner with the admin's alt text, above the title", () => {
    const html = banner(withImage);
    expect(html).toBeDefined();
    expect(html).toContain("--image-ratio: 3 / 1");
    expect(html).toContain('sizes="(min-width: 75rem) 75rem, 100vw"');
    expect(html).toContain('alt="Test fillers banner"');
    expect(withImage.indexOf("collection__banner")).toBeLessThan(
      withImage.indexOf('<h1 class="collection__title'),
    );
  });

  test("shows on every page and in a filtered view, like the title", () => {
    expect(banner(withImageSecond)).toBeDefined();
    expect(banner(withImageFiltered)).toBeDefined();
  });

  test("is left out when the collection has no image", () => {
    for (const html of [first, empty, noMatch, pastEnd]) {
      expect(html).not.toContain("collection__banner");
    }
  });
});

describe("the page's size", () => {
  test("fills the screen in every state, so a short page doesn't leave the footer mid-screen", () => {
    for (const html of [first, empty, noMatch, pastEnd]) {
      expect(html).toContain('class="collection section-full"');
    }
  });
});

describe("an empty collection", () => {
  test("shows the collection's description, then says it's empty and offers all products, with no grid or page links", () => {
    expect(empty).toMatch(
      /<h1 class="collection__title h2">\s*Test empty\s*<\/h1>/,
    );
    expect(empty).toMatch(/Test collection with no products\./);
    expect(empty).toMatch(/There are no products in this collection yet\./);
    expect(empty).toMatch(
      /<a[^>]*href="\/collections\/all"[^>]*>\s*Browse all products\s*<\/a>/,
    );
    expect(empty).not.toMatch(/class="card-grid"/);
    expect(pagination(empty)).toBeUndefined();
  });
});

describe("filters and sort", () => {
  test("show a Filters button that opens the drawer, the product count and a sort select", () => {
    expect(first).toMatch(
      /<button[^>]*class="button button--secondary button--sm collection-filters__open"[^>]*data-dialog-open="CollectionFiltersDrawer"[^>]*>[\s\S]*?<span>Filters<\/span>/,
    );
    expect(first).toMatch(
      /<p class="collection-filters__count">\d+ products<\/p>/,
    );
    expect(first).toMatch(/<label[^>]*for="CollectionSort">Sort by<\/label>/);
    expect(first).toMatch(/<select[^>]*id="CollectionSort"[^>]*name="sort_by"/);
    expect(
      first.match(/<option value="[a-z-]+"( selected)?>/g).length,
    ).toBeGreaterThan(2);
  });

  test("put the filter groups in a drawer, in a form that submits by GET to this page", () => {
    expect(first).toMatch(
      /<form class="collection-filters__form" method="get">\s*<dialog/,
    );
    const drawer = first.match(
      /<dialog[^>]*id="CollectionFiltersDrawer"[\s\S]*?<\/dialog>/,
    )[0];
    expect(drawer).toMatch(
      /<legend class="collection-filters__legend">\s*Availability\s*<\/legend>/,
    );
    expect(drawer).toMatch(
      /<input\s+type="checkbox"\s+id="CollectionFilters-1-1"\s+name="filter\.v\.availability"\s+value="1"/,
    );
    expect(drawer).toMatch(/name="filter\.v\.price\.gte"/);
    expect(drawer).toMatch(/name="filter\.v\.price\.lte"/);
    expect(drawer).toMatch(
      /<button\s+class="button"\s+type="submit"[^>]*>\s*Apply\s*<\/button>/,
    );
  });

  test("slide the drawer in from the left, as the menu drawer does", () => {
    expect(first).toMatch(
      /<dialog\s+class="dialog dialog--drawer dialog--drawer-start"\s+id="CollectionFiltersDrawer"/,
    );
  });

  test("label each filter value with its count", () => {
    expect(first).toMatch(/<span>In stock \(\d+\)<\/span>/);
  });

  test("keep its field ids apart from the header's and footer's", () => {
    const ids = first.match(/\sid="[^"]+"/g);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("show no active filters, and no count on the button, when none are applied", () => {
    expect(first).not.toMatch(/collection-filters__chips/);
    expect(first).not.toMatch(/Filters \(\d+\)/);
  });

  test("a filtered page shows chips that remove one filter each, Clear all, and the count on the button", () => {
    expect(filtered).toMatch(/<span>Filters \(2\)<\/span>/);
    const chips = filtered.match(
      /<ul class="collection-filters__chips"[\s\S]*?<\/ul>/,
    )[0];
    expect(chips).toMatch(/aria-label="Remove filter: Availability: In stock"/);
    expect(chips).toMatch(/aria-label="Remove filter: Price: up to \$15\.00"/);
    expect(chips).toMatch(
      /href="\/collections\/all\?sort_by=price-ascending"[^>]*>Clear all/,
    );
  });

  test("each chip's link removes only its own filter and keeps the sort", () => {
    const chips = filtered.match(
      /<ul class="collection-filters__chips"[\s\S]*?<\/ul>/,
    )[0];
    expect(chips).toMatch(
      /href="\/collections\/all\?filter\.v\.price\.lte=15&amp;sort_by=price-ascending"[^>]*aria-label="Remove filter: Availability/,
    );
    expect(chips).toMatch(
      /href="\/collections\/all\?filter\.v\.availability=1&amp;sort_by=price-ascending"[^>]*aria-label="Remove filter: Price/,
    );
  });

  test("a price range reads from and to, or just one end", async () => {
    const both = await get(
      "/collections/all?filter.v.price.gte=5&filter.v.price.lte=15",
    );
    expect(both).toMatch(/Remove filter: Price: \$5\.00 – \$15\.00/);
    expect(noMatch).toMatch(/Remove filter: Price: from \$99,999\.00/);
    expect(filtered).toMatch(/Remove filter: Price: up to \$15\.00/);
  });

  test("price fields take any amount, so a stale value never blocks Apply", () => {
    const inputs = noMatch.match(
      /<input\s+type="number"[^>]*name="filter\.v\.price\.(?:gte|lte)"[^>]*>/g,
    );
    expect(inputs).toHaveLength(2);
    for (const input of inputs) {
      expect(input).toMatch(/step="any"/);
      expect(input).not.toMatch(/\smax=/);
    }
  });

  test("a value with no matches is disabled unless it is applied", () => {
    expect(noMatch).toMatch(
      /<input[^>]*name="filter\.v\.availability"[^>]*value="1"\s+disabled/,
    );
    expect(filtered).not.toMatch(
      /<input[^>]*name="filter\.v\.availability"[^>]*value="1"\s+checked\s+disabled/,
    );
  });

  test("the sort form carries the applied filters, so changing the sort keeps them", () => {
    const sort = filtered.match(
      /<form class="collection-filters__sort"[\s\S]*?<\/form>/,
    )[0];
    expect(sort).toMatch(
      /<input\s+type="hidden"\s+name="filter\.v\.availability"\s+value="1"\s*>/,
    );
    expect(sort).toMatch(
      /<input\s+type="hidden"\s+name="filter\.v\.price\.lte"\s+value="15\.0"/,
    );
    expect(
      first.match(/<form class="collection-filters__sort"[\s\S]*?<\/form>/)[0],
    ).not.toMatch(/type="hidden"/);
  });

  test("a price range's two ends both travel with the sort", async () => {
    const html = await get(
      "/collections/all?filter.v.price.gte=5&filter.v.price.lte=15",
    );
    const sort = html.match(
      /<form class="collection-filters__sort"[\s\S]*?<\/form>/,
    )[0];
    expect(sort).toMatch(/name="filter\.v\.price\.gte"\s+value="5\.0"/);
    expect(sort).toMatch(/name="filter\.v\.price\.lte"\s+value="15\.0"/);
  });

  test("the drawer's form carries the sort only when one was chosen", () => {
    expect(filtered).toMatch(
      /<form class="collection-filters__form" method="get">\s*<input\s+type="hidden"\s+name="sort_by"\s+value="price-ascending"/,
    );
    expect(first).toMatch(
      /<form class="collection-filters__form" method="get">\s*<dialog/,
    );
  });

  test("keep the chosen sort selected and the filters ticked", () => {
    expect(filtered).toMatch(/<option value="price-ascending" selected>/);
    expect(filtered).toMatch(
      /<input\s+type="checkbox"[^>]*name="filter\.v\.availability"\s+value="1"\s+checked/,
    );
    expect(filtered).toMatch(/name="filter\.v\.price\.lte"[^>]*value="15\.0"/);
  });

  test("a filtered page's page links keep the filters and the sort", async () => {
    const html = await get(
      "/collections/all?filter.v.availability=1&sort_by=title-ascending",
    );
    expect(pagination(html)).toMatch(
      /href="\/collections\/all\?filter\.v\.availability=1&amp;page=2&amp;sort_by=title-ascending"/,
    );
  });

  test("an empty collection has no filter bar", () => {
    expect(empty).not.toMatch(/collection-filters__bar/);
  });
});

describe("a page with nothing to show", () => {
  test("when filters match nothing, says so, keeps the bar and its chips, and offers Clear all", () => {
    expect(noMatch).toMatch(/No products match these filters\./);
    expect(noMatch).not.toMatch(/There are no products in this collection yet/);
    expect(noMatch).toMatch(/collection-filters__chips/);
    expect(noMatch).toMatch(
      /<a class="button button--secondary" href="\/collections\/all"[^>]*>\s*Clear all\s*<\/a>/,
    );
  });

  test("Clear all keeps the chosen sort", async () => {
    const html = await get(
      "/collections/all?filter.v.price.gte=99999&sort_by=price-ascending",
    );
    expect(html).toMatch(
      /<a class="button button--secondary" href="\/collections\/all\?sort_by=price-ascending"[^>]*>\s*Clear all\s*<\/a>/,
    );
  });

  test("the first-page link after a filtered page past the last keeps the filters and sort", async () => {
    const html = await get(
      "/collections/all?filter.v.availability=1&page=9&sort_by=price-ascending",
    );
    expect(html).toMatch(
      /href="\/collections\/all\?filter\.v\.availability=1&amp;page=1&amp;sort_by=price-ascending"[^>]*>\s*Go to the first page/,
    );
  });

  test("a filtered page past the last still says it is past the end, not that nothing matches", async () => {
    const html = await get("/collections/all?filter.v.availability=1&page=9");
    expect(html).toMatch(/There are no products on this page\./);
    expect(html).not.toMatch(/No products match these filters/);
  });

  test("the first-page link after a page past the last keeps the chosen sort", async () => {
    const html = await get("/collections/all?page=9&sort_by=price-ascending");
    expect(html).toMatch(
      /href="\/collections\/all\?page=1&amp;sort_by=price-ascending"[^>]*>\s*Go to the first page/,
    );
  });

  test("a page past the last says so and links to the first page", () => {
    expect(pastEnd).toMatch(/There are no products on this page\./);
    expect(pastEnd).toMatch(
      /href="\/collections\/all\?page=1"[^>]*>\s*Go to the first page\s*<\/a>/,
    );
  });
});
