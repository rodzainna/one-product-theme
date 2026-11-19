import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import "../../assets/search-form.js";

// What sections/search.liquid renders around the field; the form's submit is stopped so the page stays.
const render = (value = "") => {
  document.body.innerHTML = `
    <search-form>
      <form role="search" action="/search">
        <div class="search-field">
          <input type="search" name="q" value="${value}" data-field>
          <button type="button" data-clear ${value ? "" : "hidden"}>Clear</button>
        </div>
        <button type="submit">Search</button>
      </form>
    </search-form>`;
  const element = document.querySelector("search-form");
  const form = element.querySelector("form");
  const submits = [];
  form.addEventListener("submit", (event) => {
    submits.push(event.defaultPrevented);
    event.preventDefault();
  });
  return {
    element,
    form,
    submits,
    input: element.querySelector("[data-field]"),
    clear: element.querySelector("[data-clear]"),
  };
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("the Clear button", () => {
  test("is hidden until there is text, and hides again when the text is deleted", async () => {
    const ui = render();
    expect(ui.clear.hidden).toBe(true);
    await userEvent.type(ui.input, "tea");
    expect(ui.clear.hidden).toBe(false);
    await userEvent.clear(ui.input);
    expect(ui.clear.hidden).toBe(true);
  });

  test("empties the field, hides itself and returns focus to the field", async () => {
    const ui = render("tea");
    await userEvent.click(ui.clear);
    expect(ui.input.value).toBe("");
    expect(ui.clear.hidden).toBe(true);
    expect(document.activeElement).toBe(ui.input);
  });
});

describe("submitting", () => {
  test("shows the loader from the moment of the submit", async () => {
    const ui = render("tea");
    expect(ui.element.hasAttribute("data-loading")).toBe(false);
    ui.form.requestSubmit();
    expect(ui.element.hasAttribute("data-loading")).toBe(true);
    expect(ui.form.getAttribute("aria-busy")).toBe("true");
  });

  test("does nothing for a blank or spaces-only field", () => {
    const ui = render("   ");
    ui.form.requestSubmit();
    expect(ui.submits).toEqual([true]);
    expect(ui.element.hasAttribute("data-loading")).toBe(false);
  });

  test("clears the loader when the page is shown again from the cache", () => {
    const ui = render("tea");
    ui.form.requestSubmit();
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
    expect(ui.element.hasAttribute("data-loading")).toBe(false);
    expect(ui.form.hasAttribute("aria-busy")).toBe(false);
  });
});
