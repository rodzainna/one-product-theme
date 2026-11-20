import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import criticalCss from "../../assets/critical.css?raw";
import filtersLiquid from "../../snippets/collection-filters.liquid?raw";
import dialogLiquid from "../../snippets/dialog.liquid?raw";
import selectLiquid from "../../snippets/select.liquid?raw";
import buttonLiquid from "../../snippets/button.liquid?raw";
import "../../assets/dialog.js";
import "../../assets/select-form.js";

const styles = (liquid) =>
  liquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

// What the snippet renders for a collection with two filters, two of them active.
const render = ({ chips = true } = {}) => {
  document.body.innerHTML = `
    <style>
      :root { --space-2xs: 4px; --space-xs: 8px; --space-s: 12px; --space-m: 16px; --space-l: 32px;
        --control-h: 44px; --control-h-sm: 32px; --control-pad-y: 4px; --control-pad-xs: 8px; --control-pad-s: 12px;
        --select-pad-end-sm: 28px; --target-min: 24px; --radius-button: 999px; --radius-card: 12px; --radius-input: 8px;
        --color-border: #ccc; --color-background: #fff; --color-foreground: #000; --color-foreground-muted: #666;
        --color-hover: #eee; --color-accent: #a33; --color-overlay: rgb(0 0 0 / 0.5); --color-control-border: #888;
        --color-button: #a33; --color-button-text: #fff; --text-body: 16px; --text-small: 14px; --text-lg: 18px;
        --weight-ui: 600; --leading-tight: 1.25; --leading-normal: 1.5; --focus-ring: 2px solid #00f; --focus-offset: 2px;
        --scrollbar-width: 0px; --drawer-width: 24rem; --font-body: sans-serif; --weight-body: 400; --duration: 0.2s; --ease: ease; }
      body { margin: 0; }
      ${criticalCss}
      ${styles(filtersLiquid)}
      ${styles(dialogLiquid)}
      ${styles(selectLiquid)}
      ${styles(buttonLiquid)}
    </style>
    <div style="padding: 0 20px">
    <div class="collection-filters">
        <div class="collection-filters__bar">
          <button class="button button--secondary button--sm collection-filters__open" type="button" aria-haspopup="dialog" data-dialog-open="Drawer">
            <svg class="icon icon--sm" viewBox="0 0 24 24"></svg><span>Filters (2)</span>
          </button>
          <p class="collection-filters__count">10 products</p>
          <select-form data-skip-empty><form class="collection-filters__sort" method="get">
            <input type="hidden" name="filter.v.availability" value="1">
            <div class="field">
              <label class="field__label" for="CollectionSort">Sort by</label>
              <span class="select select--sm"><select class="control" id="CollectionSort" name="sort_by">
                <option value="manual">Featured</option><option value="price-ascending">Price, low to high</option>
              </select></span>
            </div>
            <button class="link-button collection-filters__update" type="submit">Update</button>
          </form></select-form>
        </div>
        ${
          chips
            ? `<ul class="collection-filters__chips" aria-label="Active filters">
          <li><a class="collection-filters__chip" href="#">Availability: In stock <svg class="icon icon--sm" viewBox="0 0 24 24"></svg></a></li>
          <li><a class="collection-filters__chip" href="#">Price: up to $15.00 <svg class="icon icon--sm" viewBox="0 0 24 24"></svg></a></li>
          <li><a class="collection-filters__clear" href="#">Clear all</a></li>
        </ul>`
            : ""
        }
        <select-form data-skip-empty><form class="collection-filters__form" method="get">
        <input type="hidden" name="sort_by" value="manual">
        <dialog class="dialog dialog--drawer dialog--drawer-start" id="Drawer" aria-labelledby="Drawer-title" data-close-outside>
          <div class="dialog__head"><h2 class="dialog__title" id="Drawer-title">Filter products</h2>
            <button type="button" data-dialog-close aria-label="Close">×</button></div>
          <div class="dialog__body" tabindex="0">
            <fieldset class="collection-filters__group"><legend class="collection-filters__legend">Price</legend>
              <div class="collection-filters__price">
                <div class="field"><label class="field__label" for="from">From</label><input class="control input" id="from" type="number" name="filter.v.price.gte"></div>
                <div class="field"><label class="field__label" for="to">To</label><input class="control input" id="to" type="number" name="filter.v.price.lte" value="15"></div>
              </div>
            </fieldset>
          </div>
          <div class="dialog__foot"><div class="collection-filters__actions">
            <button class="button" type="submit">Apply</button><a class="collection-filters__clear" href="#">Clear all</a>
          </div></div>
        </dialog>
        </form></select-form>
    </div>
    </div>`;
};

const box = (selector) =>
  document.querySelector(selector).getBoundingClientRect();
const shown = (selector) =>
  getComputedStyle(document.querySelector(selector)).display !== "none";

let listeners = new AbortController();
const watchSubmits = () => {
  const submitted = [];
  document.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      submitted.push(Object.fromEntries(new FormData(event.target)));
    },
    { signal: listeners.signal },
  );
  return submitted;
};

