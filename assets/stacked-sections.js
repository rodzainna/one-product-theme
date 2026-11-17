/**
 * Each section pins and the next slides over it. Sticky boxes can't be snap targets,
 * so invisible markers sit at each section's natural place; anchors and reloads use them.
 * On desktop, marks the current section with `data-current` and fires `stacked-sections:change`
 * on main with `{ sections, index }` when it changes, and again on `stacked-sections:request`.
 * Empty sections are never current and are left out of `sections`.
 */
const DESKTOP = "(min-width: 900px) and (pointer: fine)";
const EDITOR_CHANGES = [
  "shopify:section:load",
  "shopify:section:unload",
  "shopify:section:reorder",
];
const EDITOR_SELECTS = ["shopify:section:select", "shopify:block:select"];

// Reading sessionStorage throws when the browser blocks site storage.
const sessionStore = () => {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
};

const sameList = (a, b) =>
  a.length === b.length && a.every((item, n) => item === b[n]);

const withoutHash = (url) => url.split("#")[0];

const targetOf = (hash) => {
  try {
    return hash.length > 1
      ? document.getElementById(decodeURIComponent(hash.slice(1)))
      : null;
  } catch {
    return null;
  }
};

export function stackSections({
  main = document.querySelector("#MainContent"),
  header = document.querySelector(".header-group"),
  root = document.documentElement,
  storage = sessionStore(),
} = {}) {
  const desktop = matchMedia(DESKTOP);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const storageKey = `stacked-section:${location.pathname}`;
  const controller = new AbortController();
  const { signal } = controller;
  let sections = [];
  let markers = [];
  let full = [];
  let first = 0;
  let filled = [];
  let focusing = false;
  let current = null;
  let stale = true;
  let frame = 0;

  const shown = () => sections.filter((_, index) => filled[index]);

  // A sticky header covers the top of the screen; sections pin and rest below it.
  const headerOffset = () =>
    parseFloat(getComputedStyle(root).getPropertyValue("--header-offset")) || 0;

  // offsetTop reports the pinned position of a sticky box, so add up heights instead.
  const place = () => {
    if (!desktop.matches) return;
    const covered = headerOffset();
    const heights = sections.map((section) => section.offsetHeight);
    const before = filled;
    filled = heights.map((height) => height > 0);
    let top = 0;
    sections.forEach((section, index) => {
      // A tall section scrolls to its bottom before it pins.
      section.style.setProperty(
        "--stick-top",
        `${Math.min(covered, innerHeight - heights[index])}px`,
      );
      const marker = markers[index];
      marker.style.top = `${top}px`;
      marker.style.height = `${heights[index]}px`;
      marker.classList.toggle("snap-marker--empty", !filled[index]);
      // A section too tall for the room under the header pins by its bottom and rests at its top, like a full one.
      marker.classList.toggle(
        "snap-marker--end",
        index !== first &&
          filled[index] &&
          !full[index] &&
          heights[index] <= innerHeight - covered,
      );
      top += heights[index];
    });
    if (!sameList(before, filled)) stale = true;
    announce();
  };

  const observer = new ResizeObserver(place);

  // The theme editor replaces a section's element when it re-renders, so rebuild from the DOM.
  const build = (event) => {
    const leaving =
      event?.type === "shopify:section:unload" ? event.target : null;
    observer.disconnect();
    markers.forEach((marker) => marker.remove());
    leaving?.removeAttribute("data-current");
    sections = [...main.children].filter(
      (el) => el.classList.contains("shopify-section") && el !== leaving,
    );
    full = sections.map((section) => !!section.querySelector(".section-full"));
    // Same "first section" rule as critical.css, so the CSS and markers agree.
    first = sections.findIndex(
      (section) => !section.querySelector(":scope > [data-empty]"),
    );
    filled = [];
    stale = true;
    markers = sections.map((section, index) => {
      const marker = document.createElement("div");
      marker.className = "snap-marker";
      marker.setAttribute("aria-hidden", "true");
      if (index === first) marker.classList.add("snap-marker--first");
      main.append(marker);
      return marker;
    });
    sections.forEach((section) => observer.observe(section));
    if (header) observer.observe(header);
    place();
  };

  const indexOf = (element) =>
    element ? sections.findIndex((section) => section.contains(element)) : -1;

  const scrollToSection = (index, behavior) => {
    place();
    // An empty section has no place of its own, so go to the next one that does.
    const next = filled.findIndex((isFilled, n) => n >= index && isFilled);
    const marker = markers[next >= 0 ? next : index];
    if (marker.classList.contains("snap-marker--first")) {
      // The first section rests with the whole header group above it.
      scrollTo({ top: 0, behavior });
      return;
    }
    const { top, height } = marker.getBoundingClientRect();
    // A short section rests with its bottom at the bottom of the screen, as it snaps.
    const gap = marker.classList.contains("snap-marker--end")
      ? innerHeight - height
      : headerOffset();
    scrollTo({ top: top + scrollY - gap, behavior });
  };

  // The last section past the middle of the screen, or a short one that has fully arrived.
  const currentIndex = () => {
    const index = markers.findLastIndex((marker, n) => {
      if (!filled[n]) return false;
      const { top, bottom } = marker.getBoundingClientRect();
      return top <= innerHeight / 2 || Math.round(bottom) <= innerHeight;
    });
    return index >= 0 ? index : filled.indexOf(true);
  };

  const announce = () => {
    if (!desktop.matches) return;
    const section = sections[currentIndex()] ?? null;
    if (!stale && section === current) return;
    stale = false;
    current = section;
    sections.forEach((s) => s.toggleAttribute("data-current", s === section));
    const list = shown();
    main.dispatchEvent(
      new CustomEvent("stacked-sections:change", {
        detail: { sections: list, index: list.indexOf(section) },
      }),
    );
  };

  const onScroll = () => {
    if (!desktop.matches) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(announce);
  };

  // A pinned section looks already on screen, so the browser won't scroll to it.
  const onClick = (event) => {
    if (!desktop.matches || event.defaultPrevented || event.button !== 0)
      return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    const link = event.target.closest("a[href*='#']");
    if (!link || (link.target && link.target !== "_self")) return;
    if (withoutHash(link.href) !== withoutHash(location.href)) return;
    const target = targetOf(link.hash);
    const index = indexOf(target);
    if (index < 0) return;

    event.preventDefault();
    if (link.hash !== location.hash) {
      history.replaceState(
        { ...history.state, stackedSection: currentIndex() },
        "",
      );
      history.pushState({ stackedSection: index }, "", link.hash);
    }
    scrollToSection(index, reducedMotion.matches ? "instant" : "smooth");
    if (!target.matches("a, button, input, select, textarea, [tabindex]")) {
      target.setAttribute("tabindex", "-1");
    }
    focusing = true;
    target.focus({ preventScroll: true });
    focusing = false;
  };

  // Focus moving into a pinned section stays hidden under the sections covering it.
  const onFocusIn = ({ target }) => {
    if (!desktop.matches || focusing) return;
    requestAnimationFrame(() => {
      const index = indexOf(target);
      if (index < 0) return;
      const { left, top, width, height } = target.getBoundingClientRect();
      const hit = document.elementFromPoint(left + width / 2, top + height / 2);
      if (hit && !sections[index].contains(hit)) {
        scrollToSection(index, "instant");
      }
    });
  };

  // Manual scroll restoration also stops Back and Forward from moving between hash entries.
  const onPopState = (event) => {
    if (!desktop.matches) return;
    const index =
      event.state?.stackedSection ?? indexOf(targetOf(location.hash));
    if (sections[index]) scrollToSection(index, "instant");
  };

  // The editor's own scroll can't reach a pinned section either.
  const onEditorSelect = (event) => {
    const index = indexOf(event.target);
    if (desktop.matches && index >= 0) scrollToSection(index, "instant");
  };

  const onPageHide = () => {
    if (desktop.matches) storage?.setItem(storageKey, String(currentIndex()));
  };

  // Fonts and images can still change section heights, so land again at load unless the visitor moved.
  const restore = (index) => {
    scrollToSection(index, "instant");
    if (document.readyState === "complete") return;
    const landed = scrollY;
    addEventListener(
      "load",
      () => {
        if (scrollY === landed) scrollToSection(index, "instant");
      },
      { once: true, signal },
    );
  };

  build();
  // Sticky and marker snapping wait until the markers are placed; until then sections snap as usual.
  const ready = requestAnimationFrame(() => root.classList.add("stack-ready"));

  addEventListener("resize", place, { signal });
  desktop.addEventListener("change", place, { signal });
  addEventListener("scroll", onScroll, { passive: true, signal });
  main.addEventListener(
    "stacked-sections:request",
    () => {
      stale = true;
      announce();
    },
    { signal },
  );
  addEventListener("pagehide", onPageHide, { signal });
  addEventListener("popstate", onPopState, { signal });
  document.addEventListener("click", onClick, { signal });
  document.addEventListener("focusin", onFocusIn, { signal });
  EDITOR_CHANGES.forEach((type) =>
    document.addEventListener(type, build, { signal }),
  );
  EDITOR_SELECTS.forEach((type) =>
    document.addEventListener(type, onEditorSelect, { signal }),
  );

  // Restore the section, not the pixel offset: pixels come back before sections have their height.
  if (desktop.matches) {
    history.scrollRestoration = "manual";
    const navigation = performance.getEntriesByType("navigation")[0]?.type;
    const saved = Number(storage?.getItem(storageKey));
    const hashIndex = indexOf(targetOf(location.hash));
    if (hashIndex >= 0) restore(hashIndex);
    else if (navigation !== "navigate" && saved > 0 && sections[saved]) {
      restore(saved);
    }
  }

  return () => {
    cancelAnimationFrame(ready);
    cancelAnimationFrame(frame);
    controller.abort();
    observer.disconnect();
    markers.forEach((marker) => marker.remove());
    sections.forEach((section) => section.removeAttribute("data-current"));
    root.classList.remove("stack-ready");
    history.scrollRestoration = "auto";
  };
}
