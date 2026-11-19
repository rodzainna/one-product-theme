import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";
import articleLiquid from "../../sections/article.liquid?raw";
import blogLiquid from "../../sections/blog.liquid?raw";
import cardLiquid from "../../snippets/article-card.liquid?raw";

const styles = (liquid) =>
  liquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

const tokens = `:root { --space-2xs: 4px; --space-xs: 8px; --space-s: 12px; --space-m: 16px; --space-l: 32px; --space-xl: 48px;
  --page-margin: 20px; --page-width: 1200px; --radius-card: 12px; --radius-button: 999px; --color-border: #444;
  --color-background: #fff; --color-foreground: #000; --color-foreground-muted: #666; --color-hover: #eee; --color-accent: #a40;
  --text-body: 16px; --text-small: 14px; --text-h3: 24px; --text-h4: 20px; --leading-snug: 1.3; --control-h-sm: 36px;
  --target-min: 44px; --weight-ui: 600; --focus-ring: 2px solid #00f; --focus-offset: 2px; }
  body { margin: 0; }`;

const LONG = "Supercalifragilisticexpialidocious".repeat(3);
const card = ({
  title = "Title",
  excerpt = "An excerpt.",
  image = false,
}) => `<li><article class="article-card">
  ${image ? '<div class="article-card__media"><div style="aspect-ratio: 3 / 2; background: #ccc"></div></div>' : ""}
  <div class="article-card__body"><p class="article-card__meta">November 10, 2026 by Test author</p>
  <h2 class="article-card__title"><a class="article-card__link" href="#">${title}</a></h2>
  <p class="article-card__excerpt">${excerpt}</p></div>
</article></li>`;

const renderBlog = (cards) => {
  document.body.innerHTML = `<style>${tokens} ${criticalCss} ${styles(blogLiquid)} ${styles(cardLiquid)}</style>
    <div class="shopify-section"><div class="blog section-full">
      <header class="blog__header"><h1 class="blog__title h2">News</h1></header>
      <ul class="card-grid blog__grid">${cards.map(card).join("")}</ul>
    </div></div>`;
};

const renderArticle = ({
  content = "<p>Text.</p>",
  title = "Title",
  comments = [],
} = {}) => {
  document.body.innerHTML = `<style>${tokens} ${criticalCss} ${styles(articleLiquid)}</style>
    <div class="shopify-section"><div class="article section-full"><article class="article__column">
      <a class="article__back" href="#">Back to News</a>
      <header class="article__header"><h1 class="article__title h2">${title}</h1>
        <p class="article__meta">November 10, 2026 by Test author</p></header>
      <div class="article__content"><div class="rte">${content}</div></div>
      <nav class="article__more">
        <a class="article__more-link" href="#"><span class="article__more-label">Previous article</span><span class="article__more-title">${title}</span></a>
        <a class="article__more-link article__more-link--next" href="#"><span class="article__more-label">Next article</span><span class="article__more-title">${title}</span></a>
      </nav>
      <section class="comments" id="comments"><h2 class="comments__title h3">${comments.length} comments</h2>
        <ol class="comments__list">${comments.map((text) => `<li class="comment"><p class="comment__meta"><span class="comment__author">Ann</span> Nov 10</p><div class="rte"><p>${text}</p></div></li>`).join("")}</ol>
      </section>
    </article></div></div>`;
};

const box = (selector) =>
  document.querySelector(selector).getBoundingClientRect();
const lefts = () =>
  new Set(
    [...document.querySelectorAll(".blog__grid .article-card")].map((item) =>
      Math.round(item.getBoundingClientRect().left),
    ),
  );

afterEach(() => {
  document.body.innerHTML = "";
});

describe("blog list", () => {
  test.each([
    [320, 1],
    [599, 1],
    [600, 2],
    [899, 2],
    [900, 3],
    [1366, 3],
  ])("at %ipx the grid has %i columns", async (width, columns) => {
    await page.viewport(width, 800);
    renderBlog(Array.from({ length: 6 }, () => ({})));
    expect(lefts().size).toBe(columns);
  });

  test("the whole card, with or without a picture, is one link", async () => {
    await page.viewport(1366, 800);
    renderBlog([{ image: true }, {}]);
    for (const item of document.querySelectorAll(".article-card")) {
      const { left, top, height } = item.getBoundingClientRect();
      for (const y of [top + 8, top + height - 8]) {
        expect(
          document
            .elementFromPoint(left + 8, y)
            .closest("a.article-card__link"),
        ).not.toBeNull();
      }
    }
  });

  test("cards in a row stretch to one height", async () => {
    await page.viewport(1366, 800);
    renderBlog([{ image: true }, {}, { excerpt: "Longer. ".repeat(20) }]);
    const heights = [...document.querySelectorAll(".article-card")].map(
      (item) => Math.round(item.getBoundingClientRect().height),
    );
    expect(new Set(heights).size).toBe(1);
  });

  test("the picture is 3:2", async () => {
    await page.viewport(1366, 800);
    renderBlog([{ image: true }]);
    const media = box(".article-card__media");
    expect(media.width / media.height).toBeCloseTo(1.5, 1);
  });

  test.each([320, 390])(
    "very long words stay inside the card at %ipx",
    async (width) => {
      await page.viewport(width, 800);
      renderBlog([{ title: LONG, excerpt: LONG }, {}]);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      const edge = box(".article-card").right;
      for (const selector of [
        ".article-card__meta",
        ".article-card__title",
        ".article-card__excerpt",
      ]) {
        const range = document.createRange();
        range.selectNodeContents(document.querySelector(selector));
        expect(
          range.getBoundingClientRect().right,
          selector,
        ).toBeLessThanOrEqual(edge);
      }
    },
  );

  test("the section fills the screen below the header, with its content at the top", async () => {
    await page.viewport(1366, 800);
    renderBlog([{}]);
    document.documentElement.style.setProperty("--header-offset", "100px");
    expect(box(".blog").height).toBeGreaterThanOrEqual(700);
    expect(box(".blog__grid").top - box(".blog").top).toBeLessThan(150);
  });
});

