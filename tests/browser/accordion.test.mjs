import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../../assets/accordion.js";
import criticalCss from "../../assets/critical.css?raw";
import itemLiquid from "../../snippets/accordion-item.liquid?raw";

const itemCss =
  itemLiquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

// Shopify wraps each theme block in a div, and the editor fires its events on that div.
const item = (question, { group = "faq", open = false } = {}) => `
  <div class="shopify-block"><details class="accordion__item" ${group ? `name="${group}"` : ""} ${open ? "open" : ""}>
    <summary class="accordion__trigger"><h3 class="accordion__heading">${question}</h3></summary>
    <div class="accordion__content"><p>Answer to ${question}</p></div>
  </details></div>`;

const render = (html) => {
  document.body.innerHTML = html;
  return [...document.querySelectorAll("details")];
};

const select = (element) =>
  element.dispatchEvent(
    new CustomEvent("shopify:block:select", { bubbles: true }),
  );

afterEach(() => {
  document.body.innerHTML = "";
});

describe("accordion items", () => {
  test("items with the same name open one at a time", async () => {
    const [first, second] = render(
      item("First", { open: true }) + item("Second"),
    );
    await userEvent.click(page.getByText("Second", { exact: true }));
    expect(second.open).toBe(true);
    expect(first.open).toBe(false);
  });

  test("items without a name stay open independently", async () => {
    const [first, second] = render(
      item("First", { group: "", open: true }) + item("Second", { group: "" }),
    );
    await userEvent.click(page.getByText("Second", { exact: true }));
    expect(first.open).toBe(true);
    expect(second.open).toBe(true);
  });

  test("selecting a block in the theme editor opens its item and closes the other", () => {
    const [first, second] = render(
      item("First", { open: true }) + item("Second"),
    );
    select(second.parentElement);
    expect(second.open).toBe(true);
    expect(first.open).toBe(false);
  });

  test("selecting a block that only contains items, such as a category, opens none of them", () => {
    const [first] = render(
      `<div class="shopify-block" id="category"><section>${item("First")}</section></div>`,
    );
    select(document.getElementById("category"));
    expect(first.open).toBe(false);
  });

  test("selecting a block that isn't an accordion item changes nothing", () => {
    const [first] = render(item("First") + "<div id='other'></div>");
    select(document.getElementById("other"));
    expect(first.open).toBe(false);
  });
});

describe("a long unbroken word in a question", () => {
  test("wraps beside the icon instead of pushing it off the screen", () => {
    document.body.innerHTML = `
      <style>${criticalCss} body { margin: 0 } ${itemCss}</style>
      <div id="list" style="width: 300px">
        <details class="accordion__item">
          <summary class="accordion__trigger">
            <h3 class="accordion__heading">${"Supercalifragilisticexpialidocious".repeat(3)}</h3>
            <span class="accordion__icon"><svg width="16" height="16"></svg></span>
          </summary>
        </details>
      </div>`;
    const list = document.getElementById("list").getBoundingClientRect();
    const icon = document
      .querySelector(".accordion__icon")
      .getBoundingClientRect();
    expect(icon.right).toBeLessThanOrEqual(list.right);
    expect(document.getElementById("list").scrollWidth).toBeLessThanOrEqual(
      300,
    );
  });
});
