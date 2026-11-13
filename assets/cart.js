/**
 * Live cart for the drawer and /cart: saves through the Cart Ajax API and swaps in the fresh
 * [data-cart-region] markup from the Section Rendering API. Without it /cart is a plain form.
 */
import { openDialog } from "dialog";

// Shopify's standard cart events let apps follow what the shopper does (shopify.dev, "Dispatch events").
const standardEvents = import("@shopify/standard-events").catch(() => null);

const root = window.Shopify?.routes?.root ?? "/";
const QUANTITY_DELAY = 300;
const NOTE_DELAY = 400;

const drawer = () => document.getElementById("CartDrawer");

const sectionIds = () => [
  ...new Set(
    [...document.querySelectorAll("[data-cart-region]")]
      .map((region) => region.closest(".shopify-section")?.id)
      .filter(Boolean)
      .map((id) => id.replace(/^shopify-section-/, "")),
  ),
];

// Requests run one at a time, so a slow response can't overwrite a newer one.
let queue = Promise.resolve();
const enqueue = (task) => (queue = queue.then(task, task));

/** Swaps each region for its fresh copy, keeping what the shopper is typing in other lines and their focus. */
export function applySections(sections, savedKey) {
  const active = document.activeElement;
  const activeId = active?.id;
  const stepper = active?.closest?.("quantity-input");
  const focused = stepper && {
    key: stepper.querySelector("input")?.dataset.lineKey,
    step: active.dataset?.quantityStep,
    typed:
      active.matches("input") &&
      active.dataset.lineKey !== savedKey &&
      active.value !== active.defaultValue
        ? active.value
        : null,
  };
  let lostFocus = null;
  for (const html of Object.values(sections ?? {})) {
    if (!html) continue;
    const fresh = new DOMParser().parseFromString(html, "text/html");
    for (const region of fresh.querySelectorAll("[data-cart-region][id]")) {
      const current = document.getElementById(region.id);
      if (!current) continue;
      for (const kept of region.querySelectorAll("[data-cart-keep][id]")) {
        const live = current.querySelector(`#${CSS.escape(kept.id)}`);
        if (live) kept.replaceWith(live);
      }
      if (current.contains(document.activeElement)) lostFocus = region;
      current.replaceWith(region);
    }
  }
  const target = activeId && document.getElementById(activeId);
  const line =
    focused?.key &&
    document.querySelector(`input[data-line-key="${CSS.escape(focused.key)}"]`);
  if (target) target.focus({ preventScroll: true });
  else if (line) {
    const same = focused.step
      ? line
          .closest("quantity-input")
          .querySelector(`[data-quantity-step="${focused.step}"]`)
      : line;
    same?.focus({ preventScroll: true });
  } else if (lostFocus?.isConnected) {
    const fallback = lostFocus.matches("[data-cart-focus]")
      ? lostFocus
      : lostFocus.querySelector("[data-cart-focus]");
    fallback?.focus({ preventScroll: true });
  }
  // What the shopper was typing in another line isn't lost by this line's response.
  if (line && focused.typed !== null) {
    line.value = focused.typed;
    scheduleChange(line);
  }
}

