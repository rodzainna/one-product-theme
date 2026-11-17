/**
 * Opens and closes the header menu's sub-menus. A button with aria-expanded shows or hides its
 * panel. In the header row a panel also opens on mouse hover (data-hover) and closes when the
 * mouse leaves, unless a click or the keyboard has taken it over; it closes on Esc (focus returns
 * to its button), when focus leaves it, and on a click outside. In the phone drawer the lists
 * expand in place, and a link closes the drawer.
 */
const ITEM = ".menu--bar [data-submenu]";
const OPEN = ".menu--bar .menu__toggle[aria-expanded='true']";

const toggleOf = (item) => item.querySelector(":scope > .menu__toggle");
const isOpen = (toggle) => toggle.getAttribute("aria-expanded") === "true";
const setOpen = (toggle, open) =>
  toggle.setAttribute("aria-expanded", String(open));

const close = (item) => {
  setOpen(toggleOf(item), false);
  item.removeAttribute("data-hover");
};

const closeBar = (except = null, { keepFocused = false } = {}) => {
  for (const toggle of document.querySelectorAll(OPEN)) {
    const item = toggle.closest("[data-submenu]");
    if (item === except) continue;
    if (keepFocused && item.contains(document.activeElement)) continue;
    close(item);
  }
};

document.addEventListener("click", (event) => {
  const toggle = event.target.closest(".menu__toggle");
  if (toggle) {
    const item = toggle.closest("[data-submenu]");
    if (toggle.closest(".menu--bar")) closeBar(item);
    // A click on a panel the mouse just opened keeps it open instead of closing it again.
    if (item.hasAttribute("data-hover")) item.removeAttribute("data-hover");
    else if (isOpen(toggle)) close(item);
    else setOpen(toggle, true);
    return;
  }
  if (!event.target.closest(ITEM)) closeBar();
  const link = event.target.closest(".menu--drawer a[href]");
  // Opening a link in another tab or window leaves the page, and the drawer, as it is.
  const staysHere =
    !link?.target &&
    event.button === 0 &&
    !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
  if (link && staysHere) link.closest("dialog").close();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const open = document.querySelector(OPEN);
  if (!open) return;
  const hadFocus = open
    .closest("[data-submenu]")
    .contains(document.activeElement);
  closeBar();
  if (hadFocus) open.focus();
});

// Tabbing out of an open panel closes it. A null relatedTarget is a click on something that can't take focus.
document.addEventListener("focusout", (event) => {
  const item = event.target.closest?.(ITEM);
  if (!item || !event.relatedTarget || item.contains(event.relatedTarget))
    return;
  close(item);
});

// Keyboard focus takes a hover-opened panel over; a click's focus must not, or its click would close it.
document.addEventListener("focusin", (event) => {
  if (event.target.matches(":focus-visible")) {
    event.target.closest(ITEM)?.removeAttribute("data-hover");
  }
});

// Mouse only: touch has the button, and a hover that lingers after a tap would hold the panel open.
document.addEventListener("pointerover", (event) => {
  if (event.pointerType !== "mouse") return;
  const item = event.target.closest(ITEM);
  if (!item || item.contains(event.relatedTarget)) return;
  // A panel the keyboard is inside stays, so a drifting mouse can't take focus away from it.
  closeBar(item, { keepFocused: true });
  if (isOpen(toggleOf(item))) return;
  setOpen(toggleOf(item), true);
  item.setAttribute("data-hover", "");
});

document.addEventListener("pointerout", (event) => {
  if (event.pointerType !== "mouse") return;
  const item = event.target.closest(ITEM);
  if (!item || item.contains(event.relatedTarget)) return;
  // Opened by a click or the keyboard: it stays until Esc, Tab or a click outside.
  if (item.hasAttribute("data-hover")) close(item);
});

// The drawer is for phones; widening the window to the header row closes it.
matchMedia("(min-width: 900px)").addEventListener("change", ({ matches }) => {
  if (matches) document.getElementById("MenuDrawer")?.close();
});
