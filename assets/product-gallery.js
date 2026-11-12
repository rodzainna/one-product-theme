/**
 * Shows one media at a time on desktop, chosen by its thumbnail, and keeps a swipe row on
 * phones. When another variant is picked (Shopify's standard `shopify:product:select`),
 * it jumps to the media the re-rendered section marks as the variant's. Media that leaves
 * view is paused. 3D models get Shopify's AR button through Shopify's XR feature.
 */
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

// Videos and models that are playing stop when they're no longer the one in view.
const pause = (item) => {
  for (const video of item.querySelectorAll("video")) video.pause();
  for (const frame of item.querySelectorAll("iframe")) {
    const youtube = /youtube/.test(frame.src);
    frame.contentWindow?.postMessage(
      youtube
        ? JSON.stringify({ event: "command", func: "pauseVideo", args: "" })
        : JSON.stringify({ method: "pause" }),
      "*",
    );
  }
  for (const model of item.querySelectorAll("model-viewer")) model.pause?.();
};

export class ProductGallery extends HTMLElement {
  #section;
  #track;
  #observer;
  #resize;

  connectedCallback() {
    this.#section = this.closest(".shopify-section") ?? document;
    this.#track = this.querySelector(".gallery__track");
    this.addEventListener("click", this.#onClick);
    this.#section.addEventListener("shopify:product:select", this.#onSelect);

    // On phones the row scrolls; the item mostly in view becomes the current one.
    this.#observer = new IntersectionObserver(this.#onIntersect, {
      root: this.#track,
      threshold: 0.6,
    });
    for (const item of this.items) this.#observer.observe(item);

    // A scrolling row needs to take keyboard focus; a row that doesn't scroll shouldn't.
    this.#resize = new ResizeObserver(() => {
      if (this.#scrolls) this.#track.tabIndex = 0;
      else this.#track.removeAttribute("tabindex");
    });
    this.#resize.observe(this.#track);

    this.#setUpModels();
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.#onClick);
    this.#section.removeEventListener("shopify:product:select", this.#onSelect);
    this.#observer.disconnect();
    this.#resize.disconnect();
  }

  get items() {
    return [...this.querySelectorAll(".gallery__item")];
  }

  get #scrolls() {
    return this.#track.scrollWidth > this.#track.clientWidth;
  }

  #onClick = (event) => {
    const poster = event.target.closest(".product-media__poster");
    if (poster) return this.#loadPlayer(poster);
    const thumb = event.target.closest(".gallery__thumb");
    if (thumb) this.show(thumb.dataset.mediaId);
  };

  // Scrolls the thumbnail row, never the page, so the current thumbnail is in view.
  #reveal(thumb) {
    const row = thumb.closest(".gallery__thumbs");
    if (row.scrollWidth <= row.clientWidth) return;
    const rowBox = row.getBoundingClientRect();
    const box = thumb.getBoundingClientRect();
    if (box.left >= rowBox.left && box.right <= rowBox.right) return;
    row.scrollTo({
      left:
        row.scrollLeft +
        box.left -
        rowBox.left -
        (rowBox.width - box.width) / 2,
      behavior: reducedMotion.matches ? "auto" : "smooth",
    });
  }

  // A pressed poster becomes the player from its template, which then starts.
  #loadPlayer(poster) {
    const frame = poster.parentElement;
    const template = frame.querySelector("template");
    if (!template) return;
    // A tapped peeking media becomes current, so it's paused when the shopper moves on.
    const item = poster.closest(".gallery__item");
    if (!item.hasAttribute("data-current")) this.show(item.dataset.mediaId);
    poster.replaceWith(template.content.cloneNode(true));
    template.remove();
    const player = frame.querySelector("video, iframe, model-viewer");
    if (!player) return;
    // Shopify defines <model-viewer> once it sees one; until then it can't take focus.
    const ready = player.localName.includes("-")
      ? customElements.whenDefined(player.localName)
      : Promise.resolve();
    // <model-viewer> takes keyboard input on a control inside its open shadow root.
    ready.then(() => {
      // The shopper may have moved on while the viewer was loading.
      if (!item.hasAttribute("data-current")) return;
      const control = player.shadowRoot?.querySelector(
        '[tabindex]:not([tabindex="-1"])',
      );
      (control ?? player).focus({ preventScroll: true });
    });
    if (player instanceof HTMLVideoElement) player.play().catch(() => {});
  }

  #onSelect = async (event) => {
    const result = await event.promise?.catch(() => null);
    const fresh = result?.doc?.getElementById(this.id);
    const mediaId = fresh?.dataset.variantMedia;
    if (mediaId) this.show(mediaId);
  };

  #onIntersect = (entries) => {
    if (!this.#scrolls) return;
    // Only a media at least 60% in view counts, never one that just peeks in.
    const visible = entries.find((entry) => entry.intersectionRatio >= 0.6);
    if (visible) this.#setCurrent(visible.target.dataset.mediaId);
  };

  /** Makes a media current and, in the phone row, scrolls it into view. */
  show(mediaId) {
    const item = this.#setCurrent(mediaId);
    if (!item || !this.#scrolls) return;
    // Scroll the row only, never the page.
    this.#track.scrollTo({
      left: item.offsetLeft - this.#track.offsetLeft,
      behavior: reducedMotion.matches ? "auto" : "smooth",
    });
  }

  #setCurrent(mediaId) {
    let current = null;
    for (const item of this.items) {
      const isCurrent = item.dataset.mediaId === mediaId;
      if (isCurrent) current = item;
      else if (item.hasAttribute("data-current")) pause(item);
      item.toggleAttribute("data-current", isCurrent);
    }
    if (!current) return null;
    for (const thumb of this.querySelectorAll(".gallery__thumb")) {
      const isCurrent = thumb.dataset.mediaId === mediaId;
      thumb.setAttribute("aria-current", String(isCurrent));
      if (isCurrent) this.#reveal(thumb);
    }
    return current;
  }

  // shopify.dev "Support product media": Shopify's XR library adds the AR button's behaviour.
  #setUpModels() {
    const data = this.querySelector("script[data-models]");
    if (!data || !window.Shopify?.loadFeatures) return;
    const models = JSON.parse(data.textContent);
    const setUp = () => {
      window.ShopifyXR.addModels(models);
      window.ShopifyXR.setupXRElements();
    };
    window.Shopify.loadFeatures([
      {
        name: "shopify-xr",
        version: "1.0",
        onLoad: (errors) => {
          if (errors) return;
          if (window.ShopifyXR) setUp();
          else
            document.addEventListener("shopify_xr_initialized", setUp, {
              once: true,
            });
        },
      },
    ]);
  }
}

if (!customElements.get("product-gallery")) {
  customElements.define("product-gallery", ProductGallery);
}
