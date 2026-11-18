import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import headerLiquid from "../../sections/header.liquid?raw";
import localizationLiquid from "../../snippets/localization-form.liquid?raw";
import "../../assets/localization.js";

const styles = (liquid) =>
  liquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

// What the snippet renders for two countries and two languages, in the header's tools row.
const render = () => {
  document.body.innerHTML = `
    <style>
      :root { --space-2xs: 4px; --space-xs: 8px; --space-m: 16px; --control-h: 44px; }
      ${styles(localizationLiquid)}
      ${styles(headerLiquid)}
    </style>
    <div class="site-header__tools">
      <div class="site-header__localization">
        <div class="localization">
          <localization-form>
            <form class="localization__form" action="/localization" method="post" id="country-form">
              <select name="country_code" id="country"><option value="AU" selected>Australia</option><option value="US">United States</option></select>
              <button class="link-button localization__update" type="submit">Update</button>
            </form>
          </localization-form>
          <localization-form>
            <form class="localization__form" action="/localization" method="post" id="language-form">
              <select name="language_code" id="language"><option value="en" selected>English</option><option value="fr">Français</option></select>
              <button class="link-button localization__update" type="submit">Update</button>
            </form>
          </localization-form>
        </div>
      </div>
    </div>`;
};

const choose = (select, value) => {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
};

// Counts the submissions and cancels them, so the test page stays put; the listener goes after each test.
let listeners = new AbortController();
const watchSubmits = () => {
  const submitted = [];
  document.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      submitted.push({
        form: event.target.id,
        data: Object.fromEntries(new FormData(event.target)),
      });
    },
    { signal: listeners.signal },
  );
  return submitted;
};

const press = (select, key) =>
  select.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

const shown = (selector) =>
  getComputedStyle(document.querySelector(selector)).display !== "none";

beforeEach(async () => {
  await page.viewport(1366, 800);
  render();
});

afterEach(() => {
  listeners.abort();
  listeners = new AbortController();
  document.body.innerHTML = "";
});

describe("choosing", () => {
  test("a country submits its form with the chosen code", () => {
    const submitted = watchSubmits();
    choose(document.getElementById("country"), "US");
    expect(submitted).toEqual([
      { form: "country-form", data: { country_code: "US" } },
    ]);
  });

  test("a language submits its own form, not the country's", () => {
    const submitted = watchSubmits();
    choose(document.getElementById("language"), "fr");
    expect(submitted).toEqual([
      { form: "language-form", data: { language_code: "fr" } },
    ]);
  });

  test("a change that isn't from a select does nothing", () => {
    const submitted = watchSubmits();
    const input = document.createElement("input");
    document.querySelector("#country-form").append(input);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(submitted).toEqual([]);
  });
});

describe("arrowing through the options", () => {
  test("doesn't reload the page for each option; it shows Update instead", () => {
    const submitted = watchSubmits();
    const select = document.getElementById("country");
    press(select, "ArrowDown");
    choose(select, "US");
    expect(submitted).toEqual([]);
    expect(shown("#country-form .localization__update")).toBe(true);
    expect(shown("#language-form .localization__update")).toBe(false);
  });

  test("pressing Enter or clicking a choice still submits straight away", () => {
    const submitted = watchSubmits();
    const select = document.getElementById("country");
    press(select, "ArrowDown");
    press(select, "Enter");
    choose(select, "US");
    press(select, "ArrowDown");
    select.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    choose(select, "AU");
    expect(submitted.map((item) => item.data.country_code)).toEqual([
      "US",
      "AU",
    ]);
  });
});

describe("layout", () => {
  test("the Update button is for visitors without scripting only", () => {
    expect(shown(".localization__update")).toBe(false);
  });

  test("the selectors show in the header where the row has room for them", async () => {
    expect(shown(".site-header__localization")).toBe(true);
    await page.viewport(1024, 800);
    expect(shown(".site-header__localization")).toBe(true);
  });

  test("and leave the header below 1024px, where the menu drawer holds them on phones", async () => {
    await page.viewport(1023, 800);
    expect(shown(".site-header__localization")).toBe(false);
    await page.viewport(390, 800);
    expect(shown(".site-header__localization")).toBe(false);
  });
});
