/**
 * Re-renders the product section for the picked option values (shopify.dev's
 * high-variant pattern), then swaps the picker and every [data-variant-region] in its
 * section, copies `value` onto every [data-variant-value] and `hidden` onto every
 * [data-variant-hidden] and updates the URL. Each pick dispatches Shopify's standard
 * `shopify:product:select` event, whose promise resolves with the variant (or null)
 * and the new document. While a request is out, Add to cart is aria-disabled and the
 * form won't submit.
 */
// Loaded on demand, so the picker still works if Shopify's CDN can't be reached.
const standardEvents = import("@shopify/events").catch(() => null);

export class VariantPicker extends HTMLElement {
  #controller;
  #busy = false;
  #section;

  connectedCallback() {
    this.#section = this.closest(".shopify-section") ?? document;
    this.addEventListener("change", this.#onChange);
    this.#section.addEventListener("submit", this.#onSubmit, true);
    // Picks made before this script ran, or restored by the browser, aren't in the form yet.
    const radios = [...this.querySelectorAll("input[type=radio]")];
    const selects = [...this.querySelectorAll("select")];
    const changed =
      radios.some((radio) => radio.checked !== radio.defaultChecked) ||
      selects.some((select) => {
        const rendered = [...select.options].find((o) => o.defaultSelected);
        return rendered !== undefined && !rendered.selected;
      });
    if (changed) this.#update();
  }

  disconnectedCallback() {
    this.#controller?.abort();
    this.removeEventListener("change", this.#onChange);
    this.#section.removeEventListener("submit", this.#onSubmit, true);
  }

  // The form still holds the last variant until the new section lands.
  #onSubmit = (event) => {
    if (this.#busy) event.preventDefault();
  };

  #setBusy() {
    this.#busy = true;
    for (const button of this.#section.querySelectorAll('[name="add"]')) {
      button.setAttribute("aria-disabled", "true");
    }
    for (const element of this.#section.querySelectorAll(
      "[data-variant-hidden]",
    )) {
      element.hidden = true;
    }
  }

  get optionValueIds() {
    return [...this.querySelectorAll("input:checked, option:checked")].map(
      (choice) => choice.dataset.optionValueId,
    );
  }

  #onChange = (event) => {
    const changed = event.target;
    // A dropdown keeps its id across renders; a pill is found by its value.
    this.#update(
      changed.id
        ? `#${CSS.escape(changed.id)}`
        : `[data-option-value-id="${changed.dataset.optionValueId}"]`,
    );
  };

  // Data from Liquid's standard_event_data filter; doc is the page or a fetched section.
  #eventData(doc = document) {
    const script = doc
      .getElementById(this.id)
      ?.querySelector("script[data-event-data]");
    return script ? JSON.parse(script.textContent) : null;
  }

  async #announce() {
    const events = await standardEvents;
    const product = this.#eventData()?.product;
    if (!events || !product) return null;
    const result = events.ProductSelectEvent.createPromise();
    const selectedOptions = [
      ...this.querySelectorAll("input:checked, option:checked"),
    ].map((choice) => ({
      name: choice.dataset.optionName,
      value: choice.value,
    }));
    this.dispatchEvent(
      new events.ProductSelectEvent({
        product: {
          id: product.id,
          title: product.title,
          handle: product.handle,
        },
        selectedOptions,
        promise: result.promise,
      }),
    );
    return result;
  }

  async #update(focusTarget) {
    // Swatch legends name the pick now, not after the section lands.
    for (const group of this.querySelectorAll(".pill-group")) {
      const picked = group.querySelector(".pill-group__picked");
      const input = group.querySelector("input:checked");
      if (picked && input) picked.textContent = input.value;
    }
    const url = new URL(this.dataset.url, location.origin);
    url.searchParams.set("option_values", this.optionValueIds.join(","));
    const plan = this.#section.querySelector('[name="selling_plan"]:checked');
    if (plan?.value) url.searchParams.set("selling_plan", plan.value);

    this.#controller?.abort();
    const controller = (this.#controller = new AbortController());
    this.#setBusy();
    // A superseded pick's promise never settles, so listeners only hear the final variant.
    const announced = this.#announce();
    let html;
    try {
      html = await this.#fetchSection(url, controller.signal);
    } catch {
      if (controller.signal.aborted) return;
      // Loading the page for the same options still lands on the right variant.
      location.assign(url);
      return;
    }
    if (controller.signal.aborted) return;
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc.getElementById(this.id)) {
      location.assign(url);
      return;
    }
    this.#render(doc, focusTarget);
    const variant = this.#eventData(doc)?.product.selectedVariant ?? null;
    (await announced)?.resolve({ variant, doc });
  }

  async #fetchSection(url, signal) {
    const sectionUrl = new URL(url);
    sectionUrl.searchParams.set("section_id", this.dataset.sectionId);
    const response = await fetch(sectionUrl, { signal });
    if (!response.ok)
      throw new Error(`Section request failed: ${response.status}`);
    return response.text();
  }

  #render(doc, focusTarget) {
    const fresh = doc.getElementById(this.id);
    const active = document.activeElement;
    const focusInPicker = this.contains(active);
    const focusedRegion = active?.closest("[data-variant-region]");
    const focusedId = focusedRegion && (active.id || focusedRegion.id);
    this.#busy = false;

    this.innerHTML = fresh.innerHTML;
    this.dataset.variantId = fresh.dataset.variantId;

    for (const region of this.#section.querySelectorAll(
      "[data-variant-region]",
    )) {
      const next = doc.getElementById(region.id);
      if (next) region.replaceWith(next);
    }
    for (const element of this.#section.querySelectorAll(
      "[data-variant-hidden]",
    )) {
      element.hidden = doc.getElementById(element.id)?.hidden ?? false;
    }
    // Set in place, so scripts watching the form's id input hear the change.
    for (const input of this.#section.querySelectorAll(
      "[data-variant-value]",
    )) {
      const value = doc.getElementById(input.id)?.value ?? input.value;
      if (input.value === value) continue;
      input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // Focus goes back only to where it was: the picked option, or a swapped region.
    if (focusInPicker && focusTarget) this.querySelector(focusTarget)?.focus();
    else if (focusedId) document.getElementById(focusedId)?.focus();

    const variantId = fresh.dataset.variantId || null;
    if (this.hasAttribute("data-update-url")) {
      const page = new URL(location.href);
      // With no variant, the picked values keep the page on the same pick when reloaded.
      if (variantId) {
        page.searchParams.set("variant", variantId);
        page.searchParams.delete("option_values");
      } else {
        page.searchParams.delete("variant");
        page.searchParams.set("option_values", this.optionValueIds.join(","));
      }
      history.replaceState(history.state, "", page);
    }
  }
}

if (!customElements.get("variant-picker")) {
  customElements.define("variant-picker", VariantPicker);
}
