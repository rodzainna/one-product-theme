// The hero's background video (off for reduced motion and data saver) and its scroll cue.
const IGNORED = ["NotAllowedError", "AbortError"];

class HeroSection extends HTMLElement {
  #video;
  #toggle;
  #cue;
  #reducedMotion;

  connectedCallback() {
    this.#cue = this.querySelector("[data-hero-cue]");
    this.#cue?.addEventListener("click", this.#pointCue);
    this.#pointCue();

    this.#video = this.querySelector("video");
    this.#toggle = this.querySelector("[data-hero-toggle]");
    if (!this.#video || !this.#toggle) return;

    this.#reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    this.#toggle.addEventListener("click", this.#onToggle);
    this.#video.addEventListener("playing", this.#sync);
    this.#video.addEventListener("pause", this.#sync);
    this.#reducedMotion.addEventListener("change", this.#onMotionChange);
    if (this.#motionAllowed()) this.#play();
  }

  disconnectedCallback() {
    this.#cue?.removeEventListener("click", this.#pointCue);
    this.#toggle?.removeEventListener("click", this.#onToggle);
    this.#video?.removeEventListener("playing", this.#sync);
    this.#video?.removeEventListener("pause", this.#sync);
    this.#reducedMotion?.removeEventListener("change", this.#onMotionChange);
  }

  #motionAllowed() {
    return !this.#reducedMotion.matches && !navigator.connection?.saveData;
  }

  // Also runs on click, because sections can be added, removed or emptied after load.
  #pointCue = () => {
    let next = this.closest(".shopify-section")?.nextElementSibling;
    while (next && next.querySelector(":scope > [data-empty]"))
      next = next.nextElementSibling;
    if (!this.#cue || !next?.id) return;
    this.#cue.href = `#${next.id}`;
    this.#cue.hidden = false;
  };

  #play() {
    this.#video.play().catch((error) => {
      if (!IGNORED.includes(error.name)) throw error;
    });
  }

  // The video decides: the browser can pause it too, not only the button.
  #sync = () => {
    const allowed = this.#motionAllowed();
    const paused = this.#video.paused;
    this.toggleAttribute("data-playing", allowed && !paused);
    this.toggleAttribute("data-paused", allowed && paused);
    this.#toggle.hidden = !allowed;
    this.#toggle.setAttribute(
      "aria-label",
      paused ? this.#toggle.dataset.play : this.#toggle.dataset.pause,
    );
    this.#toggle.querySelector('[data-hero-icon="pause"]').hidden = paused;
    this.#toggle.querySelector('[data-hero-icon="play"]').hidden = !paused;
  };

  #onToggle = () => {
    if (this.#video.paused) this.#play();
    else this.#video.pause();
  };

  #onMotionChange = () => {
    if (this.#motionAllowed()) this.#play();
    else this.#video.pause();
  };
}

if (!customElements.get("hero-section"))
  customElements.define("hero-section", HeroSection);
