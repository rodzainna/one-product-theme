import { afterEach, describe, expect, test, vi } from "vitest";
import "../../assets/hero.js";
import heroLiquid from "../../sections/hero.liquid?raw";

const stylesheet =
  heroLiquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

const hero = (video = true, cue = true) => `
  <div class="shopify-section" id="shopify-section-hero">
    <hero-section>
      ${video ? "<video loop muted></video>" : ""}
      ${
        video
          ? `<button type="button" data-hero-toggle data-pause="Pause" data-play="Play" aria-label="Pause" hidden>
              <span data-hero-icon="pause">||</span><span data-hero-icon="play" hidden>&gt;</span>
            </button>`
          : ""
      }
      ${cue ? '<a href="#MainContent" data-hero-cue hidden>Scroll</a>' : ""}
    </hero-section>
  </div>`;

let motionListeners;
let reducedMotion;
const render = (
  html,
  { motion = true, saveData = false, playError = null } = {},
) => {
  motionListeners = [];
  reducedMotion = !motion;
  vi.spyOn(window, "matchMedia").mockImplementation(() => ({
    get matches() {
      return reducedMotion;
    },
    addEventListener: (_, listener) => motionListeners.push(listener),
    removeEventListener: () => {},
  }));
  Object.defineProperty(navigator, "connection", {
    value: { saveData },
    configurable: true,
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function () {
    if (playError) return Promise.reject(playError);
    Object.defineProperty(this, "paused", { value: false, configurable: true });
    this.dispatchEvent(new Event("playing"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function () {
    Object.defineProperty(this, "paused", { value: true, configurable: true });
    this.dispatchEvent(new Event("pause"));
  });
  document.body.innerHTML = html;
};

afterEach(() => {
  vi.restoreAllMocks();
  delete navigator.connection;
  document.body.innerHTML = "";
});

describe("scroll cue", () => {
  test("points at the next section and shows", () => {
    render(
      `${hero(false)}<div class="shopify-section" id="shopify-section-next"></div>`,
    );
    const cue = document.querySelector("[data-hero-cue]");
    expect(cue.getAttribute("href")).toBe("#shopify-section-next");
    expect(cue.hidden).toBe(false);
  });

  test("skips sections that are empty", () => {
    render(`${hero(false)}
      <div class="shopify-section" id="shopify-section-empty"><div data-empty></div></div>
      <div class="shopify-section" id="shopify-section-filled"><div></div></div>`);
    expect(document.querySelector("[data-hero-cue]").getAttribute("href")).toBe(
      "#shopify-section-filled",
    );
  });

  test("stays hidden when nothing follows the hero", () => {
    render(hero(false));
    expect(document.querySelector("[data-hero-cue]").hidden).toBe(true);
  });
});

describe("background video", () => {
  test("plays, shows the pause button and marks the hero as playing", async () => {
    render(hero());
    const toggle = document.querySelector("[data-hero-toggle]");
    await expect.poll(() => toggle.hidden).toBe(false);
    expect(
      document.querySelector("hero-section").hasAttribute("data-playing"),
    ).toBe(true);
    expect(toggle.getAttribute("aria-label")).toBe("Pause");
  });

  test("the button pauses and plays again, and its name follows", () => {
    render(hero());
    const toggle = document.querySelector("[data-hero-toggle]");
    const section = document.querySelector("hero-section");

    toggle.click();
    expect(document.querySelector("video").paused).toBe(true);
    expect(section.hasAttribute("data-paused")).toBe(true);
    expect(section.hasAttribute("data-playing")).toBe(false);
    expect(toggle.getAttribute("aria-label")).toBe("Play");
    expect(document.querySelector('[data-hero-icon="play"]').hidden).toBe(
      false,
    );

    toggle.click();
    expect(section.hasAttribute("data-playing")).toBe(true);
    expect(toggle.getAttribute("aria-label")).toBe("Pause");
    expect(document.querySelector('[data-hero-icon="pause"]').hidden).toBe(
      false,
    );
  });

  test("doesn't play, and has no button, when the visitor reduces motion", () => {
    render(hero(), { motion: false });
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(document.querySelector("[data-hero-toggle]").hidden).toBe(true);
  });

  test("doesn't play when the visitor saves data", () => {
    render(hero(), { saveData: true });
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(document.querySelector("[data-hero-toggle]").hidden).toBe(true);
  });

  test("an image-only hero has nothing to control", () => {
    render(hero(false));
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  test("follows the browser pausing the video, not only the button", () => {
    render(hero());
    document.querySelector("video").pause();
    expect(
      document.querySelector("hero-section").hasAttribute("data-paused"),
    ).toBe(true);
    expect(
      document.querySelector("[data-hero-toggle]").getAttribute("aria-label"),
    ).toBe("Play");
  });

  test("plays when reduced motion is switched off and stops when it is switched on", () => {
    render(hero(), { motion: false });
    const section = document.querySelector("hero-section");
    const toggle = document.querySelector("[data-hero-toggle]");
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    reducedMotion = false;
    motionListeners.forEach((listener) => listener());
    expect(section.hasAttribute("data-playing")).toBe(true);
    expect(toggle.hidden).toBe(false);

    reducedMotion = true;
    motionListeners.forEach((listener) => listener());
    expect(section.hasAttribute("data-playing")).toBe(false);
    expect(section.hasAttribute("data-paused")).toBe(false);
    expect(toggle.hidden).toBe(true);
  });

  test("a blocked autoplay leaves the image and no error", async () => {
    render(hero(), {
      playError: new DOMException("blocked", "NotAllowedError"),
    });
    await Promise.resolve();
    expect(document.querySelector("[data-hero-toggle]").hidden).toBe(true);
  });
});

describe("scroll cue after the page changes", () => {
  test("follows sections that were added or emptied since load", () => {
    render(
      `${hero(false)}<div class="shopify-section" id="shopify-section-a"></div>`,
    );
    const cue = document.querySelector("[data-hero-cue]");
    expect(cue.getAttribute("href")).toBe("#shopify-section-a");

    document.querySelector("#shopify-section-a").remove();
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div class="shopify-section" id="shopify-section-b"></div>',
    );
    cue.click();
    expect(cue.getAttribute("href")).toBe("#shopify-section-b");
  });
});

describe("video over an image", () => {
  const renderMedia = ({ image, playing = false }) => {
    document.body.innerHTML = `
      <style>
        :root { --duration-settle: 0s; --ease: ease; }
        ${stylesheet}
      </style>
      <div class="hero"${playing ? " data-playing" : ""}>
        <div class="hero__media">
          ${image ? '<div class="image hero__image"><img alt=""></div>' : ""}
          <video class="hero__video"></video>
        </div>
      </div>`;
    return getComputedStyle(document.querySelector("video")).opacity;
  };

  test("with no image, the video's poster shows even if the video never plays", () => {
    expect(renderMedia({ image: false })).toBe("1");
  });

  test("with an image, the video stays hidden until it plays", () => {
    expect(renderMedia({ image: true })).toBe("0");
    expect(renderMedia({ image: true, playing: true })).toBe("1");
  });
});
