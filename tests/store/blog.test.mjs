import { beforeAll, describe, expect, test } from "vitest";
import { get } from "./store.mjs";

let first;
let second;
let pastEnd;
let tagged;
let withImage;
let withVideo;
let withYoutube;
let noImage;
beforeAll(async () => {
  first = await get("/blogs/news");
  second = await get("/blogs/news?page=2");
  pastEnd = await get("/blogs/news?page=9");
  tagged = await get("/blogs/news/tagged/brewing");
  withImage = await get("/blogs/news/article-with-image");
  withVideo = await get("/blogs/news/article-with-video");
  withYoutube = await get("/blogs/news/article-with-youtube");
  noImage = await get("/blogs/news/article-without-excerpt");
});

const cards = (html) =>
  html.split('<article class="article-card linked-card">').slice(1);
const count = (html, pattern) => (html.match(pattern) ?? []).length;

describe("blog page", () => {
  test("has the blog's title as its one heading", () => {
    expect(count(first, /<h1[\s>]/g)).toBe(1);
    expect(first).toMatch(/<h1 class="blog__title h2">\s*News\s*<\/h1>/);
  });

  test("is a full-screen section that scrolls normally", () => {
    expect(first).toContain('class="blog section-full"');
    expect(first).not.toMatch(/<html[^>]*class="[^"]*\b(snap|stack)\b/);
  });

  test("lists twelve articles on the first page and the rest on the second", () => {
    expect(cards(first)).toHaveLength(12);
    expect(cards(second).length).toBeGreaterThan(0);
    expect(cards(second).length).toBeLessThan(12);
  });

  test("gives each card one link to its article, a date and author line, and a title heading", () => {
    for (const html of cards(first)) {
      expect(count(html, /<a class="linked-card__link"/g)).toBe(1);
      expect(html).toMatch(
        /<h2 class="article-card__title">\s*<a class="linked-card__link" href="\/blogs\/news\/[^"]+">/,
      );
      expect(html).toMatch(
        /class="article-card__meta">[\s\S]*?<time[^>]*datetime="[^"]+"[\s\S]*?by[\s\S]*?<\/p>/,
      );
    }
  });

  test("shows the featured image, only for articles that have one", () => {
    const withPicture = cards(first).filter((html) =>
      html.includes("article-card__media"),
    );
    expect(withPicture.length).toBeGreaterThanOrEqual(3);
    expect(withPicture.length).toBeLessThan(cards(first).length);
    expect(withPicture[0]).toMatch(/<img[^>]*loading="eager"/);
    expect(withPicture[1]).toMatch(/<img[^>]*loading="lazy"/);
  });

  test("uses the excerpt, or the start of the text, shortened", () => {
    expect(first).toContain(
      "A landscape picture, headings, a list and a quote.",
    );
    const fallback = cards(first).find((html) =>
      html.includes("falls back to the start of this text"),
    );
    expect(fallback).toContain("which is long enough to...");
    expect(fallback).not.toContain("cut short");
  });

  test("keeps a space between an article's paragraphs in its excerpt", () => {
    expect(first).toMatch(
      /First paragraph\.\s+Second paragraph\.\s+Third paragraph\./,
    );
  });

  test("shows a tag by its name, not its handle", async () => {
    const html = await get("/blogs/news/tagged/cold-brew");
    expect(html).toContain("Tagged “Cold Brew”");
  });

  test("links to the pages with page links", () => {
    const nav = first.match(/<nav class="pagination"[\s\S]*?<\/nav>/)?.[0];
    expect(nav).toContain("page=2");
  });

  test("past the last page, says so and links to the first", () => {
    expect(pastEnd).toContain("There are no articles on this page.");
    expect(pastEnd).toContain("Go to the first page");
    expect(pastEnd).not.toContain("article-card");
  });

  test("a tagged view names its tag, links back to all and lists only that tag's articles", () => {
    expect(tagged).toContain("Tagged “brewing”");
    expect(tagged).toMatch(
      /class="blog__all" href="\/blogs\/news">Show all articles/,
    );
    expect(cards(tagged)).toHaveLength(1);
    expect(tagged).toContain("An article with an image");
  });
});

