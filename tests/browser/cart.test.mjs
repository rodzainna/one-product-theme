import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../../assets/dialog.js";
import "../../assets/quantity-input.js";
import "../../assets/cart.js";

const KEY = "111:aaa";
const OTHER = "222:bbb";

// A cart line as cart-line.liquid renders it, inside the cart form.
const line = (key, quantity) => `
  <li><quantity-input><button type="button" data-quantity-step="-1" aria-label="Less ${key}">-</button><input id="Qty-${key}" type="number" name="updates[${key}]" value="${quantity}" min="1" data-line-key="${key}" aria-label="Quantity ${key}"><button type="button" data-quantity-step="1" aria-label="More ${key}">+</button></quantity-input>
  <a class="cart-line__remove" href="/cart/change?id=${key}&quantity=0" data-line-key="${key}">Remove ${key}</a></li>`;

const drawerSection = (lines = "", heading = "") => `
  <div id="shopify-section-cart-drawer" class="shopify-section">
    <dialog id="CartDrawer" class="dialog"><h2>Your cart</h2>
      <div id="CartDrawerLines" tabindex="-1" data-cart-region data-cart-focus>${heading}
        <form id="CartDrawerForm" action="/cart" method="post" data-cart-form><ul>${lines}</ul>
          <p role="alert" data-cart-error data-message="Your cart couldn't be updated."></p>
          <button type="submit" data-cart-update>Update</button></form>
      </div>
      <p role="status" data-cart-status data-added="[title] added to your cart."></p>
      <div id="CartDrawerSummary" data-cart-region>
        <details id="CartDrawerNote" data-cart-keep><summary>Add a note</summary>
          <textarea id="CartNote" name="note" form="CartDrawerForm" data-cart-note></textarea></details>
        <button type="submit" name="checkout" form="CartDrawerForm">Check out</button>
      </div>
    </dialog>
  </div>`;

const headerSection = (count = 0) => `
  <div id="shopify-section-sections--1__header" class="shopify-section">
    <span id="CartIcon" data-cart-region data-cart-icon><a href="/cart" aria-label="Cart, ${count} items">Cart ${count}</a></span>
  </div>`;

const productForm = `
  <form action="/cart/add" method="post" id="ProductForm">
    <input type="hidden" name="id" value="99">
    <button type="submit" name="add" id="Product-add-1">Add to cart</button>
    <p role="alert" data-cart-error data-message="Your cart couldn't be updated."></p>
  </form>`;

const render = ({ withDrawer = true, lines = "" } = {}) => {
  document.body.innerHTML = `${headerSection()}${productForm}${withDrawer ? drawerSection(lines) : ""}`;
};

// What the Section Rendering API returns for the drawer and header after a change.
const sections = (lines, count) => ({
  "cart-drawer": drawerSection(lines, `<p>Fresh ${count}</p>`),
  "sections--1__header": headerSection(count),
});

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// The cart itself, as /cart.js returns it, for the events' promises.
const ajaxCart = {
  token: "t",
  item_count: 1,
  items: [{ key: "111:aaa", quantity: 1 }],
};
const mockFetch = (handler) =>
  vi
    .spyOn(window, "fetch")
    .mockImplementation((url, init) =>
      String(url).endsWith("/cart.js")
        ? Promise.resolve(json(ajaxCart))
        : handler(url, init),
    );
// The requests that change the cart, without the /cart.js reads behind the events.
const requests = (fetch) =>
  fetch.mock.calls.filter(([url]) => !String(url).endsWith("/cart.js"));

const submit = (form, submitter) => {
  const event = new SubmitEvent("submit", {
    bubbles: true,
    cancelable: true,
    submitter,
  });
  form.dispatchEvent(event);
  return event;
};

