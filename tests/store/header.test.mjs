import { beforeAll, describe, expect, test } from "vitest";
import { get } from "./store.mjs";

let home, cart;
beforeAll(async () => {
  [home, cart] = await Promise.all([get("/"), get("/cart")]);
});

const group = (html) =>
  html.slice(html.indexOf('<div class="header-group">'), html.indexOf("<main"));

describe("header group", () => {
  test("holds the announcement bar first, then the header", () => {
    const html = group(home);
    const bar = html.indexOf('class="announcement ');
    const header = html.indexOf('<header class="site-header ');
    expect(bar).toBeGreaterThan(-1);
    expect(header).toBeGreaterThan(bar);
  });

  test("names the announcement bar so its text sits in a landmark", () => {
    expect(group(home)).toMatch(
      /class="announcement [^"]*"\s+role="region"\s+aria-label="Announcement"/,
    );
  });

  test("marks the page as having a sticky header", () => {
    expect(home).toMatch(/<html[^>]*class="[^"]*\bheader-sticky\b/);
    expect(cart).toMatch(/<html[^>]*class="[^"]*\bheader-sticky\b/);
  });

  test("labels the menu and marks the current page in the row and in the drawer", () => {
    const html = group(home);
    expect(html).toMatch(
      /<nav class="site-header__nav" aria-label="Main menu"/,
    );
    expect(html).toMatch(/<nav aria-label="Main menu">/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(2);
    expect(group(cart)).not.toMatch(/aria-current="page"/);
  });

  test("opens the phone menu from a button named for what it does", () => {
    const html = group(home);
    expect(html).toMatch(
      /<button[^>]*aria-label="Open menu"[^>]*data-dialog-open="MenuDrawer"/,
    );
    expect(html).toMatch(
      /<dialog\s+class="dialog dialog--drawer dialog--drawer-start"\s+id="MenuDrawer"/,
    );
  });

  test("every sub-menu button starts closed and points at a panel that exists", () => {
    const html = group(home);
    const toggles = html.match(/<button\s+class="menu__toggle"[^>]*>/g) ?? [];
    for (const toggle of toggles) {
      expect(toggle).toMatch(/aria-expanded="false"/);
      expect(toggle).toMatch(/aria-label="[^"]+ submenu"/);
      const id = toggle.match(/aria-controls="([^"]+)"/)?.[1];
      expect(html).toContain(`<ul class="menu__submenu" id="${id}">`);
      // The script and styles find the panel as the button's next sibling, inside a li marked data-submenu.
      expect(html).toMatch(
        new RegExp(
          `aria-controls="${id}"[^>]*>[\\s\\S]*?</button>\\s*<ul class="menu__submenu" id="${id}">`,
        ),
      );
    }
  });

  test("shows the account component with the customer account menu, and a plain link for no scripting", () => {
    const html = group(home);
    expect(html).toMatch(
      /<shopify-account\s+class="site-header__account"\s+menu="customer-account-main-menu"/,
    );
    expect(html).toMatch(/<span\s+slot="signed-out-avatar"/);
    expect(html).toMatch(
      /class="site-header__account-link"[\s\S]*?href="\/account"/,
    );
  });

  test("puts a labelled country selector in the header and at the bottom of the menu drawer", () => {
    const html = group(home);
    for (const id of ["Header", "Drawer"]) {
      const form = html.match(
        new RegExp(`<form[^>]*id="${id}-country-form"[^>]*>[\\s\\S]*?</form>`),
      )?.[0];
      expect(form, `${id} form`).toBeDefined();
      expect(form).toMatch(/action="\/localization"/);
      expect(form).toMatch(/method="post"/);
      expect(form).toMatch(/name="form_type"[^>]*value="localization"/);
      expect(form).toMatch(
        new RegExp(
          `<label class="field__label visually-hidden" for="${id}-country">Country or region</label>`,
        ),
      );
      expect(form).toMatch(/<select[^>]*name="country_code"/);
      expect(form.match(/<option[^>]*\sselected/g)).toHaveLength(1);
      expect(form).toMatch(
        /<option[^>]*aria-label="[^"]+ \([A-Z]{3}\)"[^>]*>\s*[A-Z]{2} · [A-Z]{3}\s*<\/option>/,
      );
      expect(form).toMatch(
        /class="link-button localization__update"[^>]*>\s*Update country or region\s*</,
      );
    }
    expect(html.indexOf('id="Drawer-country-form"')).toBeGreaterThan(
      html.indexOf('id="MenuDrawer"'),
    );
  });

  test("shows a language selector only when the store has more than one language", () => {
    const html = group(home);
    // The dev store sells in English and French; each selector lists every language with its own lang.
    expect(html.match(/name="language_code"/g)).toHaveLength(2);
    expect(
      html.match(
        /<option[^>]*lang="fr"[^>]*aria-label="Français"[^>]*>\s*FR\s*</g,
      ),
    ).toHaveLength(2);
    expect(html).toMatch(/>\s*Update language\s*</);
    expect(html).toMatch(/<form[^>]*id="Header-language-form"/);
    expect(html).toMatch(/for="Header-language">Language</);
  });

  test("gives every field and form in the header group its own id", () => {
    const ids = group(home).match(/\sid="[^"]+"/g);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("marks the shopper's country as selected", async () => {
    const us = group(await get("/?country=US"));
    expect(us).toMatch(/<option[^>]*value="US"[^>]*\sselected/);
    const au = group(await get("/?country=AU"));
    expect(au).toMatch(/<option[^>]*value="AU"[^>]*\sselected/);
  });

  test("keeps the cart icon region the cart script updates", () => {
    expect(group(home)).toMatch(
      /id="CartIcon-[^"]+" data-cart-region data-cart-icon/,
    );
  });

  test("opens the search modal from a link to the search page, so it works without the script", () => {
    expect(group(home)).toMatch(
      /<a[^>]*href="\/search"[^>]*aria-label="Search"[^>]*data-dialog-open="SearchModal"/,
    );
  });

  test("the search modal holds a labelled combobox that controls the results list", () => {
    const html = group(home);
    expect(html).toMatch(/<predictive-search data-url="\/search\/suggest">/);
    expect(html).toMatch(
      /<dialog\s+class="dialog search-modal"\s+id="SearchModal"\s+aria-label="Search"/,
    );
    expect(html).toMatch(/<label[^>]*for="SearchModal-field"/);
    const input = html.match(/<input[^>]*id="SearchModal-field"[^>]*>/s)[0];
    expect(input).toMatch(/role="combobox"/);
    expect(input).toMatch(/aria-expanded="false"/);
    expect(input).toMatch(/aria-controls="predictive-search-listbox"/);
    expect(input).toMatch(/autocomplete="off"/);
  });
});

