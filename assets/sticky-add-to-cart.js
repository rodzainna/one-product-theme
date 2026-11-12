/**
 * Shows the bar once the buy box's Add to cart is out of view: scrolled above the screen,
 * covered by the next stacked section, or still below the screen while the shopper reads
 * the buy box's details. The bar is a manual popover, so it sits in the top layer above
 * stacked sections. Its height goes in --sticky-bar-h on <html> for the footer and scroll
 * padding. The button submits the buy box's own form.
 */
const root = document.documentElement;
const shown = new Set();

// The tallest visible bar sets the room the page leaves, so several bars don't undo each other.
const updateRoom = () => {
  const height = Math.max(0, ...[...shown].map((bar) => bar.offsetHeight));
  if (height) root.style.setProperty("--sticky-bar-h", `${height}px`);
  else root.style.removeProperty("--sticky-bar-h");
};

// The next section that takes up space; snap markers and empty or hidden sections don't count.
const nextSection = (section) => {
  let next = section.nextElementSibling;
  while (next) {
    if (next.matches(".shopify-section") && next.offsetHeight > 0) return next;
    next = next.nextElementSibling;
  }
  return null;
};

export class StickyAddToCart extends HTMLElement {
  #frame = 0;
  #section = null;
  #resize = new ResizeObserver(() => {
    this.#schedule();
    if (shown.has(this)) updateRoom();
  });

  connectedCallback() {
    this.#section = this.closest(".shopify-section");
    addEventListener("scroll", this.#schedule, { passive: true });
    addEventListener("resize", this.#schedule);
    // Images loading or a variant swap move Add to cart without any scrolling.
    this.#resize.observe(this);
    if (this.#section) this.#resize.observe(this.#section);
    this.#update();
  }

  disconnectedCallback() {
    removeEventListener("scroll", this.#schedule);
    removeEventListener("resize", this.#schedule);
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#resize.disconnect();
    shown.delete(this);
    updateRoom();
  }

  get visible() {
    return shown.has(this);
  }

  #schedule = () => {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#update();
    });
  };

  // Rects, not an IntersectionObserver: a pinned, stacked buy box never leaves the screen.
  #update() {
    // The button is swapped on every variant change, so it's looked up each time.
    const button = document.getElementById(this.dataset.button);
    const section = this.#section;
    if (!button || !section) return this.#show(false);
    const { top, bottom } = button.getBoundingClientRect();
    const next = nextSection(section)?.getBoundingClientRect();
    const covered = next !== undefined && next.top < bottom;
    // On phones the gallery comes first, so wait until the shopper is into the details.
    const details = this.closest(".buy-box__info") ?? section;
    const belowScreen =
      top > innerHeight &&
      details.getBoundingClientRect().top < innerHeight / 2;
    this.#show(bottom < 0 || covered || belowScreen);
  }

  #show(visible) {
    if (this.visible === visible) return;
    if (visible) {
      shown.add(this);
      this.showPopover?.();
    } else {
      shown.delete(this);
      this.hidePopover?.();
    }
    updateRoom();
  }
}

if (!customElements.get("sticky-add-to-cart")) {
  customElements.define("sticky-add-to-cart", StickyAddToCart);
}
