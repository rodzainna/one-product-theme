/**
 * Predictive search for the header's search modal. As someone types, it fetches the
 * predictive-search section from /search/suggest and swaps the results in, following
 * shopify.dev's Predictive Search API and the ARIA combobox pattern: the field keeps focus
 * and points at the highlighted result with aria-activedescendant.
 */
const MIN_LENGTH = 2;
const DEBOUNCE_MS = 300;
const RESULT_LIMIT = 8;

export class PredictiveSearch extends HTMLElement {
  #form;
  #input;
  #clear;
  #results;
  #status;
  #controller = null;
  #timer = null;
  #active = -1;

  connectedCallback() {
    this.#form = this.querySelector("form");
    this.#input = this.querySelector("[data-field]");
    this.#clear = this.querySelector("[data-clear]");
    this.#results = this.querySelector("[data-results]");
    this.#status = this.querySelector("[data-status]");

    this.#input.addEventListener("input", this.#onInput);
    this.#input.addEventListener("keydown", this.#onKeydown);
    this.#form.addEventListener("submit", this.#onSubmit);
    this.#clear.addEventListener("click", this.#onClear);
    this.querySelector("dialog").addEventListener("close", this.#reset);
  }

  disconnectedCallback() {
    this.#cancel();
  }

  get #options() {
    return [...this.#results.querySelectorAll('[role="option"]')];
  }

  #onInput = () => {
    this.#clear.hidden = this.#input.value === "";
    // The results on screen belong to the old text, so Enter mustn't follow one of them.
    this.#highlight(-1);
    // Whatever was pending belongs to the old text; typing starts again from here.
    this.#cancel();
    if (this.#input.value.trim().length < MIN_LENGTH) {
      this.#show(null);
      return;
    }
    this.#setLoading(true);
    this.#timer = setTimeout(
      () => this.#search(this.#input.value.trim()),
      DEBOUNCE_MS,
    );
  };

  #reset = () => {
    this.#input.value = "";
    this.#clear.hidden = true;
    this.#cancel();
    this.#show(null);
  };

  #onClear = () => {
    this.#reset();
    this.#input.focus();
  };

  #onSubmit = (event) => {
    if (this.#input.value.trim() === "") event.preventDefault();
  };

  #onKeydown = (event) => {
    const options = this.#options;
    // Enter confirms an IME's text, and with Cmd or Ctrl it's the browser's own shortcut.
    if (event.isComposing || event.metaKey || event.ctrlKey) return;
    if (event.key === "Enter" && this.#active > -1) {
      event.preventDefault();
      options[this.#active].click();
      return;
    }
    if (!["ArrowDown", "ArrowUp"].includes(event.key) || options.length === 0) {
      return;
    }
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    // From the field (-1) the first press goes to the first or last result, then it wraps.
    const next = this.#active + step;
    this.#highlight(
      next < -1 ? options.length - 1 : next >= options.length ? -1 : next,
    );
  };

  #highlight(index) {
    const options = this.#options;
    options[this.#active]?.setAttribute("aria-selected", "false");
    this.#active = index;
    const option = options[index];
    if (option) {
      option.setAttribute("aria-selected", "true");
      option.scrollIntoView({ block: "nearest" });
      this.#input.setAttribute("aria-activedescendant", option.id);
    } else {
      this.#input.removeAttribute("aria-activedescendant");
    }
  }

  #cancel = () => {
    clearTimeout(this.#timer);
    this.#controller?.abort();
    this.#controller = null;
  };

  async #search(terms) {
    this.#cancel();
    this.#controller = new AbortController();
    const url = new URL(this.dataset.url, location.origin);
    url.searchParams.set("q", terms);
    url.searchParams.set("section_id", "predictive-search");
    url.searchParams.set(
      "resources[type]",
      "query,product,collection,page,article",
    );
    url.searchParams.set("resources[limit]", RESULT_LIMIT);
    url.searchParams.set("resources[limit_scope]", "all");

    let html;
    try {
      const response = await fetch(url, { signal: this.#controller.signal });
      if (!response.ok) throw new Error(response.status);
      html = await response.text();
    } catch (error) {
      // A newer search replaced this one; anything else leaves the modal as just the field.
      if (error.name !== "AbortError") this.#show(null);
      return;
    }
    const fresh = new DOMParser()
      .parseFromString(html, "text/html")
      .getElementById("predictive-search-results");
    // The "Search for" link needs the exact text, which the section only has HTML-escaped.
    if (fresh) {
      const all = fresh.querySelector("[data-search-all]");
      all.href = `${this.#form.action}?${new URLSearchParams({ q: terms })}`;
    }
    this.#show(fresh);
  }

  // From the moment a search is due until its answer (or failure) arrives, so there's no gap.
  #setLoading(on) {
    this.toggleAttribute("data-loading", on);
    this.#results.setAttribute("aria-busy", String(on));
  }

  #show(fresh) {
    this.#setLoading(false);
    this.#highlight(-1);
    this.#results.replaceChildren(...(fresh ? [fresh] : []));
    this.#input.setAttribute("aria-expanded", String(Boolean(fresh)));
    this.#status.textContent = fresh?.dataset.summary ?? "";
  }
}

if (!customElements.get("predictive-search")) {
  customElements.define("predictive-search", PredictiveSearch);
}