afterEach(() => {
  document.querySelector("dialog[open]")?.close();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("add to cart", () => {
  test("posts the form with the cart's sections, swaps them in, opens the drawer and announces", async () => {
    render();
    const fetch = mockFetch(async () =>
      json({ title: "Test regular", sections: sections(line(KEY, 1), 1) }),
    );
    const button = page.getByRole("button", { name: "Add to cart" }).element();
    const event = submit(document.getElementById("ProductForm"), button);
    expect(event.defaultPrevented).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");

    const drawer = document.getElementById("CartDrawer");
    await expect.poll(() => drawer.open).toBe(true);
    const [url, init] = requests(fetch)[0];
    expect(url).toBe("/cart/add.js");
    expect(init.body.get("id")).toBe("99");
    expect(init.body.get("sections").split(",").sort()).toEqual([
      "cart-drawer",
      "sections--1__header",
    ]);
    expect(document.getElementById("CartIcon").textContent).toContain("Cart 1");
    expect(drawer.querySelector("[data-line-key]")).not.toBeNull();
    await expect
      .poll(() => drawer.querySelector("[data-cart-status]").textContent)
      .toBe("Test regular added to your cart.");
    expect(button.hasAttribute("aria-busy")).toBe(false);
  });

  test("closing the drawer focuses Add to cart again, even after the buy box was re-rendered", async () => {
    render();
    mockFetch(async () =>
      json({ title: "Test regular", sections: sections(line(KEY, 1), 1) }),
    );
    const button = page.getByRole("button", { name: "Add to cart" }).element();
    button.focus();
    submit(document.getElementById("ProductForm"), button);
    const drawer = document.getElementById("CartDrawer");
    await expect.poll(() => drawer.open).toBe(true);

    button.replaceWith(button.cloneNode(true));
    drawer.close();
    await expect.poll(() => document.activeElement?.id).toBe("Product-add-1");
    expect(document.activeElement).not.toBe(button);
  });

  test("closing the drawer leaves focus alone when the browser already returned it", async () => {
    render();
    mockFetch(async () =>
      json({ title: "Test regular", sections: sections(line(KEY, 1), 1) }),
    );
    const button = page.getByRole("button", { name: "Add to cart" }).element();
    button.focus();
    submit(document.getElementById("ProductForm"), button);
    const drawer = document.getElementById("CartDrawer");
    await expect.poll(() => drawer.open).toBe(true);

    drawer.close();
    await expect.poll(() => drawer.open).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  test("shows Shopify's reason and leaves the drawer closed when the add fails", async () => {
    render();
    mockFetch(async () =>
      json(
        { status: 422, description: "All 2 Test regular are in your cart." },
        422,
      ),
    );
    submit(document.getElementById("ProductForm"));
    const error = document.querySelector("#ProductForm [data-cart-error]");
    await expect
      .poll(() => error.textContent)
      .toBe("All 2 Test regular are in your cart.");
    expect(document.getElementById("CartDrawer").open).toBe(false);
  });

  test("a failed request shows the theme's message", async () => {
    render();
    mockFetch(async () => {
      throw new TypeError("offline");
    });
    submit(document.getElementById("ProductForm"));
    const error = document.querySelector("#ProductForm [data-cart-error]");
    await expect
      .poll(() => error.textContent)
      .toBe("Your cart couldn't be updated.");
  });

  test("leaves the submit alone when the variant is still loading or there's no drawer", () => {
    render();
    const fetch = mockFetch(async () => json({}));
    const form = document.getElementById("ProductForm");
    form.addEventListener("submit", (event) => event.preventDefault(), {
      once: true,
    });
    submit(form);
    expect(requests(fetch)).toHaveLength(0);

    render({ withDrawer: false });
    const native = document.getElementById("ProductForm");
    const event = new SubmitEvent("submit", {
      bubbles: true,
      cancelable: true,
    });
    let prevented;
    // Read before anything else cancels it, then stop the real navigation.
    document.addEventListener(
      "submit",
      (e) => {
        prevented = e.defaultPrevented;
        e.preventDefault();
      },
      { once: true },
    );
    native.dispatchEvent(event);
    expect(prevented).toBe(false);
    expect(requests(fetch)).toHaveLength(0);
  });

  test("a second press while adding is ignored", async () => {
    render();
    let release;
    const fetch = mockFetch(
      () =>
        new Promise(
          (resolve) => (release = () => resolve(json({ sections: {} }))),
        ),
    );
    const form = document.getElementById("ProductForm");
    const button = form.querySelector("button");
    submit(form, button);
    submit(form, button);
    await expect.poll(() => requests(fetch).length).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requests(fetch)).toHaveLength(1);
    release();
    await expect.poll(() => button.hasAttribute("aria-busy")).toBe(false);
  });
});

describe("cart lines", () => {
  test("quantity changes save once, after the shopper stops", async () => {
    render({ lines: line(KEY, 1) + line(OTHER, 1) });
    const fetch = mockFetch(async () =>
      json({ sections: sections(line(KEY, 3), 3) }),
    );
    const input = document.getElementById(`Qty-${KEY}`);
    for (const value of ["2", "3"]) {
      input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await expect.poll(() => requests(fetch).length).toBe(1);
    const [url, init] = requests(fetch)[0];
    expect(url).toBe("/cart/change.js");
    expect(JSON.parse(init.body)).toMatchObject({ id: KEY, quantity: 3 });
    await expect
      .poll(() => document.querySelector("#CartDrawerLines p")?.textContent)
      .toBe("Fresh 3");
  });

  test("Remove saves 0 instead of following the link", async () => {
    render({ lines: line(KEY, 1) });
    const fetch = mockFetch(async () => json({ sections: sections("", 0) }));
    const link = document.querySelector(".cart-line__remove");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await expect.poll(() => requests(fetch).length).toBe(1);
    expect(JSON.parse(requests(fetch)[0][1].body)).toMatchObject({
      id: KEY,
      quantity: 0,
    });
  });

  test("focus on a removed line moves to the cart instead of the page", async () => {
    render({ lines: line(KEY, 1) });
    openDrawer();
    mockFetch(async () => json({ sections: sections("", 0) }));
    const link = document.querySelector(".cart-line__remove");
    link.focus();
    link.click();
    await expect.poll(() => document.activeElement?.id).toBe("CartDrawerLines");
  });

  test("a failed change reloads the cart as Shopify has it and says why", async () => {
    render({ lines: line(KEY, 1) });
    const fetch = mockFetch(async (url) =>
      String(url).includes("change.js")
        ? json({ status: 422, description: "Only 5 left." }, 422)
        : json(sections(line(KEY, 1), 1)),
    );
    const input = document.getElementById(`Qty-${KEY}`);
    input.value = "9";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await expect.poll(() => requests(fetch).length).toBe(2);
    expect(requests(fetch)[1][0]).toMatch(/\?sections=/);
    await expect
      .poll(
        () =>
          document.querySelector("#CartDrawerForm [data-cart-error]")
            .textContent,
      )
      .toBe("Only 5 left.");
    expect(document.getElementById(`Qty-${KEY}`).value).toBe("1");
  });

  test("Enter in a quantity saves it now; Check out still submits", async () => {
    render({ lines: line(KEY, 1) });
    openDrawer();
    const fetch = mockFetch(async () =>
      json({ sections: sections(line(KEY, 4), 4) }),
    );
    const input = document.getElementById(`Qty-${KEY}`);
    input.focus();
    input.value = "4";
    const form = document.getElementById("CartDrawerForm");
    expect(
      submit(form, form.querySelector("[data-cart-update]")).defaultPrevented,
    ).toBe(true);
    await expect.poll(() => requests(fetch).length).toBe(1);
    await expect
      .poll(() => document.querySelector("#CartDrawerLines p")?.textContent)
      .toBe("Fresh 4");

    let prevented;
    document.addEventListener(
      "submit",
      (e) => {
        prevented = e.defaultPrevented;
        e.preventDefault();
      },
      { once: true },
    );
    document.getElementById("CartDrawerForm").dispatchEvent(
      new SubmitEvent("submit", {
        bubbles: true,
        cancelable: true,
        submitter: document.querySelector('[name="checkout"]'),
      }),
    );
    expect(prevented).toBe(false);
  });
});

describe("review fixes", () => {
  test("Remove cancels that line's pending quantity change", async () => {
    render({ lines: line(KEY, 1) });
    const fetch = mockFetch(async () => json({ sections: sections("", 0) }));
    const input = document.getElementById(`Qty-${KEY}`);
    input.value = "2";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector(".cart-line__remove").click();
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(requests(fetch)).toHaveLength(1);
    expect(JSON.parse(requests(fetch)[0][1].body).quantity).toBe(0);
  });

  test("clearing a quantity field keeps the line at its minimum instead of removing it", async () => {
    render({ lines: line(KEY, 3) });
    openDrawer();
    const fetch = mockFetch(async () =>
      json({ sections: sections(line(KEY, 1), 1) }),
    );
    const input = document.getElementById(`Qty-${KEY}`);
    input.focus();
    input.value = "";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await expect.poll(() => requests(fetch).length).toBe(1);
    expect(JSON.parse(requests(fetch)[0][1].body).quantity).toBe(1);
  });

  test("keyboard focus stays on the same stepper button after a line saves", async () => {
    render({ lines: line(KEY, 1) + line(OTHER, 1) });
    openDrawer();
    const fetch = mockFetch(async () =>
      json({ sections: sections(line(KEY, 2) + line(OTHER, 1), 2) }),
    );
    const plus = document.querySelector(`[aria-label="More ${KEY}"]`);
    plus.focus();
    plus.click();
    await expect
      .poll(() => document.querySelector("#CartDrawerLines p")?.textContent)
      .toBe("Fresh 2");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      `More ${KEY}`,
    );
  });

  test("what is being typed in one line survives another line's response", async () => {
    render({ lines: line(KEY, 1) + line(OTHER, 1) });
    openDrawer();
    const fetch = mockFetch(async () =>
      json({ sections: sections(line(KEY, 2) + line(OTHER, 1), 2) }),
    );
    const first = document.getElementById(`Qty-${KEY}`);
    first.value = "2";
    first.dispatchEvent(new Event("change", { bubbles: true }));
    const second = document.getElementById(`Qty-${OTHER}`);
    second.focus();
    second.value = "12";
    await expect.poll(() => requests(fetch).length).toBe(1);
    await expect
      .poll(() => document.querySelector("#CartDrawerLines p")?.textContent)
      .toBe("Fresh 2");
    expect(document.getElementById(`Qty-${OTHER}`).value).toBe("12");
    expect(document.activeElement.id).toBe(`Qty-${OTHER}`);
    await expect.poll(() => requests(fetch).length).toBe(2);
    expect(JSON.parse(requests(fetch)[1][1].body)).toMatchObject({
      id: OTHER,
      quantity: 12,
    });
  });

  test("a quantity the server changes isn't saved again", async () => {
    render({ lines: line(KEY, 1) });
    openDrawer();
    const fetch = mockFetch(async () =>
      json({ sections: sections(line(KEY, 5), 5) }),
    );
    const input = document.getElementById(`Qty-${KEY}`);
    input.focus();
    input.value = "12";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await expect.poll(() => requests(fetch).length).toBe(1);
    await expect
      .poll(() => document.getElementById(`Qty-${KEY}`).value)
      .toBe("5");
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(requests(fetch)).toHaveLength(1);
  });

  test("Add to cart waits for a change that is still saving", async () => {
    render({ lines: line(KEY, 1) });
    const order = [];
    let release;
    mockFetch((url) => {
      order.push(String(url));
      if (String(url).includes("change.js"))
        return new Promise(
          (resolve) =>
            (release = () =>
              resolve(json({ sections: sections(line(KEY, 2), 2) }))),
        );
      return Promise.resolve(
        json({ title: "A", sections: sections(line(KEY, 2), 3) }),
      );
    });
    const input = document.getElementById(`Qty-${KEY}`);
    input.value = "2";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await expect.poll(() => order.length).toBe(1);
    submit(
      document.getElementById("ProductForm"),
      page.getByRole("button", { name: "Add to cart" }).element(),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(order).toEqual(["/cart/change.js"]);
    release();
    await expect.poll(() => order.length).toBe(2);
    expect(order[1]).toBe("/cart/add.js");
  });
});

const cleanups = [];
afterEach(() => cleanups.splice(0).forEach((fn) => fn()));
const heard = (name) => {
  const events = [];
  const listener = (event) => events.push(event);
  document.addEventListener(name, listener);
  cleanups.push(() => document.removeEventListener(name, listener));
  return events;
};

describe("standard cart events", () => {
  test("an add announces itself before the request and settles with the cart", async () => {
    render();
    const events = heard("shopify:cart:lines-update");
    let requestsAtEvent;
    const fetch = mockFetch(async () =>
      json({ title: "A", sections: sections(line(KEY, 1), 1) }),
    );
    document.addEventListener(
      "shopify:cart:lines-update",
      () => (requestsAtEvent = requests(fetch).length),
      { once: true },
    );
    submit(
      document.getElementById("ProductForm"),
      page.getByRole("button", { name: "Add to cart" }).element(),
    );
    await expect.poll(() => events.length).toBe(1);
    const [event] = events;
    expect(requestsAtEvent).toBe(0);
    expect(event.action).toBe("add");
    expect(event.context).toBe("product");
    expect(event.lines).toEqual([{ merchandiseId: "99", quantity: 1 }]);
    expect(event.target.getAttribute("id")).toBe("ProductForm");
    const { cart, userErrors } = await event.promise;
    expect(cart.totalQuantity).toBe(1);
    expect(userErrors).toEqual([]);
  });

  test("a quantity change and a Remove say what changed, from the drawer", async () => {
    render({ lines: line(KEY, 1) });
    openDrawer();
    const events = heard("shopify:cart:lines-update");
    mockFetch(async () =>
      json({ ...ajaxCart, sections: sections(line(KEY, 3), 3) }),
    );
    const input = document.getElementById(`Qty-${KEY}`);
    input.value = "3";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await expect.poll(() => events.length).toBe(1);
    expect(events[0]).toMatchObject({
      action: "update",
      context: "dialog",
      lines: [{ id: KEY, quantity: 3 }],
    });
    await events[0].promise;
    document.querySelector(".cart-line__remove").click();
    await expect.poll(() => events.length).toBe(2);
    expect(events[1]).toMatchObject({
      action: "remove",
      lines: [{ id: KEY, quantity: 0 }],
    });
  });

  test("a change Shopify declines settles with the reason and sends no error event", async () => {
    render({ lines: line(KEY, 1) });
    openDrawer();
    const events = heard("shopify:cart:lines-update");
    const errors = heard("shopify:cart:error");
    mockFetch(async (url) =>
      String(url).includes("change.js")
        ? json({ status: 422, description: "Only 5 left." }, 422)
        : json(sections(line(KEY, 1), 1)),
    );
    const input = document.getElementById(`Qty-${KEY}`);
    input.value = "9";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await expect.poll(() => events.length).toBe(1);
    const { userErrors } = await events[0].promise;
    expect(userErrors[0].message).toBe("Only 5 left.");
    expect(errors).toHaveLength(0);
  });

  test("a failed request rejects the promise and sends an error event; the cart still shows the problem", async () => {
    render({ lines: line(KEY, 1) });
    openDrawer();
    const events = heard("shopify:cart:lines-update");
    const errors = heard("shopify:cart:error");
    mockFetch(async (url) => {
      if (String(url).includes("change.js")) throw new TypeError("offline");
      return json(sections(line(KEY, 1), 1));
    });
    const input = document.getElementById(`Qty-${KEY}`);
    input.value = "2";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await expect.poll(() => events.length).toBe(1);
    await expect(events[0].promise).rejects.toThrow("offline");
    expect(errors).toHaveLength(1);
    expect(errors[0].error).toBe("offline");
    await expect
      .poll(
        () =>
          document.querySelector("#CartDrawerForm [data-cart-error]")
            .textContent,
      )
      .toBe("Your cart couldn't be updated.");
  });

  test("the note announces its change", async () => {
    render({ lines: line(KEY, 1) });
    openDrawer();
    const events = heard("shopify:cart:note-update");
    mockFetch(async () => json(ajaxCart));
    document.getElementById("CartDetails")?.setAttribute("open", "");
    const note = document.getElementById("CartNote");
    note.value = "Gift";
    note.dispatchEvent(new Event("input", { bubbles: true }));
    await expect.poll(() => events.length).toBe(1);
    expect(events[0]).toMatchObject({ context: "dialog", note: "Gift" });
    expect((await events[0].promise).cart.totalQuantity).toBe(1);
  });

  test("failing to describe the change to listeners doesn't stop the cart", async () => {
    render();
    const events = heard("shopify:cart:lines-update");
    vi.spyOn(window, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/cart.js")) throw new TypeError("no cart");
      return json({ title: "A", sections: sections(line(KEY, 1), 1) });
    });
    submit(
      document.getElementById("ProductForm"),
      page.getByRole("button", { name: "Add to cart" }).element(),
    );
    await expect
      .poll(() => document.getElementById("CartDrawer").open)
      .toBe(true);
    await expect(events[0].promise).rejects.toThrow("no cart");
  });
});

describe("note and drawer", () => {
  test("the note saves after typing stops, and survives a re-render with focus", async () => {
    render({ lines: line(KEY, 1) });
    openDrawer();
    const fetch = mockFetch(async (url) =>
      String(url).includes("update.js")
        ? json({})
        : json({ sections: sections(line(KEY, 2), 2) }),
    );
    const details = document.getElementById("CartDrawerNote");
    details.open = true;
    const note = document.getElementById("CartNote");
    await userEvent.type(note, "Gift");
    const qty = document.getElementById(`Qty-${KEY}`);
    qty.value = "2";
    qty.dispatchEvent(new Event("change", { bubbles: true }));
    note.focus();
    await expect
      .poll(() =>
        fetch.mock.calls.some(([url]) => String(url).includes("update.js")),
      )
      .toBe(true);
    const update = fetch.mock.calls.find(([url]) =>
      String(url).includes("update.js"),
    );
    expect(JSON.parse(update[1].body)).toEqual({ note: "Gift" });
    await expect
      .poll(() => document.querySelector("#CartDrawerLines p")?.textContent)
      .toBe("Fresh 2");
    expect(document.getElementById("CartNote").value).toBe("Gift");
    expect(document.getElementById("CartDrawerNote").open).toBe(true);
    expect(document.activeElement.id).toBe("CartNote");
  });

  test("the cart icon opens the drawer instead of going to /cart", async () => {
    render();
    const link = document.querySelector("[data-cart-icon] a");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.getElementById("CartDrawer").open).toBe(true);
  });

  test("without a drawer the cart icon is a plain link", () => {
    render({ withDrawer: false });
    let prevented;
    document.addEventListener(
      "click",
      (e) => {
        prevented = e.defaultPrevented;
        e.preventDefault();
      },
      { once: true },
    );
    document
      .querySelector("[data-cart-icon] a")
      .dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    expect(prevented).toBe(false);
  });

  test("marks the page live so the Update buttons hide", () => {
    expect(document.documentElement.classList.contains("cart-live")).toBe(true);
  });
});

function openDrawer() {
  document.getElementById("CartDrawer").showModal();
}
