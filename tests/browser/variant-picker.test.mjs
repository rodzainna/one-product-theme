import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { CartLinesUpdateEvent } from "@shopify/standard-events";
import "../../assets/variant-picker.js";

// Option value ids, and the variant each Size/Colour pair maps to (L / Blue has none).
const VALUES = { S: "11", M: "12", L: "13", Red: "21", Blue: "22" };
const VARIANTS = {
  "S/Red": "101",
  "M/Red": "102",
  "M/Blue": "103",
  "L/Red": "104",
};

const pill = (group, name, checked) =>
  `<label><input type="radio" name="${group}" value="${name}" data-option-value-id="${VALUES[name]}" data-option-name="Size" ${checked ? "checked" : ""}>${name}</label>`;

// The section as Liquid renders it for a pick: picker, price, id, plans, button, Buy it now.
const section = ({
  size = "S",
  colour = "Red",
  url = location.pathname,
  plan = "",
  updateUrl = true,
} = {}) => {
  const variant = VARIANTS[`${size}/${colour}`] ?? "";
  // The shape Liquid's standard_event_data filter outputs.
  const eventData = {
    product: {
      id: 9,
      title: "Tee",
      handle: "tee",
      selectedVariant: variant
        ? { id: Number(variant), title: `${size} / ${colour}` }
        : null,
    },
    context: "page",
  };
  return `
    <div class="shopify-section" id="shopify-section-main">
      <variant-picker id="Picker" data-url="${url}" data-section-id="template--1__main" data-variant-id="${variant}" ${updateUrl ? "data-update-url" : ""}>
        <script type="application/json" data-event-data>${JSON.stringify(eventData)}</script>
        <fieldset><legend>Size</legend>${["S", "M", "L"].map((n) => pill("size", n, n === size)).join("")}</fieldset>
        <label for="Colour">Colour</label>
        <select id="Colour" name="colour">
          ${["Red", "Blue"].map((n) => `<option value="${n}" data-option-value-id="${VALUES[n]}" data-option-name="Colour" ${n === colour ? "selected" : ""}>${n}</option>`).join("")}
        </select>
      </variant-picker>
      <div id="Price" data-variant-region>${variant ? `Price ${size}` : ""}</div>
      <form>
        <input type="hidden" name="id" id="Id" value="${variant}" data-variant-value>
        <div id="Plans" data-variant-region>
          <label><input type="radio" id="PlanOnce" name="selling_plan" value="" ${plan ? "" : "checked"}>Once</label>
          <label><input type="radio" name="selling_plan" value="77" ${plan ? "checked" : ""}>Monthly</label>
        </div>
        <input type="number" id="Qty" name="quantity" value="1" ${size === "M" ? 'min="6" max="60" step="6"' : 'min="1" step="1"'} data-variant-attributes="min max step disabled">
        <button id="Add" name="add" data-variant-region ${variant ? "" : "disabled"}>${variant ? "Add to cart" : "Unavailable"}</button>
        <div id="Accel" data-variant-hidden ${variant ? "" : "hidden"}><button type="button">Buy it now</button></div>
      </form>
    </div>
    <div id="Elsewhere" data-variant-region>Another section</div>
  `;
};

// Answers each section request with the section for the picked option values.
const answer = (url) => {
  const ids = new URL(url).searchParams.get("option_values").split(",");
  const name = (id) => Object.keys(VALUES).find((key) => VALUES[key] === id);
  const plan = new URL(url).searchParams.get("selling_plan") ?? "";
  return section({ size: name(ids[0]), colour: name(ids[1]), plan });
};

const startUrl = location.href;
let fetchSpy;

beforeEach(() => {
  fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url) => new Response(answer(url)));
});

afterEach(() => {
  vi.restoreAllMocks();
  // WebKit allows 100 history changes per 10 seconds across the whole run, so only reset what a test changed.
  if (location.href !== startUrl)
    history.replaceState(history.state, "", startUrl);
  document.body.innerHTML = "";
});

