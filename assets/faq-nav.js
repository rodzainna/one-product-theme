// Highlights the category being read, and keeps the links in step in the theme editor.
// A category is current once its top passes this share of the screen height.
const LINE = 0.35;

class FaqNav extends HTMLElement {
  #links = [];
  #current;
  #frame = 0;
  #pinned = false;

  connectedCallback() {
    this.#links = [...this.querySelectorAll("a")];
    addEventListener("scroll", this.#onScroll, { passive: true });
    addEventListener("resize", this.#onScroll);
    this.addEventListener("click", this.#onClick);
    for (const type of ["wheel", "touchmove", "keydown"]) {
      addEventListener(type, this.#release, { passive: true });
    }
    this.#update();
    if (window.Shopify?.designMode) {
      document.addEventListener("shopify:block:load", this.#onBlockLoad);
    }
  }

  disconnectedCallback() {
    removeEventListener("scroll", this.#onScroll);
    removeEventListener("resize", this.#onScroll);
    for (const type of ["wheel", "touchmove", "keydown"]) {
      removeEventListener(type, this.#release);
    }
    document.removeEventListener("shopify:block:load", this.#onBlockLoad);
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#pinned = false;
  }

  #onScroll = () => {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#update();
    });
  };

  // A clicked link stays current until the reader scrolls on, because the page may not be able
  // to scroll far enough to bring its category to the line.
  #onClick = (event) => {
    const link = event.target.closest("a");
    const plain =
      event.button === 0 &&
      !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
    if (!link || !plain) return;
    this.#pinned = true;
    this.#setCurrent(link);
  };

  #release = () => {
    this.#pinned = false;
  };

  #update() {
    if (this.#pinned) return;
    const line = innerHeight * LINE;
    let current = this.#links[0];
    for (const link of this.#links) {
      const group = document.getElementById(link.hash.slice(1));
      if (group && group.getBoundingClientRect().top <= line) current = link;
    }
    // A short last category can't reach the line, so the end of the page counts for it.
    const atEnd =
      scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
    if (atEnd && scrollY > 0) current = this.#links.at(-1);
    if (current && current !== this.#current) this.#setCurrent(current);
  }

  #setCurrent(link) {
    this.#current = link;
    for (const a of this.#links) a.removeAttribute("aria-current");
    link.setAttribute("aria-current", "true");
    // Phones: keep the current pill in view; nothing happens when the list fits.
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const inset = parseFloat(getComputedStyle(this).paddingInlineStart) || 0;
    this.scrollTo({
      left: link.offsetLeft - inset,
      behavior: smooth ? "smooth" : "instant",
    });
  }

  // Editing a category's title re-renders only that block, so the link would keep the old name.
  #onBlockLoad = (event) => {
    const group = event.target.querySelector?.(".faq-group");
    const title = group?.querySelector(".faq-group__title");
    const link = this.#links.find((a) => a.hash === `#${group?.id}`);
    if (title && link) link.textContent = title.textContent;
  };
}

customElements.define("faq-nav", FaqNav);
