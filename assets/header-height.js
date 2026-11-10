/** Keeps --header-group-h on <html> equal to the header group's height. */
export function trackHeaderHeight(
  group = document.querySelector(".header-group"),
  root = document.documentElement,
) {
  const update = () => {
    root.style.setProperty("--header-group-h", `${group?.offsetHeight ?? 0}px`);
  };
  update();
  const observer = new ResizeObserver(update);
  if (group) observer.observe(group, { box: "border-box" });
  return observer;
}
