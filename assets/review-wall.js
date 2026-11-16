// The reviews wall: even columns from 8px rows, and each review's video loads when its dialog opens.
class ReviewWall extends HTMLElement {
  #frame = 0;
  #resizer = new ResizeObserver(() => this.#schedule());
  #children = new MutationObserver(() => this.#observeChildren());

  connectedCallback() {
    this.#observeChildren();
    this.#children.observe(this, { childList: true });
    this.addEventListener("click", this.#mountVideo, true);
    this.addEventListener("close", this.#pauseVideo, true);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#resizer.disconnect();
    this.#children.disconnect();
    this.removeEventListener("click", this.#mountVideo, true);
    this.removeEventListener("close", this.#pauseVideo, true);
  }

  #observeChildren() {
    this.#resizer.disconnect();
    for (const child of this.children) this.#resizer.observe(child);
    this.#setSpans();
  }

  // Each item spans enough rows for its height plus the margin below it.
  // Changing spans inside the observer's callback makes browsers report a resize loop.
  #schedule() {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#setSpans();
    });
  }

  #setSpans() {
    const row = parseFloat(
      getComputedStyle(this).getPropertyValue("--review-row"),
    );
    if (!row) return;
    const items = [...this.children];
    // Read every size before writing any span, so the browser lays out once.
    const spans = items.map((item) => {
      const margin = parseFloat(getComputedStyle(item).marginBottom);
      return Math.ceil((item.getBoundingClientRect().height + margin) / row);
    });
    items.forEach((item, index) =>
      item.style.setProperty("--review-span", spans[index]),
    );
    this.dataset.masonry = "";
  }

  #mountVideo = (event) => {
    const opener = event.target.closest?.("[data-dialog-open]");
    if (!opener) return;
    const template = document
      .getElementById(opener.dataset.dialogOpen)
      ?.querySelector("template[data-review-video]");
    if (template) template.replaceWith(template.content);
  };

  #pauseVideo = (event) => {
    event.target.querySelector?.("video")?.pause();
  };
}

if (!customElements.get("review-wall")) {
  customElements.define("review-wall", ReviewWall);
}
