import { beforeAll, describe, expect, test } from "vitest";
import { get } from "./store.mjs";

const ALL = "article,page,product";
const url = (query) => `/search?${query}`;
let mixed;
let pagesOnly;
let productsOnly;
let secondPage;
let noResults;
let pastEnd;
let noMatches;
let blank;
beforeAll(async () => {
  mixed = await get(url(`q=test&type=${ALL}`));
  pagesOnly = await get(url("q=test&type=page"));
  productsOnly = await get(url("q=test&type=product"));
  secondPage = await get(url(`q=test&type=${ALL}&page=2`));
  noResults = await get(url(`q=zzzqqq&type=${ALL}`));
  pastEnd = await get(url("q=test&type=product&page=9"));
  noMatches = await get(url("q=test&type=product&filter.v.price.gte=99999"));
  blank = await get("/search");
});

const count = (html, pattern) => (html.match(pattern) ?? []).length;
const typeLinks = (html) =>
  [
    ...html.matchAll(
      /<a\s+class="search__type"\s+href="([^"]+)"\s*(aria-current="true")?\s*>\s*([^<]+?)\s*<\/a>/g,
    ),
  ].map(([, href, current, label]) => ({ href, current: !!current, label }));

describe("search page", () => {
  test("has the page title as its one heading, and a search form that keeps the types", () => {
    expect(count(mixed, /<h1[\s>]/g)).toBe(1);
    expect(mixed).toMatch(/<form class="search-form__row"[^>]*role="search"/);
    expect(mixed).toContain(`<input type="hidden" name="type" value="${ALL}">`);
    expect(pagesOnly).toContain(
      '<input type="hidden" name="type" value="page">',
    );
  });

  test("is a full-screen section that scrolls normally", () => {
    expect(blank).toContain('class="search section-full search--blank"');
    expect(mixed).toContain('class="search section-full"');
    expect(blank).not.toMatch(/<html[^>]*class="[^"]*\b(snap|stack)\b/);
  });

  test("has the header's field: search icon, loader, and a Clear button that shows once there is text", () => {
    const field = (html) =>
      html.match(/<search-form[\s\S]*?<\/search-form>/)?.[0] ?? "";
    for (const html of [blank, mixed]) {
      expect(field(html)).toContain('class="search-field"');
      expect(field(html)).toContain('class="search-field__loader"');
      expect(field(html)).toMatch(/<input[^>]*type="search"[^>]*name="q"/);
    }
    expect(field(blank)).toMatch(/<input[^>]*name="q"[^>]*required/);
    expect(field(blank)).toMatch(/<button[^>]*\bhidden\b[^>]*data-clear/);
    expect(field(mixed)).not.toMatch(/<button[^>]*\bhidden\b[^>]*data-clear/);
    expect(field(mixed)).toMatch(/<input[^>]*value="test"/);
    expect(field(mixed)).toMatch(/data-clear[\s\S]*?<svg/);
  });

  test("uses a search input on the page and a text input in the header modal, so Esc closes the modal", () => {
    expect(mixed).toMatch(
      /<input[^>]*type="search"[^>]*name="q"[^>]*value="test"/,
    );
    expect(mixed).toMatch(
      /<dialog[^>]*id="SearchModal"[\s\S]*?<input[^>]*type="text"[^>]*role="combobox"/,
    );
  });

  test("before a search, adds a line of help under the title", () => {
    expect(blank).toContain("Find products, articles and pages.");
    expect(mixed).not.toContain("Find products, articles and pages.");
  });

  test("shows only the form before a search is made", () => {
    expect(blank).toContain('class="search-form__row"');
    expect(blank).not.toContain("search__types");
    expect(blank).not.toContain("card-grid");
  });

  test("a blank search sends every type", () => {
    expect(blank).toContain(`<input type="hidden" name="type" value="${ALL}">`);
  });
});

describe("type links", () => {
  test("are All, Products, Articles and Pages, with the terms in each link", () => {
    const links = typeLinks(mixed);
    expect(links.map((link) => link.label)).toEqual([
      "All",
      "Products",
      "Articles",
      "Pages",
    ]);
    expect(links.map((link) => link.href)).toEqual([
      `/search?q=test&amp;type=${encodeURIComponent(ALL)}`,
      "/search?q=test&amp;type=product",
      "/search?q=test&amp;type=article",
      "/search?q=test&amp;type=page",
    ]);
  });

  test("mark the current choice only", () => {
    expect(typeLinks(mixed).filter((l) => l.current)).toHaveLength(1);
    expect(typeLinks(mixed).find((l) => l.current).label).toBe("All");
    expect(typeLinks(pagesOnly).find((l) => l.current).label).toBe("Pages");
    expect(typeLinks(productsOnly).find((l) => l.current).label).toBe(
      "Products",
    );
  });

  test("mark All whatever order the types arrive in", async () => {
    const html = await get(url("q=test&type=product,article,page"));
    expect(typeLinks(html).find((l) => l.current).label).toBe("All");
  });

  test("percent-encode terms with spaces and symbols", async () => {
    const html = await get(url(`q=${encodeURIComponent("a & b")}&type=page`));
    expect(html).toContain("/search?q=a+%26+b&amp;type=product");
  });
});

