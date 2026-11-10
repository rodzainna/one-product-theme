/** Minus and plus buttons for a number input, keeping it within min, max and step. */
export class QuantityInput extends HTMLElement {
  #observer = new MutationObserver(() => this.#onAttributes());

  connectedCallback() {
    this.input = this.querySelector("input");
    this.minus = this.querySelector('[data-quantity-step="-1"]');
    this.plus = this.querySelector('[data-quantity-step="1"]');
    this.status = this.querySelector("[aria-live]");
    this.addEventListener("click", this.#onClick);
    this.input.addEventListener("input", this.#onInput);
    this.input.addEventListener("change", this.#onChange);
    this.#observer.observe(this.input, {
      attributeFilter: ["disabled", "min", "max", "step"],
    });
    this.#normalise();
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.#onClick);
    this.input.removeEventListener("input", this.#onInput);
    this.input.removeEventListener("change", this.#onChange);
    this.#observer.disconnect();
  }

  #onClick = (event) => {
    const button = event.target.closest("[data-quantity-step]");
    if (!button || this.input.disabled) return;
    if (button.getAttribute("aria-disabled") === "true") return;

    const limits = this.#limits();
    const direction = Number(button.dataset.quantityStep);
    this.input.value = String(this.#current(limits) + direction * limits.step);
    this.#normalise();
    this.#announce();
    this.#dispatch();
  };

  #onInput = () => {
    const limits = this.#limits();
    this.#updateButtons(this.#current(limits), limits);
  };

  #onChange = () => {
    const typed = this.input.value;
    this.#normalise();
    if (this.input.value !== typed) this.#announce();
  };

  #onAttributes() {
    const before = this.input.value;
    this.#normalise();
    if (this.input.value === before) return;
    this.#announce();
    this.#dispatch();
  }

  #limits() {
    const number = (value, fallback) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const min = number(this.input.min, 1);
    const max = number(this.input.max, Infinity);
    const step = number(this.input.step, 1) || 1;
    const highest = Math.max(min, min + Math.floor((max - min) / step) * step);
    return { min, step, highest };
  }

  #current({ min }) {
    const value = this.input.valueAsNumber;
    return Number.isNaN(value) ? min : value;
  }

  #snap(value, { min, step, highest }) {
    const rounded =
      min + Math.round((Math.max(value, min) - min) / step) * step;
    return Math.min(rounded, highest);
  }

  #normalise() {
    const limits = this.#limits();
    const value = this.#snap(this.#current(limits), limits);
    this.input.value = String(value);
    this.#updateButtons(value, limits);
  }

  #updateButtons(value, { min, highest }) {
    const disabled = this.input.disabled;
    this.minus?.setAttribute("aria-disabled", String(disabled || value <= min));
    this.plus?.setAttribute(
      "aria-disabled",
      String(disabled || value >= highest),
    );
  }

  #announce() {
    if (!this.status) return;
    // Clear first so the same value is announced again.
    this.status.textContent = "";
    requestAnimationFrame(() => {
      this.status.textContent = this.input.value;
    });
  }

  #dispatch() {
    this.input.dispatchEvent(new Event("input", { bubbles: true }));
    this.input.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

if (!customElements.get("quantity-input")) {
  customElements.define("quantity-input", QuantityInput);
}
