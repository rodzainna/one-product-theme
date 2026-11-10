/**
 * Each section pins and the next slides over it. Sticky boxes can't be snap targets,
 * so invisible markers sit at each section's natural place; anchors and reloads use them.
 * Fires `stacked-sections:change` on main with `{ sections, index }` when the current section
 * changes, and again on `stacked-sections:request`.
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
  let focusing = false;
  let current = -1;
  let frame = 0;

  // offsetTop reports the pinned position of a sticky box, so add up heights instead.
  const place = () => {
    if (!desktop.matches) return;
    const heights = sections.map((section) => section.offsetHeight);
    let top = 0;
    sections.forEach((section, index) => {
      // A tall section scrolls to its bottom before it pins.
      section.style.setProperty(
        "--stick-top",
        `${Math.min(0, innerHeight - heights[index])}px`,
      );
      markers[index].style.top = `${top}px`;
      markers[index].style.height = `${heights[index]}px`;
      top += heights[index];
    });
    announce();
  };

  const observer = new ResizeObserver(place);

  // The theme editor replaces a section's element when it re-renders, so rebuild from the DOM.
  const build = (event) => {
    const leaving =
      event?.type === "shopify:section:unload" ? event.target : null;
    observer.disconnect();
    markers.forEach((marker) => marker.remove());
    sections = [...main.children].filter(
      (el) => el.classList.contains("shopify-section") && el !== leaving,
    );
    markers = sections.map((section, index) => {
      const marker = document.createElement("div");
      marker.className = "snap-marker";
      marker.setAttribute("aria-hidden", "true");
      if (index === 0) marker.classList.add("snap-marker--first");
      else if (!section.querySelector(".section-full")) {
        marker.classList.add("snap-marker--end");
      }
      main.append(marker);
      return marker;
    });
    sections.forEach((section) => observer.observe(section));
    current = -1;
    place();
  };

  const indexOf = (element) =>
    element ? sections.findIndex((section) => section.contains(element)) : -1;

  const scrollToSection = (index, behavior) => {
    place();
    const marker = markers[index];
    const { top, height } = marker.getBoundingClientRect();
    // A short section rests with its bottom at the bottom of the screen, as it snaps.
    const offset = marker.classList.contains("snap-marker--end")
      ? Math.min(0, height - innerHeight)
      : 0;
    scrollTo({ top: top + offset + scrollY, behavior });
  };

  // The last section past the middle of the screen, or a short one that has fully arrived.
  const currentIndex = () =>
    Math.max(
      0,
      markers.findLastIndex((marker) => {
        const { top, bottom } = marker.getBoundingClientRect();
        return top <= innerHeight / 2 || Math.round(bottom) <= innerHeight;
      }),
    );

  const announce = () => {
    const index = currentIndex();
    if (index === current) return;
    current = index;
    main.dispatchEvent(
      new CustomEvent("stacked-sections:change", {
        detail: { sections, index },
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
      current = -1;
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
    root.classList.remove("stack-ready");
    history.scrollRestoration = "auto";
  };
}
