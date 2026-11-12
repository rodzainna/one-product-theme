/**
 * Loads the section's recommendations from the Product Recommendations API once it nears
 * the screen (shopify.dev: they're only filled in when fetched with the section's ID), and
 * swaps them in. With nothing to recommend, the section stays empty.
 */
export class ProductRecommendations extends HTMLElement {
  #controller = null;
  #observer = null;

  connectedCallback() {
    if (!this.hasAttribute("data-empty")) return;
    // root: document, so the margin also applies in an iframe such as the theme editor.
    this.#observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        this.#observer.disconnect();
        this.#load();
      },
      { root: document, rootMargin: "0px 0px 400px 0px" },
    );
    this.#observer.observe(this);
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#controller?.abort();
  }

  async #load() {
    this.#controller = new AbortController();
    let html;
    try {
      const response = await fetch(this.dataset.url, {
        signal: this.#controller.signal,
      });
      if (!response.ok) return;
      html = await response.text();
    } catch {
      return;
    }
    const doc = new DOMParser().parseFromString(html, "text/html");
    const fresh = doc.getElementById(this.id);
    if (!fresh || fresh.hasAttribute("data-empty")) return;
    this.replaceChildren(...fresh.childNodes);
    this.removeAttribute("data-empty");
  }
}

if (!customElements.get("product-recommendations")) {
  customElements.define("product-recommendations", ProductRecommendations);
}
