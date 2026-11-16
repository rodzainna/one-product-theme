import { afterEach, describe, expect, test, vi } from "vitest";
import "../../assets/faq-nav.js";

const render = () => {
  document.body.innerHTML = `
    <faq-nav><nav><ul>
      <li><a href="#faq-a">Alpha</a></li>
      <li><a href="#faq-b">Beta</a></li>
      <li><a href="#faq-c">Gamma</a></li>
    </ul></nav></faq-nav>
    ${["a", "b", "c"]
      .map(
        (
          id,
        ) => `<div class="shopify-block"><section class="faq-group" id="faq-${id}" style="height: 100vh">
          <h2 class="faq-group__title">${id}</h2></section></div>`,
      )
      .join("")}`;
  return [...document.querySelectorAll("faq-nav a")];
};

const current = () =>
  document.querySelector("faq-nav a[aria-current]")?.textContent;

afterEach(() => {
  document.body.innerHTML = "";
  delete window.Shopify;
  scrollTo(0, 0);
});

describe("faq-nav", () => {
  test("marks the first category as current to begin with", () => {
    render();
    expect(current()).toBe("Alpha");
  });

  test("marks the category being read as current when scrolling", async () => {
    render();
    document.getElementById("faq-c").scrollIntoView();
    await vi.waitFor(() => expect(current()).toBe("Gamma"));
    document.getElementById("faq-b").scrollIntoView();
    await vi.waitFor(() => expect(current()).toBe("Beta"));
    expect(document.querySelectorAll("faq-nav a[aria-current]")).toHaveLength(
      1,
    );
  });

  test("jumping up to a category that already overlaps the line moves the highlight", async () => {
    render();
    for (const group of document.querySelectorAll(".faq-group")) {
      group.style.height = "30vh";
      group.style.marginBottom = "10vh";
    }
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div style="height: 200vh"></div>',
    );
    const top = (id) => document.getElementById(id).offsetTop;
    scrollTo(0, top("faq-c") - innerHeight * 0.3);
    await vi.waitFor(() => expect(current()).toBe("Gamma"));
    scrollTo(0, top("faq-b"));
    await vi.waitFor(() => expect(current()).toBe("Beta"));
  });

  test("at the end of the page the last category is current, even when it is too short to reach the line", async () => {
    render();
    for (const group of document.querySelectorAll(".faq-group")) {
      group.style.height = "20vh";
      group.style.marginBottom = "60vh";
    }
    document.getElementById("faq-c").style.marginBottom = "0";
    scrollTo(0, document.documentElement.scrollHeight);
    await vi.waitFor(() => expect(current()).toBe("Gamma"));
  });

  test("a clicked link stays current even when the page can't scroll its category to the line", async () => {
    const [, beta] = render();
    for (const group of document.querySelectorAll(".faq-group")) {
      group.style.height = "20vh";
      group.style.marginBottom = "60vh";
    }
    document.getElementById("faq-c").style.marginBottom = "0";
    beta.click();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(current()).toBe("Beta");
  });

  test("a Ctrl-click that opens a new tab doesn't change the highlight", () => {
    const [, beta] = render();
    beta.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
      }),
    );
    expect(current()).toBe("Alpha");
  });

  test("once the reader scrolls on, the highlight follows the page again", async () => {
    const [, beta] = render();
    beta.click();
    await new Promise((resolve) => setTimeout(resolve, 200));
    window.dispatchEvent(new Event("wheel"));
    document.getElementById("faq-c").scrollIntoView();
    await vi.waitFor(() => expect(current()).toBe("Gamma"));
  });

  test("in the theme editor, renaming a category updates its link", () => {
    window.Shopify = { designMode: true };
    const [, beta] = render();
    const block = document.getElementById("faq-b").parentElement;
    block.querySelector(".faq-group__title").textContent = "Beta renamed";
    block.dispatchEvent(
      new CustomEvent("shopify:block:load", { bubbles: true }),
    );
    expect(beta.textContent).toBe("Beta renamed");
  });

  test("outside the editor, block events change nothing", () => {
    const [, beta] = render();
    const block = document.getElementById("faq-b").parentElement;
    block.querySelector(".faq-group__title").textContent = "Beta renamed";
    block.dispatchEvent(
      new CustomEvent("shopify:block:load", { bubbles: true }),
    );
    expect(beta.textContent).toBe("Beta");
  });
});
