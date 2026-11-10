/**
 * One dot per stacked section, following stacked-sections.js. Each dot is a link to its
 * section, so stacked-sections.js handles the scroll, focus and history.
 */
const SCHEME = ":scope > [class*='color-scheme-']";
const SCHEME_PROPERTIES = [
  "--color-foreground",
  "--color-background",
  "--focus-ring",
];

export function sectionDots({
  nav = document.querySelector(".section-dots"),
  main = document.querySelector("#MainContent"),
} = {}) {
  const list = nav.querySelector("ol");
  const controller = new AbortController();
  let sections = [];
  let links = [];

  const label = (section, index) =>
    section.querySelector("h1, h2")?.textContent.trim() ||
    nav.dataset.fallbackLabel.replace("[number]", index + 1);

  const render = () => {
    links = sections.map((section, index) => {
      const link = document.createElement("a");
      link.className = "section-dots__dot";
      link.href = `#${section.id}`;
      const text = document.createElement("span");
      text.className = "section-dots__label";
      text.textContent = label(section, index);
      link.append(text);
      return link;
    });
    list.replaceChildren(
      ...links.map((link) => {
        const item = document.createElement("li");
        item.append(link);
        return item;
      }),
    );
  };

  // The nav sits outside every section, so it borrows the current one's colours.
  const setCurrent = (index) => {
    links.forEach((link, n) => {
      if (n === index) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
    const section = sections[index];
    const scheme = getComputedStyle(section.querySelector(SCHEME) ?? section);
    SCHEME_PROPERTIES.forEach((property) =>
      nav.style.setProperty(property, scheme.getPropertyValue(property)),
    );
  };

  // Rebuilding the links would drop keyboard focus, so only rebuild when the sections change.
  const onChange = ({ detail }) => {
    const changed =
      detail.sections.length !== sections.length ||
      detail.sections.some((section, index) => section !== sections[index]);
    if (changed) {
      sections = detail.sections;
      render();
    }
    if (sections[detail.index]) setCurrent(detail.index);
  };

  // Escape hides the open label without moving focus (WCAG 1.4.13).
  const onKeyDown = (event) => {
    if (event.key === "Escape") nav.classList.add("section-dots--dismissed");
  };
  const onReturn = () => nav.classList.remove("section-dots--dismissed");

  const { signal } = controller;
  main.addEventListener("stacked-sections:change", onChange, { signal });
  document.addEventListener("keydown", onKeyDown, { signal });
  nav.addEventListener("focusin", onReturn, { signal });
  nav.addEventListener("pointerover", onReturn, { signal });
  // Stacking may have started first; ask it to announce again.
  main.dispatchEvent(new CustomEvent("stacked-sections:request"));

  return () => {
    controller.abort();
    list.replaceChildren();
    SCHEME_PROPERTIES.forEach((property) => nav.style.removeProperty(property));
  };
}
