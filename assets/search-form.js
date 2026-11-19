/**
 * The search page's form. The Clear button shows once there is text and empties the field, and
 * a submit shows the loader in the field until the next page arrives. A blank submit does nothing.
 */
export class SearchForm extends HTMLElement {
  #form;
  #input;
  #clear;

  connectedCallback() {
    this.#form = this.querySelector("form");
    this.#input = this.querySelector("[data-field]");
    this.#clear = this.querySelector("[data-clear]");

    this.#input.addEventListener("input", this.#onInput);
    this.#clear.addEventListener("click", this.#onClear);
    this.#form.addEventListener("submit", this.#onSubmit);
    // Back to this page from the results: the page may come from the cache with the loader on.
    window.addEventListener("pageshow", this.#onPageShow);
  }

  disconnectedCallback() {
    window.removeEventListener("pageshow", this.#onPageShow);
  }

  #onInput = () => {
    this.#clear.hidden = this.#input.value === "";
  };

  #onClear = () => {
    this.#input.value = "";
    this.#clear.hidden = true;
    this.#input.focus();
  };

  #onSubmit = (event) => {
    if (this.#input.value.trim() === "") {
      event.preventDefault();
      return;
    }
    this.setAttribute("data-loading", "");
    this.#form.setAttribute("aria-busy", "true");
  };

  #onPageShow = () => {
    this.removeAttribute("data-loading");
    this.#form.removeAttribute("aria-busy");
  };
}

if (!customElements.get("search-form")) {
  customElements.define("search-form", SearchForm);
}