describe("article page", () => {
  test("is one centred reading column no wider than 45rem", async () => {
    await page.viewport(1366, 800);
    renderArticle();
    const column = box(".article__column");
    expect(column.width).toBe(720);
    expect(Math.abs(column.left + column.width / 2 - 1366 / 2)).toBeLessThan(2);
  });

  test.each([320, 390])(
    "images, videos and embeds fit the column at %ipx",
    async (width) => {
      await page.viewport(width, 800);
      renderArticle({
        content: `<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="1600" height="900"><video width="1280" height="720"></video><iframe width="560" height="315" src="https://www.youtube.com/embed/x"></iframe>`,
      });
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      const column = box(".article__content").right;
      for (const element of document.querySelectorAll(
        ".rte :is(img, video, iframe)",
      )) {
        expect(element.getBoundingClientRect().right).toBeLessThanOrEqual(
          column,
        );
      }
    },
  );

  test("a YouTube embed keeps a 16:9 shape", async () => {
    await page.viewport(390, 800);
    renderArticle({
      content: `<iframe width="560" height="315" src="https://www.youtube.com/embed/x"></iframe>`,
    });
    const frame = box(".rte iframe");
    expect(frame.width / frame.height).toBeCloseTo(16 / 9, 1);
  });

  test("headings in the text sit below the title in size", async () => {
    await page.viewport(1366, 800);
    renderArticle({ content: "<h2>Two</h2><h3>Three</h3>" });
    const size = (selector) =>
      parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    expect(size(".rte h2")).toBe(24);
    expect(size(".rte h3")).toBe(20);
  });

  test.each([320, 390])(
    "very long words stay inside the column at %ipx",
    async (width) => {
      await page.viewport(width, 800);
      renderArticle({
        title: LONG,
        content: `<p>${LONG}</p>`,
        comments: [LONG],
      });
      const edge = box(".article__column").right;
      for (const selector of [
        ".article__title",
        ".rte p",
        ".comment .rte p",
        ".article__more-title",
      ]) {
        const range = document.createRange();
        range.selectNodeContents(document.querySelector(selector));
        expect(
          range.getBoundingClientRect().right,
          selector,
        ).toBeLessThanOrEqual(edge);
      }
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
    },
  );

  test("the previous and next links sit side by side, then stack on a phone", async () => {
    await page.viewport(1366, 800);
    renderArticle();
    const [newer, older] = [
      ...document.querySelectorAll(".article__more-link"),
    ].map((item) => item.getBoundingClientRect());
    expect(older.left).toBeGreaterThanOrEqual(newer.right);
    expect(Math.abs(older.top - newer.top)).toBeLessThan(2);
    await page.viewport(390, 800);
    const [n2, o2] = [...document.querySelectorAll(".article__more-link")].map(
      (item) => item.getBoundingClientRect(),
    );
    expect(o2.top).toBeGreaterThanOrEqual(n2.bottom);
    expect(o2.left).toBe(n2.left);
  });

  test("comments are separated by a thin line, the last one included", async () => {
    await page.viewport(1366, 800);
    renderArticle({ comments: ["One", "Two", "Three"] });
    const items = [...document.querySelectorAll(".comment")];
    expect(items).toHaveLength(3);
    for (const item of items)
      expect(getComputedStyle(item).borderBottomWidth).toBe("1px");
  });

  test("the section fills the screen below the header, with its content at the top", async () => {
    await page.viewport(1366, 800);
    renderArticle();
    document.documentElement.style.setProperty("--header-offset", "100px");
    expect(box(".article").height).toBeGreaterThanOrEqual(700);
    expect(box(".article__back").top - box(".article").top).toBeLessThan(80);
  });
});
