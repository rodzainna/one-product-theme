/**
 * Places a tooltip's popover bubble next to its button and opens it on mouse hover.
 * The native popover already handles tap, Enter, Esc and clicking away.
 */
export const GAP = 8;
export const CLOSE_DELAY = 150;

export class ToolTip extends HTMLElement {
  #closing;
  #frame = 0;
  #openedByHover = false;

  connectedCallback() {
    this.button = this.querySelector("button");
    this.bubble = this.querySelector("[popover]");
    this.bubble.addEventListener("beforetoggle", this.#onBeforeToggle);
    this.bubble.addEventListener("toggle", this.#onToggle);
    this.addEventListener("pointerenter", this.#onEnter);
    this.addEventListener("pointerleave", this.#onLeave);
    this.button.addEventListener("click", this.#onClick);
  }

  disconnectedCallback() {
    clearTimeout(this.#closing);
    this.#stopFollowing();
    this.bubble.removeEventListener("beforetoggle", this.#onBeforeToggle);
    this.bubble.removeEventListener("toggle", this.#onToggle);
    this.removeEventListener("pointerenter", this.#onEnter);
    this.removeEventListener("pointerleave", this.#onLeave);
    this.button.removeEventListener("click", this.#onClick);
  }

  /** Centres the bubble on the button, above it when there's room, kept 8px inside the viewport. */
  place = () => {
    const button = this.button.getBoundingClientRect();
    const bubble = this.bubble.getBoundingClientRect();
    // clientWidth, not innerWidth: an overflowing bubble stretches innerWidth on phones.
    const width = document.documentElement.clientWidth;
    const left = button.left + button.width / 2 - bubble.width / 2;
    const above = button.top - bubble.height - GAP;
    this.bubble.style.left = `${Math.max(GAP, Math.min(left, width - GAP - bubble.width))}px`;
    this.bubble.style.top = `${above < GAP ? button.bottom + GAP : above}px`;
    this.bubble.style.visibility = "";
  };

  #follow = () => {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.place();
    });
  };

  #stopFollowing() {
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    removeEventListener("scroll", this.#follow, { capture: true });
    removeEventListener("resize", this.#follow);
  }

  // Hidden until placed, so it never paints a frame in the wrong spot.
  #onBeforeToggle = (event) => {
    if (event.newState !== "open") return;
    // Set here, not in CSS, so without JS the browser's centred default still applies.
    this.bubble.style.inset = "auto";
    this.bubble.style.margin = "0";
    this.bubble.style.visibility = "hidden";
  };

  #onToggle = (event) => {
    if (event.newState === "open") {
      if (this.bubble.style.visibility === "hidden") this.place();
      addEventListener("scroll", this.#follow, {
        passive: true,
        capture: true,
      });
      addEventListener("resize", this.#follow);
    } else {
      clearTimeout(this.#closing);
      this.#openedByHover = false;
      this.#stopFollowing();
    }
  };

  #onEnter = (event) => {
    clearTimeout(this.#closing);
    if (event.pointerType !== "mouse" || this.bubble.matches(":popover-open"))
      return;
    this.bubble.showPopover();
    this.place();
    this.#openedByHover = true;
  };

  // The delay lets the pointer cross the gap onto the bubble (WCAG 1.4.13).
  #onLeave = () => {
    if (this.#openedByHover) {
      this.#closing = setTimeout(() => this.bubble.hidePopover(), CLOSE_DELAY);
    }
  };

  // A click on a hover-opened bubble pins it instead of closing it; the next click closes it.
  #onClick = (event) => {
    if (!this.#openedByHover) return;
    event.preventDefault();
    clearTimeout(this.#closing);
    this.#openedByHover = false;
  };
}

if (!customElements.get("tool-tip")) {
  customElements.define("tool-tip", ToolTip);
}