const render = (options) => {
  document.body.innerHTML = section(options);
};
const picker = () => document.getElementById("Picker");
// Resolves once the next shopify:product:select event's promise settles.
const selected = (target) =>
  new Promise((resolve) =>
    target.addEventListener(
      "shopify:product:select",
      (event) => event.promise.then((result) => resolve({ event, result })),
      { once: true },
    ),
  );
const updated = () => selected(picker());
const requestUrl = (call = 0) => new URL(fetchSpy.mock.calls[call][0]);
const variantParam = () => new URL(location.href).searchParams.get("variant");

describe("a selling plan change", () => {
  test("re-renders for the plan without announcing a variant, and keeps it in the URL", async () => {
    render();
    const events = [];
    picker().addEventListener("shopify:product:select", (e) => events.push(e));
    await userEvent.click(page.getByLabelText("Monthly"));
    await expect.poll(() => fetchSpy.mock.calls.length).toBe(1);
    expect(requestUrl().searchParams.get("selling_plan")).toBe("77");
    await expect
      .poll(() => new URL(location.href).searchParams.get("selling_plan"))
      .toBe("77");
    expect(events).toHaveLength(0);
    await userEvent.click(page.getByLabelText("Once"));
    await expect
      .poll(() => new URL(location.href).searchParams.has("selling_plan"))
      .toBe(false);
  });
});

describe("a single-variant product", () => {
  test("its hidden picker re-prices a plan by naming the variant", async () => {
    document.body.innerHTML = `
      <div class="shopify-section">
        <variant-picker id="Picker" hidden data-url="${location.pathname}" data-section-id="template--1__main" data-variant-id="101"></variant-picker>
        <div id="Price" data-variant-region>Price</div>
        <form><div id="Plans" data-variant-region>
          <label><input type="radio" id="Once" name="selling_plan" value="" checked>Once</label>
          <label><input type="radio" id="Monthly" name="selling_plan" value="77">Monthly</label>
        </div></form>
      </div>`;
    fetchSpy.mockImplementation(
      async () =>
        new Response(
          document.body.innerHTML.replace(">Price<", ">Plan price<"),
        ),
    );
    document.getElementById("Monthly").click();
    await expect
      .poll(() => document.getElementById("Price").textContent)
      .toBe("Plan price");
    const url = requestUrl();
    expect(url.searchParams.get("variant")).toBe("101");
    expect(url.searchParams.has("option_values")).toBe(false);
    expect(url.searchParams.get("selling_plan")).toBe("77");
  });
});

