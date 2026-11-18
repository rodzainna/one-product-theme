const COMMIT_KEYS = new Set(["Enter"]);

/**
 * Submits the form around a select as soon as a choice is made, so there's no
 * separate button to press. Arrowing or typing through a closed select fires a change per option
 * in some browsers, so only Enter or a click submits; other changes show the form's Update button
 * instead of reloading the page. With data-skip-empty, a submitted GET form leaves its empty fields
 * out of the URL.
 */
export class SelectForm extends HTMLElement {
  #browsing = false;

  connectedCallback() {
    this.addEventListener("keydown", this.#onKeydown);
    this.addEventListener("pointerdown", this.#onPointerdown);
    this.addEventListener("change", this.#onChange);
    this.addEventListener("formdata", this.#onFormData);
  }

  disconnectedCallback() {
    this.removeEventListener("keydown", this.#onKeydown);
    this.removeEventListener("pointerdown", this.#onPointerdown);
    this.removeEventListener("change", this.#onChange);
    this.removeEventListener("formdata", this.#onFormData);
  }

  #onFormData = (event) => {
    if (!this.hasAttribute("data-skip-empty")) return;
    for (const [name, value] of [...event.formData]) {
      if (value === "") event.formData.delete(name);
    }
  };

  #onKeydown = (event) => {
    if (event.target.matches("select")) {
      this.#browsing = !COMMIT_KEYS.has(event.key);
    }
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

if (!customElements.get("select-form")) {
  customElements.define("select-form", SelectForm);
}
