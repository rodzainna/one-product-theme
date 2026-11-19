import { beforeAll, describe, expect, test } from "vitest";
import { STORE_URL, get } from "./store.mjs";

// The 404 and password pages aren't 200s the helper accepts, so they are fetched as they are.
// The dev proxy sometimes answers a 404 URL with a 502, so retry a few times.
const raw = async (path) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(new URL(path, STORE_URL));
    if (response.status !== 502)
      return { status: response.status, html: await response.text() };
  }
  throw new Error(`${path}: the preview kept answering 502`);
};

let plain;
let notFound;
let password;
beforeAll(async () => {
  plain = await get("/pages/test-plain");
  notFound = await raw("/pages/does-not-exist");
  password = await raw("/password");
});

const count = (html, pattern) => (html.match(pattern) ?? []).length;

describe("plain page", () => {
  test("has the page title as its one heading, and the text", () => {
    expect(count(plain, /<h1[\s>]/g)).toBe(1);
    expect(plain).toMatch(/<h1 class="page__title h2">Test plain page<\/h1>/);
    expect(plain).toContain(
      "The default page template, with the text in one reading column.",
    );
  });

  test("is a full-screen reading column that scrolls normally", () => {
    expect(plain).toContain('class="page reading section-full"');
    expect(plain).toContain('class="page__column reading__column"');
    expect(plain).toContain('class="page__content reading__content"');
    expect(plain).not.toMatch(/<html[^>]*class="[^"]*\b(snap|stack)\b/);
  });

  test("keeps the headings, list and link of the text", () => {
    for (const part of ["<h2", "<h3", "<ul", 'href="/collections/all"']) {
      expect(plain).toContain(part);
    }
  });
});

describe("404 page", () => {
  test("answers 404 with a clear message as its one heading", () => {
    expect(notFound.status).toBe(404);
    expect(count(notFound.html, /<h1[\s>]/g)).toBe(1);
    expect(notFound.html).toMatch(
      /<h1 class="not-found__title h2">Page not found<\/h1>/,
    );
    expect(notFound.html).toContain(
      "The page may have moved, or the address may be mistyped.",
    );
  });

  test("hides the big 404 from screen readers", () => {
    expect(notFound.html).toMatch(
      /<p class="not-found__code" aria-hidden="true">404<\/p>/,
    );
  });

  test("is a full-screen section that scrolls normally", () => {
    expect(notFound.html).toContain('class="not-found section-full"');
    expect(notFound.html).not.toMatch(/<html[^>]*class="[^"]*\b(snap|stack)\b/);
  });

  test("offers a search field that searches every type", () => {
    const form = notFound.html.match(
      /<form class="search-form__row"[\s\S]*?<\/form>/,
    )?.[0];
    expect(form).toMatch(/action="\/search"/);
    expect(form).toMatch(/role="search"/);
    expect(form).toContain(
      '<input type="hidden" name="type" value="article,page,product">',
    );
    expect(form).toMatch(/<input[^>]*type="search"[^>]*name="q"/);
    expect(form).toMatch(/<input[^>]*name="q"[^>]*required/);
    expect(form).toContain("search-field__loader");
    expect(form).toMatch(
      /<button[^>]*type="submit"[^>]*>\s*Search\s*<\/button>/,
    );
    expect(notFound.html).toMatch(
      /<search-form class="search-form not-found__search">/,
    );
  });

  test("links to the products and to the home page", () => {
    const links = notFound.html.match(
      /<div class="not-found__links">[\s\S]*?<\/div>/,
    )?.[0];
    expect(links).toMatch(/href="\/collections\/all"[^>]*>\s*Back to shopping/);
    expect(links).toMatch(/href="\/"[^>]*>\s*Home/);
  });
});

describe("password page", () => {
  test("is the password layout: no header, footer or menu", () => {
    expect(password.status).toBe(200);
    expect(password.html).not.toMatch(
      /class="header-group|class="site-header|<footer/,
    );
    expect(password.html).toContain('<main id="MainContent">');
  });

  test("shows the store name as its one heading when no logo is set", () => {
    expect(count(password.html, /<h1[\s>]/g)).toBe(1);
    expect(password.html).toMatch(
      /<h1 class="password__name">\s*one-product-test\s*<\/h1>/,
    );
  });

  test("shows the store's message, or a default one", () => {
    expect(password.html).toMatch(/<p class="password__message">[^<]+<\/p>/);
  });

  test("has a labelled password field and an Enter button in a storefront password form", () => {
    expect(password.html).toMatch(
      /<form[^>]*action="\/password"[^>]*class="password__form"|<form[^>]*class="password__form"[^>]*action="\/password"/,
    );
    expect(password.html).toMatch(
      /<input[^>]*type="password"[^>]*name="password"[^>]*required/,
    );
    expect(password.html).toMatch(/<label[^>]*>\s*Password\s*<\/label>/);
    expect(password.html).toMatch(
      /<button[^>]*type="submit"[^>]*>\s*Enter\s*<\/button>/,
    );
  });

  test("links the store owner to the admin", () => {
    expect(password.html).toMatch(
      /Are you the store owner\?\s*<a class="password__login" href="\/admin">Log in<\/a>/,
    );
  });

  test("is a full-screen section", () => {
    expect(password.html).toContain('class="password section-full"');
  });
});