afterEach(() => {
  listeners.abort();
  listeners = new AbortController();
  document.querySelector("dialog")?.close();
  document.body.innerHTML = "";
});

describe("bar", () => {
  test("holds the Filters button, the count and the sort in one row on a wide screen, sort at the end", async () => {
    await page.viewport(1366, 800);
    render();
    const open = box(".collection-filters__open");
    const sort = box(".collection-filters__sort");
    expect(Math.abs(open.top - sort.top)).toBeLessThan(12);
    expect(box(".collection-filters__count").left).toBeGreaterThan(open.right);
    expect(sort.right).toBeCloseTo(box(".collection-filters__bar").right, 0);
  });

  test.each([320, 390])(
    "wraps on a phone at %ipx without widening the page",
    async (width) => {
      await page.viewport(width, 800);
      render();
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      expect(box(".collection-filters__sort").right).toBeLessThanOrEqual(width);
    },
  );

  test("puts the sort on its own line below the button on a narrow phone", async () => {
    await page.viewport(320, 800);
    render();
    expect(box(".collection-filters__sort").top).toBeGreaterThanOrEqual(
      box(".collection-filters__open").bottom,
    );
  });

  test("the Update button stays hidden until the sort is browsed with the keyboard", async () => {
    await page.viewport(1366, 800);
    render();
    const submitted = watchSubmits();
    expect(shown(".collection-filters__update")).toBe(false);
    document
      .getElementById("CollectionSort")
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
    const select = document.getElementById("CollectionSort");
    select.value = "price-ascending";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(shown(".collection-filters__update")).toBe(true);
    expect(submitted).toEqual([]);
  });
});

describe("sorting", () => {
  test("choosing a sort submits the applied filters with it, not edits made in the drawer", async () => {
    await page.viewport(1366, 800);
    render();
    const submitted = watchSubmits();
    document.getElementById("from").value = "5";
    const select = document.getElementById("CollectionSort");
    select.value = "price-ascending";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(submitted).toEqual([
      { "filter.v.availability": "1", sort_by: "price-ascending" },
    ]);
  });
});

describe("active filters", () => {
  test("show as chips with touch-sized targets, and wrap on a phone", async () => {
    await page.viewport(320, 800);
    render();
    for (const chip of document.querySelectorAll(".collection-filters__chip")) {
      expect(chip.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    }
    expect(box(".collection-filters__clear").height).toBeGreaterThanOrEqual(24);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
    const tops = [
      ...document.querySelectorAll(".collection-filters__chips li"),
    ].map((item) => Math.round(item.getBoundingClientRect().top));
    expect(new Set(tops).size).toBeGreaterThan(1);
  });
});

describe("drawer", () => {
  test("opens from the Filters button as a modal on the left, with Apply pinned under the body", async () => {
    await page.viewport(1366, 800);
    render();
    document.querySelector(".collection-filters__open").click();
    const drawer = document.getElementById("Drawer");
    expect(drawer.matches(":modal")).toBe(true);
    expect(box("#Drawer").left).toBe(0);
    expect(box("#Drawer").height).toBe(800);
    expect(box(".dialog__foot").bottom).toBeCloseTo(800, 0);
  });

  test("Apply submits the filters in it with the current sort, leaving empty fields out", async () => {
    await page.viewport(1366, 800);
    render();
    const submitted = watchSubmits();
    document.querySelector(".collection-filters__open").click();
    await userEvent.click(page.getByRole("button", { name: "Apply" }));
    expect(submitted).toEqual([
      { sort_by: "manual", "filter.v.price.lte": "15" },
    ]);
  });
});

describe("select form", () => {
  const submitWith = (attribute) => {
    document.body.innerHTML = `<select-form ${attribute}>
      <form method="get" id="search"><input name="note" value=""><input name="kept" value="x"><select name="a"><option>1</option></select></form>
    </select-form>`;
    const submitted = [];
    document.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();
        submitted.push(Object.fromEntries(new FormData(event.target)));
      },
      { signal: listeners.signal },
    );
    document.getElementById("search").requestSubmit();
    return submitted;
  };

  test("leaves empty fields out only when asked to", async () => {
    await page.viewport(1366, 800);
    expect(submitWith("data-skip-empty")).toEqual([{ kept: "x", a: "1" }]);
    expect(submitWith("")).toEqual([{ note: "", kept: "x", a: "1" }]);
  });

  test("typing in a text field next to a select doesn't count as browsing its options", async () => {
    await page.viewport(1366, 800);
    document.body.innerHTML = `<select-form><form method="get"><input id="t" name="t"><select id="s" name="a"><option value="1">1</option><option value="2">2</option></select><button class="u" type="submit">Update</button></form></select-form>`;
    const submitted = [];
    document.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();
        submitted.push(1);
      },
      { signal: listeners.signal },
    );
    document
      .getElementById("t")
      .dispatchEvent(new KeyboardEvent("keydown", { key: "5", bubbles: true }));
    const select = document.getElementById("s");
    select.value = "2";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(submitted).toHaveLength(1);
  });
});
