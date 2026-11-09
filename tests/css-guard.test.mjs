import { describe, expect, test } from "vitest";
import { lintCss } from "../scripts/css-guard.mjs";

const rules = async (declaration) =>
  (await lintCss("a.css", `a { ${declaration}; }`)).map(({ rule }) => rule);

describe("rejects hard-coded values", () => {
  test.each([
    "font: 700 33px Georgia",
    "font-size: 33px",
    "font-size: var(--x, 33px)",
    "font-size: calc(var(--x) * 2)",
    "font-weight: 600",
    "font-weight: bold",
    "font-family: Georgia",
    "background: #fff",
    "background: red",
    "background: rgb(0 0 0 / 0.5)",
    "background-color: #fff",
    "border: 1px solid #ccc",
    "border-color: red",
    "outline: 3px solid #a8410f",
    "box-shadow: 0 0 4px #000",
    "color: #000",
    "color: hsl(0 0% 0%)",
    "color: color(display-p3 1 0 0)",
    "color: light-dark(var(--a), var(--b))",
    "color: device-cmyk(0 0 0 1)",
    "border-radius: 7px",
    "border-radius: var(--a) 7px",
    "border-top-left-radius: 7px",
    "z-index: 99",
    "transition: filter 0.2s ease",
    "transition: filter var(--duration) ease",
    "transition: filter 200ms var(--ease)",
    "transition-duration: 0.2s",
    "transition-timing-function: linear",
    "transition-timing-function: steps(4)",
    "transition-timing-function: linear(0, 1)",
    "animation: spin 1s linear infinite",
    "padding: 7px",
    "padding: 0.5rem 1.5rem",
    "padding: var(--x) 7px",
    "padding-inline: 1rem",
    "padding-top: 3px",
  ])("%s", async (declaration) => {
    const fired = await rules(declaration);
    expect(fired).not.toEqual([]);
    expect(fired).not.toContain("CssSyntaxError");
  });
});

describe("allows tokens and keywords", () => {
  test.each([
    "font-size: var(--text-body)",
    "font-size: inherit",
    "font-weight: var(--weight-ui)",
    "font-family: var(--font-body)",
    "font-family: inherit",
    "color: var(--color-foreground)",
    "color: inherit",
    "color: currentColor",
    "background: var(--color-button)",
    "background: transparent",
    "background: none",
    "background-color: var(--color-background)",
    "border: 2px solid var(--color-button)",
    "border: 0",
    "outline: 3px solid var(--color-accent)",
    "border-radius: var(--radius-card)",
    "border-radius: 0",
    "z-index: var(--layer-sticky)",
    "transition: filter var(--duration) var(--ease)",
    "transition: background-color var(--duration) var(--ease), translate var(--duration-slow) var(--ease)",
    "transition-duration: var(--duration)",
    "padding: var(--space-m)",
    "padding: var(--space-xs) var(--space-m)",
    "padding: 0",
    "padding: 0 var(--space-s)",
    "padding-inline: var(--space-m)",
  ])("%s", async (declaration) => {
    expect(await rules(declaration)).toEqual([]);
  });
});

test("config has no invalid rule options", async () => {
  expect(await rules("color: inherit")).not.toContain("invalid-option");
});
