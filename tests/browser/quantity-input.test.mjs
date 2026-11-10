import { beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../../assets/quantity-input.js";

const render = ({
  value = 1,
  min = 1,
  max = "",
  step = 1,
  disabled = false,
} = {}) => {
  document.body.innerHTML = `
    <label for="qty">Quantity</label>
    <quantity-input>
      <button type="button" aria-label="Decrease quantity" data-quantity-step="-1"></button>
      <input id="qty" type="number" value="${value}" min="${min}" max="${max}" step="${step}" ${disabled ? "disabled" : ""}>
      <button type="button" aria-label="Increase quantity" data-quantity-step="1"></button>
      <span aria-live="polite"></span>
    </quantity-input>
  `;
};

const input = () => page.getByLabelText("Quantity");
const minus = () => page.getByRole("button", { name: "Decrease quantity" });
const plus = () => page.getByRole("button", { name: "Increase quantity" });
const status = () => document.querySelector("[aria-live]");

const type = async (text) => {
  await userEvent.fill(input(), text);
  await userEvent.tab();
};

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("buttons", () => {
  test("minus is aria-disabled at the minimum", async () => {
    render();
    await expect.element(minus()).toHaveAttribute("aria-disabled", "true");
    await expect.element(plus()).toHaveAttribute("aria-disabled", "false");
  });

  test("plus adds one step and fires a bubbling change", async () => {
    render({ step: 2 });
    let changes = 0;
    document.body.addEventListener("change", () => changes++);
    await userEvent.click(plus());
    await expect.element(input()).toHaveValue(3);
    expect(changes).toBe(1);
    await expect.element(minus()).toHaveAttribute("aria-disabled", "false");
  });

  test("plus stops at the maximum and keeps keyboard focus", async () => {
    render({ value: 4, max: 5 });
    plus().element().focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(input()).toHaveValue(5);
    await expect.element(plus()).toHaveAttribute("aria-disabled", "true");
    await expect.element(plus()).toHaveFocus();
    let changes = 0;
    document.body.addEventListener("change", () => changes++);
    await userEvent.keyboard("{Enter}");
    await expect.element(input()).toHaveValue(5);
    expect(changes).toBe(0);
  });

  test("minus subtracts one step", async () => {
    render({ value: 3 });
    await userEvent.click(minus());
    await expect.element(input()).toHaveValue(2);
  });

  test("a button press announces the new value", async () => {
    render();
    await userEvent.click(plus());
    await expect.poll(() => status().textContent).toBe("2");
  });

  test("a button press fires input as well as change", async () => {
    render();
    let inputs = 0;
    document.body.addEventListener("input", () => inputs++);
    await userEvent.click(plus());
    expect(inputs).toBe(1);
  });

  test("buttons follow attribute changes made by script", async () => {
    render({ value: 2 });
    input().element().disabled = true;
    await expect.element(plus()).toHaveAttribute("aria-disabled", "true");
    input().element().disabled = false;
    input().element().max = "2";
    await expect.element(plus()).toHaveAttribute("aria-disabled", "true");
    input().element().removeAttribute("max");
    let changes = 0;
    document.body.addEventListener("change", () => changes++);
    input().element().min = "4";
    await expect.element(input()).toHaveValue(4);
    expect(changes).toBe(1);
    await expect.poll(() => status().textContent).toBe("4");
  });

  test("buttons do nothing once the input is disabled later", async () => {
    render({ value: 2 });
    input().element().disabled = true;
    let changes = 0;
    document.body.addEventListener("change", () => changes++);
    plus().element().click();
    await expect.element(input()).toHaveValue(2);
    expect(changes).toBe(0);
  });

  test("both are aria-disabled when the input is disabled", async () => {
    render({ value: 2, disabled: true });
    await expect.element(minus()).toHaveAttribute("aria-disabled", "true");
    await expect.element(plus()).toHaveAttribute("aria-disabled", "true");
  });
});

describe("typed values", () => {
  test.each([
    ["0", 1, "below the minimum goes to the minimum"],
    ["", 1, "empty goes to the minimum"],
    ["4", 5, "off-step rounds to the nearest step"],
    ["99", 7, "above the maximum goes to the highest step"],
  ])("%s → %i: %s", async (text, expected) => {
    render({ min: 1, max: 8, step: 2 });
    await type(text);
    await expect.element(input()).toHaveValue(expected);
    await expect.poll(() => status().textContent).toBe(String(expected));
  });

  test("a max below the min holds the min with both buttons off", async () => {
    render({ min: 6, max: 2, step: 6 });
    await expect.element(input()).toHaveValue(6);
    await expect.element(minus()).toHaveAttribute("aria-disabled", "true");
    await expect.element(plus()).toHaveAttribute("aria-disabled", "true");
  });

  test("a min that isn't a number falls back to 1", async () => {
    render({ min: "abc", value: 3 });
    await expect.element(input()).toHaveValue(3);
    await userEvent.click(minus());
    await userEvent.click(minus());
    await expect.element(input()).toHaveValue(1);
  });

  test("a valid typed value isn't announced", async () => {
    render({ max: 8 });
    await type("3");
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    );
    expect(status().textContent).toBe("");
  });

  test("typing the maximum disables plus before the field loses focus", async () => {
    render({ max: 3 });
    await userEvent.fill(input(), "3");
    await expect.element(input()).toHaveFocus();
    await expect.element(plus()).toHaveAttribute("aria-disabled", "true");
  });
});