describe("article page", () => {
  test("has the title as its one heading, with the date, author and a link back to the blog", () => {
    expect(count(withImage, /<h1[\s>]/g)).toBe(1);
    expect(withImage).toMatch(
      /<h1 class="article__title h2">An article with an image<\/h1>/,
    );
    expect(withImage).toMatch(
      /class="article__meta">[\s\S]*?<time[\s\S]*?Test author/,
    );
    expect(withImage).toMatch(
      /class="article__back" href="\/blogs\/news">Back to News/,
    );
  });

  test("is a full-screen section that scrolls normally", () => {
    expect(withImage).toContain('class="article reading section-full"');
  });

  test("shows tags as links to the tagged blog", () => {
    const tags = withImage.match(
      /<ul class="article__tags"[\s\S]*?<\/ul>/,
    )?.[0];
    expect(tags).toContain('aria-label="Tags"');
    expect(tags).toMatch(
      /<a href="\/blogs\/news\/tagged\/brewing">brewing<\/a>/,
    );
    expect(tags).not.toContain("title=");
    expect(tags).toMatch(/href="\/blogs\/news\/tagged\/guides"/);
    expect(noImage).not.toContain("article__tags");
  });

  test("shows the featured image first, loaded at once, only when there is one", () => {
    expect(withImage).toMatch(
      /<img[^>]*(fetchpriority="high"|loading="eager")/,
    );
    expect(withImage.indexOf("article__image")).toBeGreaterThan(
      withImage.indexOf("article__header"),
    );
    expect(withImage.indexOf("article__image")).toBeLessThan(
      withImage.indexOf("article__content"),
    );
    expect(noImage).not.toContain("article__image");
  });

  test("shows the text with its headings, list and quote", () => {
    const content = withImage.match(
      /<div class="article__content reading__content">[\s\S]*?<\/div>\s*(<nav|<section|<\/article>)/,
    )?.[0];
    for (const part of [
      "<h2",
      "<ul",
      "<blockquote",
      "<h3",
      'href="/collections/all"',
    ]) {
      expect(content).toContain(part);
    }
  });

  test("keeps a hosted video and a YouTube embed in the text", () => {
    expect(withVideo).toMatch(/<video[^>]*controls[^>]*src="[^"]+\.mp4"/);
    expect(withYoutube).toMatch(
      /<iframe[^>]*src="https:\/\/www\.youtube\.com\/embed\//,
    );
  });

  test("link to the previous and next article by Shopify's order, leaving out a missing end", async () => {
    const links = (html) => ({
      prev: html.match(
        /rel="prev"[^>]*>[\s\S]*?article__more-title">([^<]*)/,
      )?.[1],
      next: html.match(
        /rel="next"[^>]*>[\s\S]*?article__more-title">([^<]*)/,
      )?.[1],
    });
    // Previous is the older article and next the newer one, by publish date. The fixtures' dates are
    // fixed and earlier than the setup day, so "Test article" is always the newest.
    expect(links(withImage)).toEqual({
      prev: "An article with a hosted video",
      next: "Test article",
    });
    expect(withImage).toContain("Previous article");
    expect(withImage).toContain("Next article");
    const newest = await get("/blogs/news/test-article");
    expect(links(newest).next).toBeUndefined();
    expect(links(newest).prev).toBe("An article with an image");
    const oldest = await get("/blogs/news/journal-entry-1");
    expect(links(oldest).prev).toBeUndefined();
    expect(links(oldest).next).toBe("Journal entry 2");
  });
});

describe("comments", () => {
  test("show a heading with the count, and the form with its three fields", () => {
    expect(withImage).toMatch(
      /<section class="comments" id="comments" aria-labelledby="Comments-title">/,
    );
    expect(withImage).toMatch(
      /id="Comments-title"[^>]*>\s*(\d+ comments?|Comments)\s*</,
    );
    expect(withImage).toMatch(
      /<form[^>]*id="comment_form"[^>]*action="\/blogs\/news\/article-with-image\/comments#comment_form"|action="\/blogs\/news\/article-with-image\/comments#comment_form"[^>]*id="comment_form"/,
    );
    for (const name of ["comment[author]", "comment[email]", "comment[body]"]) {
      expect(withImage).toContain(`name="${name}"`);
    }
    expect(withImage).toMatch(
      /<input[^>]*type="email"[^>]*name="comment\[email\]"/,
    );
    expect(withImage).toMatch(/<textarea[^>]*name="comment\[body\]"/);
    expect(withImage).toMatch(
      /<button[^>]*type="submit"[^>]*>\s*Post\s*<\/button>/,
    );
  });

  test("label every field and mark each as required", () => {
    for (const label of ["Name", "Email", "Comment"]) {
      expect(withImage).toMatch(new RegExp(`<label[^>]*>\\s*${label}`));
    }
    expect(
      count(withImage, /<(input|textarea)[^>]*\brequired\b/g),
    ).toBeGreaterThanOrEqual(3);
  });

  test("say so when there are none", () => {
    expect(withVideo).toContain("No comments yet.");
  });

  test("list each published comment with its author, date and text", () => {
    const items =
      withImage.match(/<li class="comment" id="comment-\d+">[\s\S]*?<\/li>/g) ??
      [];
    for (const item of items) {
      expect(item).toMatch(/class="comment__author">[^<]+</);
      expect(item).toMatch(/<time datetime="[^"]+">/);
      expect(item).toContain('class="rte"');
    }
    const heading = withImage.match(
      /id="Comments-title"[^>]*>\s*(\d+) comments?/,
    );
    expect(items.length).toBe(heading ? Math.min(Number(heading[1]), 10) : 0);
  });

  test("past the last page of comments, say so and link back to the first", async () => {
    const heading = withImage.match(
      /id="Comments-title"[^>]*>\s*(\d+) comments?/,
    );
    if (!heading) return;
    const html = await get("/blogs/news/article-with-image?page=9");
    expect(html).toContain("There are no comments on this page.");
    expect(html).toMatch(/href="[^"]*#comments"[^>]*>\s*Go to the first page/);
  });
});
