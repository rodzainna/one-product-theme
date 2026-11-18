import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import dialogLiquid from "../../snippets/dialog.liquid?raw";
import "../../assets/dialog.js";

const stylesheet =
  dialogLiquid.match(
    /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/,
  )?.[1] ?? "";

// The markup the dialog snippet renders, opened by a button (or a link) elsewhere on the page.
const render = ({
  closeOutside = true,
  opener = "button",
  withDialog = true,
} = {}) => {
  const openers = {
    button: `<button type="button" data-dialog-open="Guide">Size guide</button>`,
    link: `<a href="/size-guide" data-dialog-open="Guide">Size guide</a>`,
  };
  document.body.innerHTML = `
    <style>
      :root { --radius-card: 12px; --color-overlay: rgb(0 0 0 / 0.5); --space-xs: 8px; --space-s: 12px;
        --space-m: 16px; --color-border: #ddd; --text-lg: 18px; --scrollbar-width: 0px; }
      body { margin: 0; min-height: 3000px; }
      ${stylesheet}
    </style>
    ${openers[opener]}
    ${
      withDialog
        ? `<dialog class="dialog" id="Guide" aria-labelledby="Guide-title" ${closeOutside ? "data-close-outside" : ""}>
      <div class="dialog__head"><h2 id="Guide-title">Size guide</h2>
        <button type="button" data-dialog-close aria-label="Close">×</button></div>
      <div class="dialog__body" tabindex="0"><p>Chart</p></div>
    </dialog>`
        : ""
    }`;
  return document.getElementById("Guide");
};

const open = () =>
  userEvent.click(page.getByRole("button", { name: "Size guide" }));

afterEach(() => {
  document.querySelector("dialog[open]")?.close();
  document.body.innerHTML = "";
});

describe("dialog", () => {
  test("its button opens it as a modal named by its heading", async () => {
    const dialog = render();
    await open();
    expect(dialog.matches(":modal")).toBe(true);
    await expect
      .element(page.getByRole("dialog", { name: "Size guide" }))
      .toBeVisible();
  });

  test("Close closes it and focus goes back to the button that opened it", async () => {
    const dialog = render();
    // From the keyboard: Safari doesn't focus a button on click, so there's nothing to return to.
    page.getByRole("button", { name: "Size guide" }).element().focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(page.getByRole("button", { name: "Close" }));
    expect(dialog.open).toBe(false);
    expect(document.activeElement.textContent).toBe("Size guide");
  });

  test("Esc closes it", async () => {
    const dialog = render();
    await open();
    await userEvent.keyboard("{Escape}");
    expect(dialog.open).toBe(false);
  });

  test("a click outside closes it", async () => {
    const dialog = render();
    await open();
    await userEvent.click(document.body, { position: { x: 4, y: 4 } });
    expect(dialog.open).toBe(false);
  });

  test("a click outside leaves a dialog without data-close-outside open", async () => {
    const dialog = render({ closeOutside: false });
    await open();
    await userEvent.click(document.body, { position: { x: 4, y: 4 } });
    expect(dialog.open).toBe(true);
  });

  test("a press inside released outside, as when selecting text, doesn't close it", async () => {
    const dialog = render();
    await open();
    const box = dialog.querySelector("p").getBoundingClientRect();
    dialog.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: box.left + 2,
        clientY: box.top + 2,
      }),
    );
    dialog.dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX: 2, clientY: 2 }),
    );
    expect(dialog.open).toBe(true);
  });

  test("the page behind doesn't scroll while it's open", async () => {
    render();
    await open();
    expect(getComputedStyle(document.documentElement).overflow).toBe("hidden");
    document.querySelector("dialog").close();
    expect(getComputedStyle(document.documentElement).overflow).not.toBe(
      "hidden",
    );
  });
});

describe("a link that opens a dialog", () => {
  let stop;
  afterEach(() => stop?.abort());

  // Clicks the link and says whether the browser would have followed it. The test's own
  // listener runs last and cancels the click so the test page stays put.
  const clickLink = (init = {}, { withDialog = true } = {}) => {
    const dialog = render({ opener: "link", withDialog });
    stop = new AbortController();
    let followed;
    document.addEventListener(
      "click",
      (event) => {
        followed = !event.defaultPrevented;
        event.preventDefault();
      },
      { signal: stop.signal },
    );
    page
      .getByRole("link", { name: "Size guide" })
      .element()
      .dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, ...init }),
      );
    return { dialog, followed };
  };

  test("opens it on a plain click, without following the link", () => {
    const { dialog, followed } = clickLink();
    expect(dialog.open).toBe(true);
    expect(followed).toBe(false);
  });

  test.each([
    ["Ctrl", { ctrlKey: true }],
    ["Cmd", { metaKey: true }],
    ["Shift", { shiftKey: true }],
    ["middle", { button: 1 }],
  ])("leaves a %s-click to the browser, which opens the page", (_, init) => {
    const { dialog, followed } = clickLink(init);
    expect(dialog.open).toBe(false);
    expect(followed).toBe(true);
  });

  test("goes to its page when the dialog isn't on the page", () => {
    const { followed } = clickLink({}, { withDialog: false });
    expect(followed).toBe(true);
  });
});
