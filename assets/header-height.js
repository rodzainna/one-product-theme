/**
 * Keeps the header group's heights on <html>: the whole group, the part above the header (an
 * announcement bar) that scrolls away, and the header with anything below it, which stays.
 */
export function trackHeaderHeight(
  group = document.querySelector(".header-group"),
  root = document.documentElement,
) {
  const update = () => {
    const total = group?.offsetHeight ?? 0;
    const header = group?.querySelector(".site-header");
    let above = 0;
    for (const section of group?.children ?? []) {
      if (section.contains(header)) break;
      above += section.offsetHeight;
    }
    root.style.setProperty("--header-group-h", `${total}px`);
    root.style.setProperty("--header-above-h", `${above}px`);
    root.style.setProperty("--header-h", `${total - above}px`);
  };
  update();
  const observer = new ResizeObserver(update);
  if (group) observer.observe(group, { box: "border-box" });
  return observer;
}