const post = (path, body) =>
  fetch(`${root}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

const currentCart = () =>
  fetch(`${root}cart.js`).then((response) => response.json());

const contextOf = (element) =>
  element?.closest("#CartDrawer") ? "dialog" : "cart";

// Dispatches a standard cart event, sends the request, then settles the event's promise.
async function announceChange(name, target, init, send, responseIsCart = true) {
  const lib = await standardEvents;
  const EventClass = lib?.[name];
  const deferred = EventClass?.createPromise();
  deferred?.promise.catch(() => {});
  const element = target?.isConnected ? target : document;
  if (EventClass)
    element.dispatchEvent(
      new EventClass({ ...init, promise: deferred.promise }),
    );
  let result;
  try {
    result = await send();
  } catch (error) {
    deferred?.reject(error);
    if (lib?.CartErrorEvent)
      element.dispatchEvent(
        new lib.CartErrorEvent({
          error: String(error.message),
          code: "INVALID",
        }),
      );
    throw error;
  }
  // A problem describing the change to listeners never breaks the shopper's cart.
  if (EventClass) {
    try {
      const { ok, data } = result;
      const cart = ok && responseIsCart ? data : await currentCart();
      deferred.resolve({
        cart: EventClass.createCartFromAjaxResponse(cart),
        userErrors: ok
          ? []
          : [{ message: data.description ?? "", code: "INVALID" }],
        warnings: [],
      });
    } catch (error) {
      deferred.reject(error);
    }
  }
  return result;
}

const send = async (path, body) => {
  const response = await post(path, body);
  return { ok: response.ok, data: await response.json() };
};

const showError = (formId, description) => {
  const error = document
    .getElementById(formId)
    ?.querySelector("[data-cart-error]");
  if (error) error.textContent = description || error.dataset.message;
};

// After a failed change, show the cart as Shopify has it.
async function refresh(ids) {
  const url = `${location.pathname}?sections=${ids.join(",")}`;
  const response = await fetch(url).catch(() => null);
  if (response?.ok) applySections(await response.json());
}

async function changeLine(key, quantity, formId, target) {
  const ids = sectionIds();
  try {
    const { ok, data } = await announceChange(
      "CartLinesUpdateEvent",
      target,
      {
        action: quantity === 0 ? "remove" : "update",
        context: contextOf(target),
        lines: [{ id: key, quantity }],
      },
      () =>
        send("cart/change.js", {
          id: key,
          quantity,
          sections: ids,
          sections_url: location.pathname,
        }),
    );
    if (!ok) {
      await refresh(ids);
      showError(formId, data.description);
      return;
    }
    applySections(data.sections, key);
  } catch {
    await refresh(ids);
    showError(formId);
  }
}

const quantityTimers = new Map();

function scheduleChange(input) {
  const key = input.dataset.lineKey;
  const formId = input.form?.id;
  clearTimeout(quantityTimers.get(key)?.timer);
  const run = () => {
    quantityTimers.delete(key);
    const quantity = input.valueAsNumber;
    if (Number.isNaN(quantity)) return;
    enqueue(() => changeLine(key, quantity, formId, input));
  };
  quantityTimers.set(key, { run, timer: setTimeout(run, QUANTITY_DELAY) });
}

const flushQuantities = () => {
  for (const { run, timer } of [...quantityTimers.values()]) {
    clearTimeout(timer);
    run();
  }
};

let noteTimer;
let pendingNote = null;
const saveNote = (textarea) => {
  const note = textarea.value;
  clearTimeout(noteTimer);
  pendingNote = note;
  noteTimer = setTimeout(() => {
    pendingNote = null;
    enqueue(() =>
      announceChange(
        "CartNoteUpdateEvent",
        textarea,
        { context: contextOf(textarea), note },
        () => send("cart/update.js", { note }),
      ).catch(() => {}),
    );
  }, NOTE_DELAY);
};

// A note typed just before leaving the page is still saved.
const flushNote = () => {
  if (pendingNote === null) return;
  fetch(`${root}cart/update.js`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note: pendingNote }),
  }).catch(() => {});
  pendingNote = null;
};

const setBusy = (button, busy) => {
  if (!button) return;
  if (busy) {
    button.setAttribute("aria-busy", "true");
    button.setAttribute("aria-disabled", "true");
  } else {
    button.removeAttribute("aria-busy");
    button.removeAttribute("aria-disabled");
  }
};

const announce = (title) => {
  const status = document.querySelector("#CartDrawer [data-cart-status]");
  if (!status) return;
  status.textContent = "";
  requestAnimationFrame(() => {
    status.textContent = status.dataset.added.replace("[title]", title);
  });
};

async function addToCart(form, button) {
  const error = form.querySelector("[data-cart-error]");
  const body = new FormData(form);
  body.append("sections", sectionIds().join(","));
  body.append("sections_url", location.pathname);
  try {
    const { ok, data } = await announceChange(
      "CartLinesUpdateEvent",
      form,
      {
        action: "add",
        context: "product",
        lines: [
          {
            merchandiseId: body.get("id"),
            quantity: Number(body.get("quantity") || 1),
          },
        ],
      },
      async () => {
        const response = await fetch(`${root}cart/add.js`, {
          method: "POST",
          headers: { Accept: "application/json" },
          body,
        });
        return { ok: response.ok, data: await response.json() };
      },
      false,
    );
    if (!ok) {
      if (error) error.textContent = data.description || error.dataset.message;
      return;
    }
    if (error) error.textContent = "";
    applySections(data.sections);
    openDialog(drawer());
    announce(data.title ?? data.product_title ?? "");
  } catch {
    if (error) error.textContent = error.dataset.message;
  } finally {
    setBusy(button, false);
  }
}

const onSubmit = (event) => {
  if (event.defaultPrevented) return;
  const form = event.target;
  if (form.matches("[data-cart-form]")) {
    if (event.submitter?.name === "checkout") return;
    event.preventDefault();
    // Enter in a quantity field submits before its change event fires.
    if (
      form.contains(document.activeElement) &&
      document.activeElement.dataset.lineKey
    )
      scheduleChange(document.activeElement);
    flushQuantities();
    return;
  }
  if (!drawer() || !form.matches('form[action$="/cart/add"]')) return;
  event.preventDefault();
  const button = event.submitter;
  if (button?.hasAttribute("aria-busy")) return;
  setBusy(button, true);
  enqueue(() => addToCart(form, button));
};

const onChange = (event) => {
  const input = event.target;
  if (input.matches?.("[data-cart-form] input[data-line-key]"))
    scheduleChange(input);
};

const onInput = (event) => {
  if (event.target.matches?.("[data-cart-note]")) saveNote(event.target);
};

const onClick = (event) => {
  const remove = event.target.closest?.(".cart-line__remove[data-line-key]");
  if (remove) {
    event.preventDefault();
    const formId = remove.closest("form")?.id;
    clearTimeout(quantityTimers.get(remove.dataset.lineKey)?.timer);
    quantityTimers.delete(remove.dataset.lineKey);
    enqueue(() => changeLine(remove.dataset.lineKey, 0, formId, remove));
    return;
  }
  const icon = event.target.closest?.("[data-cart-icon] a");
  if (icon && drawer()) {
    event.preventDefault();
    openDialog(drawer());
  }
};

// Loaded by both the drawer and the cart page; a module runs once per page.
document.documentElement.classList.add("cart-live");
document.addEventListener("submit", onSubmit);
document.addEventListener("change", onChange);
document.addEventListener("input", onInput);
document.addEventListener("click", onClick);
addEventListener("pagehide", flushNote);