const suggest = (q) =>
  get(
    `/search/suggest?q=${encodeURIComponent(q)}&section_id=predictive-search` +
      "&resources%5Btype%5D=query,product,collection,page,article" +
      "&resources%5Blimit%5D=8&resources%5Blimit_scope%5D=all",
  );

describe("predictive search results", () => {
  test("say so when nothing matches, and still link to the full results", async () => {
    const html = await suggest("zzqxjv");
    expect(html).toContain('data-summary="No results for “zzqxjv”"');
    expect(html).toMatch(/role="listbox"/);
    expect(html).not.toMatch(/predictive__heading/);
    expect(html).toMatch(
      /<a[^>]*role="option"[^>]*href="\/search"[^>]*data-search-all[^>]*>Search for “zzqxjv”<\/a>/,
    );
  });

  test("escape what was typed", async () => {
    const html = await suggest('<b>"x');
    expect(html).not.toContain("<b>");
    expect(html).toContain("No results for “&lt;b&gt;&quot;x”");
  });

  test("group a product under its heading, with its name, price and a placeholder image", async () => {
    const html = await suggest("Test regular");
    expect(html).toMatch(/id="predictive-search-products"[^>]*>Products</);
    expect(html).toMatch(
      /<a[^>]*class="predictive__option predictive__product"[^>]*role="option"[^>]*href="\/products\/test-regular[^"]*"/,
    );
    expect(html).toContain("predictive__placeholder");
    expect(html).toMatch(/data-summary="\d+ results?"/);
  });

  test("give every option a unique id for the field to point at", async () => {
    const html = await suggest("test");
    const ids = html.match(/id="predictive-search-option-\d+"/g);
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