describe("the request", () => {
  test("asks for the picker's section with the checked option value ids in order", async () => {
    render();
    const done = updated();
    await userEvent.click(page.getByLabelText("M"));
    await done;
    const url = requestUrl();
    expect(url.pathname).toBe(location.pathname);
    expect(url.searchParams.get("option_values")).toBe("12,21");
    expect(url.searchParams.get("section_id")).toBe("template--1__main");
    expect(url.searchParams.has("selling_plan")).toBe(false);
  });

  test("keeps the chosen selling plan", async () => {
    render({ plan: "77" });
    const done = updated();
    await userEvent.click(page.getByLabelText("M"));
    await done;
    expect(requestUrl().searchParams.get("selling_plan")).toBe("77");
  });

  test("reads a dropdown option the same way as a pill", async () => {
    render();
    const done = updated();
    await userEvent.selectOptions(page.getByLabelText("Colour"), "Blue");
    await done;
    expect(requestUrl().searchParams.get("option_values")).toBe("11,22");
  });

  test("a newer pick cancels the older request, so the last pick wins", async () => {
    render();
    const events = [];
    picker().addEventListener("shopify:product:select", (e) => events.push(e));
    let releaseFirst;
    // Answers late even after the abort, as a response already on its way can.
    fetchSpy.mockImplementationOnce(
      (url) =>
        new Promise((resolve) => {
          releaseFirst = () => resolve(new Response(answer(url)));
        }),
    );
    await userEvent.click(page.getByLabelText("M"));
    const done = updated();
    await userEvent.click(page.getByLabelText("L"));
    await done;
    expect(fetchSpy.mock.calls[0][1].signal.aborted).toBe(true);
    releaseFirst();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.getElementById("Id").value).toBe(VARIANTS["L/Red"]);
    expect(document.getElementById("Price").textContent).toBe("Price L");
    // Listeners only hear the final pick: the superseded event's promise never settles.
    let settled = false;
    events[0].promise.then(() => (settled = true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(events).toHaveLength(2);
    expect(settled).toBe(false);
  });
});

describe("the update", () => {
  test("copies the quantity limits onto the same input, keeping the shopper's quantity", async () => {
    render();
    const quantity = document.getElementById("Qty");
    quantity.value = "12";
    let done = updated();
    await userEvent.click(page.getByLabelText("M"));
    await done;
    expect(document.getElementById("Qty")).toBe(quantity);
    expect([quantity.min, quantity.max, quantity.step]).toEqual([
      "6",
      "60",
      "6",
    ]);
    expect(quantity.value).toBe("12");
    done = updated();
    await userEvent.click(page.getByLabelText("S"));
    await done;
    expect(quantity.hasAttribute("max")).toBe(false);
    expect(quantity.min).toBe("1");
  });

  test("swaps the price, id, plans and button, and keeps the picks", async () => {
    render();
    const done = updated();
    await userEvent.click(page.getByLabelText("M"));
    await done;
    expect(document.getElementById("Price").textContent).toBe("Price M");
    expect(document.getElementById("Id").value).toBe(VARIANTS["M/Red"]);
    expect(page.getByLabelText("M").element().checked).toBe(true);
    expect(picker().dataset.variantId).toBe(VARIANTS["M/Red"]);
  });

  test("keeps the id when the response has no id input", async () => {
    render();
    fetchSpy.mockImplementationOnce(
      async (url) =>
        new Response(answer(url).replace(/<input type="hidden"[^>]*>/, "")),
    );
    const done = updated();
    await userEvent.click(page.getByLabelText("M"));
    await done;
    expect(document.getElementById("Id").value).toBe(VARIANTS["S/Red"]);
  });

  test("leaves regions in other sections alone", async () => {
    render();
    const elsewhere = document.getElementById("Elsewhere");
    const done = updated();
    await userEvent.click(page.getByLabelText("M"));
    await done;
    expect(document.getElementById("Elsewhere")).toBe(elsewhere);
  });

  test("hides Buy it now without replacing it, and shows it again", async () => {
    render({ size: "L" });
    const accelerated = document.getElementById("Accel");
    let done = updated();
    await userEvent.selectOptions(page.getByLabelText("Colour"), "Blue");
    await done;
    expect(document.getElementById("Accel")).toBe(accelerated);
    expect(accelerated.hidden).toBe(true);
    expect(document.getElementById("Add").disabled).toBe(true);
    done = updated();
    await userEvent.selectOptions(page.getByLabelText("Colour"), "Red");
    await done;
    expect(accelerated.hidden).toBe(false);
  });

  test("sets ?variant= and announces the variant", async () => {
    render();
    history.replaceState(history.state, "", "?option_values=13,22");
    const done = updated();
    await userEvent.click(page.getByLabelText("M"));
    const { event, result } = await done;
    expect(variantParam()).toBe(VARIANTS["M/Red"]);
    expect(new URL(location.href).searchParams.has("option_values")).toBe(
      false,
    );
    expect(event.type).toBe("shopify:product:select");
    expect(event.bubbles).toBe(true);
    expect(event.product).toEqual({ id: 9, title: "Tee", handle: "tee" });
    expect(event.selectedOptions).toEqual([
      { name: "Size", value: "M" },
      { name: "Colour", value: "Red" },
    ]);
    expect(String(result.variant.id)).toBe(VARIANTS["M/Red"]);
    expect(result.doc).toBeInstanceOf(Document);
  });

  test("drops ?variant= when the picks match no variant", async () => {
    render({ size: "L" });
    history.replaceState(history.state, "", `?variant=${VARIANTS["L/Red"]}`);
    const done = updated();
    await userEvent.selectOptions(page.getByLabelText("Colour"), "Blue");
    const { result } = await done;
    expect(variantParam()).toBeNull();
    expect(new URL(location.href).searchParams.get("option_values")).toBe(
      "13,22",
    );
    expect(result.variant).toBeNull();
  });

  test("leaves the URL alone when the picker isn't on its product's page", async () => {
    render({ updateUrl: false });
    const done = updated();
    await userEvent.click(page.getByLabelText("M"));
    await done;
    expect(location.href).toBe(startUrl);
  });

  test("sets the id input in place and tells its listeners", async () => {
    render();
    const input = document.getElementById("Id");
    const heard = vi.fn();
    input.addEventListener("change", heard);
    const done = updated();
    await userEvent.click(page.getByLabelText("M"));
    await done;
    expect(document.getElementById("Id")).toBe(input);
    expect(input.value).toBe(VARIANTS["M/Red"]);
    expect(heard).toHaveBeenCalledOnce();
  });

  test("sends a pick made before the script ran", async () => {
    const holder = document.createElement("div");
    holder.innerHTML = section();
    holder.querySelector('input[value="M"]').checked = true;
    const connected = new Promise((resolve) =>
      document.addEventListener(
        "shopify:product:select",
        (e) => e.promise.then(resolve),
        { once: true },
      ),
    );
    document.body.append(...holder.childNodes);
    await connected;
    expect(requestUrl().searchParams.get("option_values")).toBe("12,21");
    expect(document.getElementById("Id").value).toBe(VARIANTS["M/Red"]);
  });

  test("sends nothing when the picks match the page", async () => {
    render();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("sends nothing for a dropdown with no option rendered as selected", async () => {
    render({ colour: "None" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("holds Add to cart and Buy it now until the new variant lands", async () => {
    render();
    let release;
    fetchSpy.mockImplementationOnce(
      (url) =>
        new Promise(
          (resolve) => (release = () => resolve(new Response(answer(url)))),
        ),
    );
    const blocked = [];
    const record = (event) => {
      blocked.push(event.defaultPrevented);
      event.preventDefault();
    };
    document.addEventListener("submit", record);
    const done = updated();
    await userEvent.click(page.getByLabelText("M"));
    expect(document.getElementById("Add").getAttribute("aria-disabled")).toBe(
      "true",
    );
    expect(document.getElementById("Accel").hidden).toBe(true);
    document.querySelector("form").requestSubmit();
    release();
    await done;
    // assets/quantity-input.js snaps the quantity to the new minimum on a real page.
    document.getElementById("Qty").value = "6";
    document.querySelector("form").requestSubmit();
    document.removeEventListener("submit", record);
    expect(blocked).toEqual([true, false]);
    expect(document.getElementById("Add").hasAttribute("aria-disabled")).toBe(
      false,
    );
    expect(document.getElementById("Accel").hidden).toBe(false);
  });
});

describe("swatch legend", () => {
  test("names a pick restored before the script ran", async () => {
    const holder = document.createElement("div");
    holder.innerHTML = section();
    holder.querySelector("fieldset").classList.add("pill-group");
    holder.querySelector("legend").innerHTML =
      'Size: <span class="pill-group__picked" aria-hidden="true">S</span>';
    holder.querySelector('input[value="L"]').checked = true;
    let release;
    fetchSpy.mockImplementationOnce(
      (url) =>
        new Promise(
          (resolve) => (release = () => resolve(new Response(answer(url)))),
        ),
    );
    document.body.append(...holder.childNodes);
    expect(document.querySelector(".pill-group__picked").textContent).toBe("L");
    release();
  });

  test("names the picked value as soon as it's picked", async () => {
    render();
    document.querySelector("fieldset").classList.add("pill-group");
    const legend = document.querySelector("fieldset legend");
    legend.innerHTML =
      'Size: <span class="pill-group__picked" aria-hidden="true">S</span>';
    let release;
    fetchSpy.mockImplementationOnce(
      (url) =>
        new Promise(
          (resolve) => (release = () => resolve(new Response(answer(url)))),
        ),
    );
    const done = updated();
    await userEvent.click(page.getByLabelText("M"));
    expect(legend.querySelector(".pill-group__picked").textContent).toBe("M");
    release();
    await done;
  });
});

describe("focus", () => {
  test("stays on the pill picked with the arrow keys", async () => {
    render();
    page.getByLabelText("S").element().focus();
    const done = updated();
    await userEvent.keyboard("{ArrowRight}");
    await done;
    expect(document.activeElement).toBe(page.getByLabelText("M").element());
  });

  test("stays on the dropdown", async () => {
    render();
    // A real pick focuses the dropdown; selectOptions alone doesn't.
    page.getByLabelText("Colour").element().focus();
    const done = updated();
    await userEvent.selectOptions(page.getByLabelText("Colour"), "Blue");
    await done;
    expect(document.activeElement).toBe(
      page.getByLabelText("Colour").element(),
    );
  });

  test("isn't pulled back when the shopper has moved on to a swapped button", async () => {
    render();
    let release;
    fetchSpy.mockImplementationOnce(
      (url) =>
        new Promise(
          (resolve) => (release = () => resolve(new Response(answer(url)))),
        ),
    );
    const done = updated();
    await userEvent.click(page.getByLabelText("M"));
    document.getElementById("Add").focus();
    release();
    await done;
    expect(document.activeElement.id).toBe("Add");
    expect(document.activeElement.isConnected).toBe(true);
  });

  test("returns to the focused control inside a swapped region", async () => {
    render();
    let release;
    fetchSpy.mockImplementationOnce(
      (url) =>
        new Promise(
          (resolve) => (release = () => resolve(new Response(answer(url)))),
        ),
    );
    const done = updated();
    await userEvent.click(page.getByLabelText("M"));
    document.getElementById("PlanOnce").focus();
    release();
    await done;
    expect(document.activeElement.id).toBe("PlanOnce");
    expect(document.activeElement.isConnected).toBe(true);
  });
});

describe("a cart change", () => {
  const cartChanged = (settle) => {
    const deferred = CartLinesUpdateEvent.createPromise();
    document.dispatchEvent(
      new CartLinesUpdateEvent({
        action: "add",
        context: "product",
        lines: [{ merchandiseId: "101", quantity: 1 }],
        promise: deferred.promise,
      }),
    );
    settle(deferred);
  };

  test("re-renders the buy box from the server once it lands, for the same variant, without announcing", async () => {
    render({ size: "M" });
    const events = [];
    picker().addEventListener("shopify:product:select", (e) => events.push(e));
    cartChanged((deferred) => deferred.resolve({ cart: null }));
    await expect.poll(() => fetchSpy.mock.calls.length).toBe(1);
    expect(requestUrl().searchParams.get("option_values")).toBe("12,21");
    expect(events).toHaveLength(0);
  });

  test("waits for the change to land, and ignores one that failed", async () => {
    render();
    cartChanged(() => {});
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fetchSpy).not.toHaveBeenCalled();
    document.body.innerHTML = "";
    render();
    cartChanged((deferred) => deferred.reject(new Error("offline")));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("a picker that left the page stops listening", () => {
    render();
    document.body.innerHTML = "";
    const then = vi.fn();
    document.dispatchEvent(
      new CartLinesUpdateEvent({
        action: "add",
        context: "product",
        lines: [],
        promise: { then },
      }),
    );
    expect(then).not.toHaveBeenCalled();
  });
});
