const BROWSING_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

/**
 * Submits a country or language selector's form as soon as a choice is made, so there's no
 * separate button to press. Arrowing through a closed select fires a change per option in some
 * browsers, so those changes show the form's Update button instead of reloading the page.
 */
export class LocalizationForm extends HTMLElement {
  #browsing = false;

  connectedCallback() {
    this.addEventListener("keydown", this.#onKeydown);
    this.addEventListener("pointerdown", this.#onPointerdown);
    this.addEventListener("change", this.#onChange);
  }

  disconnectedCallback() {
    this.removeEventListener("keydown", this.#onKeydown);
    this.removeEventListener("pointerdown", this.#onPointerdown);
    this.removeEventListener("change", this.#onChange);
  }

  #onKeydown = (event) => {
    this.#browsing = BROWSING_KEYS.has(event.key);
  };

  #onPointerdown = () => {
    this.#browsing = false;
  };

  #onChange = (event) => {
    if (!event.target.matches("select")) return;
    const { form } = event.target;
    if (this.#browsing) form.toggleAttribute("data-pending", true);
    else form.requestSubmit();
  };
}

if (!customElements.get("localization-form")) {
  customElements.define("localization-form", LocalizationForm);
}
