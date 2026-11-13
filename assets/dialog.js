/**
 * Opens the <dialog> named by a [data-dialog-open] button as a modal, closes it from its
 * [data-dialog-close] button, and from a click outside when it has data-close-outside.
 * The browser handles Esc, the focus trap and returning focus to the opener.
 */
const root = document.documentElement;

// Measured while the scrollbar is still there, so the locked page can keep its width.
const measureScrollbar = () => {
  if (document.querySelector("dialog:modal")) return;
  root.style.setProperty(
    "--scrollbar-width",
    `${innerWidth - root.clientWidth}px`,
  );
};

const isOutside = (dialog, event) => {
  const box = dialog.getBoundingClientRect();
  return (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  );
};

// Press and release must both land outside, so dragging out while selecting text doesn't close it.
let pressedOutside = null;

const onPointerDown = (event) => {
  const dialog = event.target.closest?.("dialog[open][data-close-outside]");
  pressedOutside =
    dialog && event.target === dialog && isOutside(dialog, event)
      ? dialog
      : null;
};

/** Opens a <dialog> as a modal, keeping the page's width while its scrollbar is hidden. */
export const openDialog = (dialog) => {
  if (!dialog || dialog.open) return;
  measureScrollbar();
  dialog.showModal();
};

const onClick = (event) => {
  const opener = event.target.closest("[data-dialog-open]");
  if (opener) {
    openDialog(document.getElementById(opener.dataset.dialogOpen));
    return;
  }
  const closer = event.target.closest("[data-dialog-close]");
  if (closer) {
    closer.closest("dialog")?.close();
    return;
  }
  if (
    pressedOutside &&
    event.target === pressedOutside &&
    isOutside(pressedOutside, event)
  ) {
    pressedOutside.close();
  }
  pressedOutside = null;
};

// A module runs once per page, however many dialogs load it.
document.addEventListener("pointerdown", onPointerDown);
document.addEventListener("click", onClick);
