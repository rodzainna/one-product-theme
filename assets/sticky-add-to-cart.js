/**
 * Shows the bar once the buy box's Add to cart is out of view: scrolled above the screen,
 * covered by the next stacked section, or still below the screen while the shopper reads
 * the buy box's details. The bar is a manual popover, so it sits in the top layer above
 * stacked sections. Its height goes in --sticky-bar-h on <html> for the footer and scroll
 * padding. The button submits the buy box's own form.
 */
const root = document.documentElement;
const bars = new Set();
let frame = 0;

// The next section that takes up space; snap markers and empty or hidden sections don't count.
const nextSection = (section) => {
  let next = section.nextElementSibling;
  while (next) {
    if (next.matches(".shopify-section") && next.offsetHeight > 0) return next;
    next = next.nextElementSibling;
  }
  return null;
};

const follows = (a, b) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

export class StickyAddToCart extends HTMLElement {
  #section = null;
  #resize = new ResizeObserver(() => StickyAddToCart.#schedule());

  static #schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      StickyAddToCart.#updateAll();
    });
  };

  // Only the bar of the last buy box the shopper has reached can show, so a buy box further
  // up never covers a later one's Add to cart, even one without a bar of its own.
  static #updateAll() {
    const boxes = new Set(document.querySelectorAll(".buy-box"));
    for (const bar of bars) boxes.add(bar.#box());
    let current = null;
    for (const box of boxes) {
      if (!box?.isConnected) continue;
      if (box.getBoundingClientRect().top >= innerHeight) continue;
      if (!current || follows(current, box)) current = box;
    }
    let height = 0;
    for (const bar of bars) {
      const show = bar.#box() === current && bar.#wanted();
      bar.#show(show);
      if (show) height = bar.offsetHeight;
    }
    if (height) root.style.setProperty("--sticky-bar-h", `${height}px`);
    else root.style.removeProperty("--sticky-bar-h");
  }

  connectedCallback() {
    this.#section = this.closest(".shopify-section");
    if (!bars.size) {
      addEventListener("scroll", StickyAddToCart.#schedule, { passive: true });
      addEventListener("resize", StickyAddToCart.#schedule);
    }
    bars.add(this);
    // Images loading or a variant swap move Add to cart without any scrolling.
    this.#resize.observe(this);
    if (this.#section) this.#resize.observe(this.#section);
    StickyAddToCart.#schedule();
  }

  disconnectedCallback() {
    bars.delete(this);
    this.#resize.disconnect();
    if (!bars.size) {
      removeEventListener("scroll", StickyAddToCart.#schedule);
      removeEventListener("resize", StickyAddToCart.#schedule);
      cancelAnimationFrame(frame);
      frame = 0;
    }
    StickyAddToCart.#updateAll();
  }

  get visible() {
    return this.matches(":popover-open");
  }

  #box() {
    return this.closest(".buy-box") ?? this.#section;
  }

  // Rects, not an IntersectionObserver: a pinned, stacked buy box never leaves the screen.
  #wanted() {
    // The button is swapped on every variant change, so it's looked up each time.
    const button = document.getElementById(this.dataset.button);
    const section = this.#section;
    if (!button || !section) return false;
    const { top, bottom } = button.getBoundingClientRect();
    const next = nextSection(section)?.getBoundingClientRect();
    const covered = next !== undefined && next.top < bottom;
    // On phones the gallery comes first, so wait until the shopper is into the details.
    const details = this.closest(".buy-box__info") ?? section;
    const belowScreen =
      top > innerHeight &&
      details.getBoundingClientRect().top < innerHeight / 2;
    return bottom < 0 || covered || belowScreen;
  }

  #show(visible) {
    if (!this.isConnected || this.visible === visible) return;
    if (visible) this.showPopover?.();
    else this.hidePopover?.();
  }
}

if (!customElements.get("sticky-add-to-cart")) {
  customElements.define("sticky-add-to-cart", StickyAddToCart);
}