describe("results", () => {
  test("mix product cards with page cards in one grid, twelve to a page", () => {
    expect(count(mixed, /<ul class="card-grid"/g)).toBe(1);
    expect(count(mixed, /class="product-card"/g)).toBeGreaterThan(0);
    expect(count(mixed, /class="result-card"/g)).toBeGreaterThan(0);
    expect(
      count(mixed, /class="product-card"/g) +
        count(mixed, /class="result-card"/g),
    ).toBe(12);
  });

  test("give every card one link, and a type label to pages", () => {
    expect(count(pagesOnly, /class="result-card"/g)).toBeGreaterThan(0);
    expect(count(pagesOnly, /class="result-card__link"/g)).toBe(
      count(pagesOnly, /class="result-card"/g),
    );
    expect(count(pagesOnly, />Page<\/span>/g)).toBe(
      count(pagesOnly, /class="result-card"/g),
    );
    expect(pagesOnly).toContain("Test page for the About template.");
  });

  test("show an article with its label and excerpt", async () => {
    const html = await get(url("q=test&type=article"));
    expect(html).toMatch(/class="result-card"[\s\S]*>Article<\/span>/);
    expect(html).toContain("Test article for the search results.");
  });

  test("keep a space between an article's paragraphs in its excerpt", async () => {
    const html = await get(url("q=paragraphs&type=article"));
    expect(html).toMatch(
      /First paragraph\.\s+Second paragraph\.\s+Third paragraph\./,
    );
  });

  test("show the count, singular or plural", async () => {
    expect(mixed).toMatch(/class="collection-filters__count">\d+ results</);
    expect(pagesOnly).toMatch(/class="search__count">\d+ results</);
    const one = await get(url("q=%22Test+regular%22&type=product"));
    expect(one).toMatch(/>1 result</);
  });

  test("link to the next page with the terms and types kept", () => {
    const nav = mixed.match(/<nav class="pagination"[\s\S]*?<\/nav>/)?.[0];
    expect(nav).toContain("page=2");
    expect(nav).toContain("q=test");
    expect(nav).toContain("type=article%2Cpage%2Cproduct");
    expect(count(secondPage, /class="(product|result)-card"/g)).toBeGreaterThan(
      0,
    );
  });
});

describe("filters and sort", () => {
  test("show the bar with a Filters button and a sort select when products are included", () => {
    expect(mixed).toContain("collection-filters__open");
    expect(mixed).toMatch(/<select[^>]*name="sort_by"/);
    expect(productsOnly).toContain("collection-filters__open");
  });

  test("carry the terms and types in the sort and filter forms", () => {
    const forms = mixed.match(
      /<form class="collection-filters__(sort|form)"[\s\S]*?<\/form>/g,
    );
    expect(forms).toHaveLength(2);
    for (const form of forms) {
      expect(form).toContain('<input type="hidden" name="q" value="test">');
      expect(form).toContain(`name="type" value="${ALL}"`);
    }
  });

  test("offer relevance and both price sorts", () => {
    for (const value of ["relevance", "price-ascending", "price-descending"]) {
      expect(mixed).toContain(`<option value="${value}"`);
    }
  });

  test("leave out the bar when the results are only pages", () => {
    expect(pagesOnly).not.toContain("collection-filters");
    expect(pagesOnly).not.toContain('name="sort_by"');
  });

  test("a sort applies to the results", async () => {
    const html = await get(url("q=test&type=product&sort_by=price-descending"));
    expect(html).toMatch(/<option value="price-descending" selected>/);
  });
});

describe("empty states", () => {
  test("say nothing was found for the terms, with no grid or bar", () => {
    expect(noResults).toContain("No results for “zzzqqq”.");
    expect(noResults).not.toContain("card-grid");
    expect(noResults).not.toContain("collection-filters");
    expect(typeLinks(noResults)).toHaveLength(4);
  });

  test("escape the terms", async () => {
    const html = await get(
      url(`q=${encodeURIComponent("<b>x</b>")}&type=page`),
    );
    expect(html).toContain("No results for “&lt;b&gt;x&lt;/b&gt;”.");
    expect(html).not.toContain("<b>x</b>");
  });

  test("past the last page, say so and link to the first", () => {
    expect(pastEnd).toContain("There are no results on this page.");
    expect(pastEnd).toMatch(
      /href="[^"]*q=test[^"]*"[^>]*>\s*Go to the first page/,
    );
    expect(pastEnd).not.toContain("card-grid");
  });

  test("when filters match nothing, say so, keep the chip and offer Clear all", () => {
    expect(noMatches).toContain("No products match these filters.");
    expect(noMatches).toContain("collection-filters__chip");
    expect(noMatches).toMatch(
      /href="\/search\?q=test&amp;type=product"[^>]*>\s*Clear all/,
    );
  });
});
