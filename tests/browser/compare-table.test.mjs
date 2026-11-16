import { afterEach, describe, expect, test, vi } from "vitest";
import "../../assets/compare-table.js";

const render = (buttons = [2, 3]) => {
  document.body.innerHTML = `
    <compare-table>
      ${
        buttons.length
          ? `<div class="compare__switch" hidden>${buttons
              .map(
                (column) =>
                  `<button type="button" aria-pressed="false" data-option="${column}">Column ${column}</button>`,
              )
              .join("")}</div>`
          : ""
      }
      <div class="compare__table"></div>
    </compare-table>`;
  return document.querySelector("compare-table");
};

const pressed = (table) =>
  [...table.querySelectorAll("button")].map((button) =>
    button.getAttribute("aria-pressed"),
  );

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("comparison table switch", () => {
  test("shows the switch and starts with the first other column", () => {
    const table = render();
    expect(table.querySelector(".compare__switch").hidden).toBe(false);
    expect(table.dataset.showing).toBe("2");
    expect(pressed(table)).toEqual(["true", "false"]);
  });

  test("shows the column of the button pressed", () => {
    const table = render();
    table.querySelectorAll("button")[1].click();
    expect(table.dataset.showing).toBe("3");
    expect(pressed(table)).toEqual(["false", "true"]);
  });

  test("keeps the choice when the same button is pressed again", () => {
    const table = render();
    table.querySelectorAll("button")[0].click();
    expect(table.dataset.showing).toBe("2");
    expect(pressed(table)).toEqual(["true", "false"]);
  });

  test("keeps the chosen column when the element is moved", () => {
    const table = render();
    table.querySelectorAll("button")[1].click();
    document.body.append(table);
    expect(table.dataset.showing).toBe("3");
    expect(pressed(table)).toEqual(["false", "true"]);
  });

  test("does nothing when the switch has no buttons", () => {
    document.body.innerHTML = `<compare-table><div class="compare__switch" hidden></div></compare-table>`;
    const table = document.querySelector("compare-table");
    expect(table.hasAttribute("data-showing")).toBe(false);
  });

  test("answers a press once after the element is moved", () => {
    const table = render();
    document.body.append(table);
    const show = vi.spyOn(table, "show");
    table.querySelectorAll("button")[1].click();
    expect(show).toHaveBeenCalledOnce();
  });

  test("does nothing when there is no switch", () => {
    const table = render([]);
    expect(table.hasAttribute("data-showing")).toBe(false);
  });
});
