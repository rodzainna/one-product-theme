import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../../assets/accordion.js";

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
