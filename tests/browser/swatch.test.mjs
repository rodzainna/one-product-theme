import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import pillGroupLiquid from "../../snippets/pill-group.liquid?raw";

const stylesheet =
  pillGroupLiquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

// The markup pill-group renders when every value has a swatch, with the kit's token values.
const render = () => {
  document.body.innerHTML = `
    <style>
      :root { --control-h: 44px; --control-h-sm: 32px; --swatch-inset: 3px; --radius-full: 999px;
        --color-foreground: rgb(34, 34, 34); --color-background: rgb(255, 255, 255);
        --color-control-border: rgb(120, 120, 120); --focus-ring: 2px solid rgb(0, 0, 255);
        --focus-offset: 2px; --duration: 0s; --ease: ease; --space-xs: 8px; --field-gap: 4px; }
      * { box-sizing: border-box; }
      ${stylesheet}
    </style>
    <fieldset class="pill-group">
      <legend>Colour: <span class="pill-group__picked" aria-hidden="true">White</span></legend>
      <div class="pill-group__row">
        <label class="swatch" title="White"><input type="radio" name="c" value="White" checked><span class="swatch__chip" style="--swatch-color: rgb(255, 255, 255)"></span><span class="visually-hidden">White</span></label>
        <label class="swatch swatch--unavailable" title="Ember"><input type="radio" name="c" value="Ember"><span class="swatch__chip" style="--swatch-color: rgb(168, 65, 15)"></span><span class="visually-hidden">Ember (Sold out)</span></label>
      </div>
    </fieldset>
  `;
};

const chip = (name) =>
  document.querySelector(`input[value="${name}"] + .swatch__chip`);
const style = (element, pseudo) => getComputedStyle(element, pseudo);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("swatch", () => {
  test("an image swatch is placed at its focal point, centred without one", () => {
    render();
    chip("White").style.setProperty("--swatch-position", "20% 80%");
    expect(style(chip("White")).backgroundPosition).toBe("20% 80%");
    expect(style(chip("Ember")).backgroundPosition).toBe("50% 50%");
  });

  test("is a 44px round chip filled with its colour, inset 3px", () => {
    render();
    const box = chip("White").getBoundingClientRect();
    expect([box.width, box.height]).toEqual([44, 44]);
    expect(style(chip("White")).borderTopLeftRadius).toBe("999px");
    expect(style(chip("Ember")).backgroundColor).toBe("rgb(168, 65, 15)");
    expect(style(chip("White")).paddingTop).toBe("3px");
  });

  test("has a hairline so a pale colour stays visible", () => {
    render();
    expect(style(chip("White"), "::after").borderTopColor).toBe(
      "rgb(120, 120, 120)",
    );
  });

  test("the picked one gets a foreground ring; the others don't", () => {
    render();
    expect(style(chip("White")).borderTopColor).toBe("rgb(34, 34, 34)");
    expect(style(chip("Ember")).borderTopColor).toBe("rgba(0, 0, 0, 0)");
  });

  test("a sold-out one is struck through and stays selectable", async () => {
    render();
    expect(style(chip("Ember"), "::before").backgroundImage).toContain(
      "linear-gradient",
    );
    expect(style(chip("White"), "::before").backgroundImage).toBe("none");
    await userEvent.click(
      page.getByText("Ember (Sold out)").element().closest("label"),
    );
    expect(document.querySelector('input[value="Ember"]').checked).toBe(true);
  });

  test("is named by its value, sold out included", async () => {
    render();
    await expect
      .element(page.getByRole("radio", { name: "Ember (Sold out)" }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("radio", { name: "White" }))
      .toBeChecked();
  });

  test("shows the focus ring on the chip when the radio has keyboard focus", async () => {
    render();
    await userEvent.tab();
    expect(document.activeElement.value).toBe("White");
    expect(style(chip("White")).outlineStyle).toBe("solid");
    expect(style(chip("Ember")).outlineStyle).toBe("none");
  });
});
