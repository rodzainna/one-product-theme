import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import "../../assets/predictive-search.js";

// The section as /search/suggest returns it: two products, then the "Search for" link.
const section = `<div id="shopify-section-predictive-search" class="shopify-section">
  <div id="predictive-search-results" data-summary="2 results">
    <div id="predictive-search-listbox" role="listbox">
      <div role="group" aria-labelledby="h">
        <p id="h">Products</p>
        <a id="o1" role="option" tabindex="-1" href="/products/a">A</a>
        <a id="o2" role="option" tabindex="-1" href="/products/b">B</a>
      </div>
      <a id="o3" role="option" tabindex="-1" href="/search" data-search-all>Search for</a>
    </div>
  </div>
</div>`;

// What the modal renders around the results (snippets/search-modal.liquid).
const render = () => {
  document.body.innerHTML = `
    <predictive-search data-url="/search/suggest">
      <dialog open>
        <form action="/search" method="get" role="search">
          <input id="field" type="text" name="q" data-field role="combobox" aria-expanded="false" aria-controls="predictive-search-listbox">
          <button type="button" hidden data-clear>Clear</button>
        </form>
        <div data-results></div>
        <p role="status" data-status></p>
      </dialog>
    </predictive-search>`;
  return {
    input: document.getElementById("field"),
    clear: document.querySelector("[data-clear]"),
    results: document.querySelector("[data-results]"),
    status: document.querySelector("[data-status]"),
    dialog: document.querySelector("dialog"),
    form: document.querySelector("form"),
  };
};

const type = (input, value) => {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const respond = (body = section, status = 200) =>
  vi
    .spyOn(window, "fetch")
    .mockImplementation(async () => new Response(body, { status }));

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let ui;
beforeEach(() => {
  ui = render();
  // A click on a result would leave the test page.
  document.addEventListener("click", (event) => event.preventDefault());
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("searching", () => {
  test("waits for two characters, then asks the suggest endpoint once typing pauses", async () => {
    const fetch = respond();
    type(ui.input, "t");
    await pause(450);
    expect(fetch).not.toHaveBeenCalled();

    type(ui.input, "te");
    await pause(100);
    type(ui.input, "tea");
    await expect.poll(() => fetch.mock.calls.length).toBe(1);
    await pause(450);
    expect(fetch).toHaveBeenCalledTimes(1);
    const url = new URL(fetch.mock.calls[0][0], location.origin);
    expect(url.pathname).toBe("/search/suggest");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: "tea",
      section_id: "predictive-search",
      "resources[type]": "query,product,collection,page,article",
      "resources[limit]": "8",
      "resources[limit_scope]": "all",
    });
  });

  test("swaps the results in and announces how many there are", async () => {
    respond();
    type(ui.input, "tea");
    await expect.poll(() => ui.results.querySelectorAll("a").length).toBe(3);
    expect(ui.input.getAttribute("aria-expanded")).toBe("true");
    expect(ui.status.textContent).toBe("2 results");
  });

  test("links to the full results with the exact text, & included", async () => {
    respond();
    type(ui.input, "salt & pepper");
    await expect.poll(() => ui.results.querySelector("a")).not.toBeNull();
    const all = ui.results.querySelector("[data-search-all]");
    expect(new URL(all.href).search).toBe("?q=salt+%26+pepper");
  });

  test("passes the form's result types on to the full results", async () => {
    respond();
    ui.form.insertAdjacentHTML(
      "afterbegin",
      '<input type="hidden" name="type" value="article,page,product">',
    );
    type(ui.input, "tea");
    await expect.poll(() => ui.results.querySelector("a")).not.toBeNull();
    const all = ui.results.querySelector("[data-search-all]");
    expect(new URL(all.href).search).toBe(
      "?q=tea&type=article%2Cpage%2Cproduct",
    );
  });

  test("shows only the field again when the text drops below two characters", async () => {
    respond();
    type(ui.input, "tea");
    await expect.poll(() => ui.results.childElementCount).toBe(1);
    type(ui.input, "t");
    expect(ui.results.childElementCount).toBe(0);
    expect(ui.input.getAttribute("aria-expanded")).toBe("false");
    expect(ui.status.textContent).toBe("");
  });

  test("keeps the newest answer when an older one arrives later", async () => {
    const slow = new Response(section.replace("2 results", "slow"));
    const fast = new Response(section.replace("2 results", "fast"));
    let calls = 0;
    vi.spyOn(window, "fetch").mockImplementation(async (url, { signal }) => {
      calls += 1;
      if (calls === 1) {
        await pause(500);
        if (signal.aborted) throw new DOMException("", "AbortError");
        return slow;
      }
      return fast;
    });
    type(ui.input, "te");
    await expect.poll(() => calls).toBe(1);
    type(ui.input, "tea");
    await expect.poll(() => ui.status.textContent).toBe("fast");
    await pause(600);
    expect(ui.status.textContent).toBe("fast");
  });

  test("closing the modal cancels a search in flight", async () => {
    let signal;
    vi.spyOn(window, "fetch").mockImplementation(async (url, options) => {
      signal = options.signal;
      await pause(300);
      return new Response(section);
    });
    type(ui.input, "tea");
    await expect.poll(() => signal).toBeDefined();
    ui.dialog.close();
    await expect.poll(() => signal.aborted).toBe(true);
  });

  test.each([
    ["a failed request", () => respond("", 500)],
    [
      "no network",
      () =>
        vi.spyOn(window, "fetch").mockRejectedValue(new TypeError("offline")),
    ],
  ])("leaves just the field after %s", async (_, stub) => {
    respond();
    type(ui.input, "tea");
    await expect.poll(() => ui.results.childElementCount).toBe(1);
    vi.restoreAllMocks();
    const fetch = stub();
    type(ui.input, "teas");
    await expect.poll(() => fetch.mock.calls.length).toBe(1);
    await expect.poll(() => ui.results.childElementCount).toBe(0);
    expect(ui.input.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("the clear button", () => {
  test("shows once there is text, and clearing empties the field and returns focus to it", async () => {
    respond();
    expect(ui.clear.hidden).toBe(true);
    type(ui.input, "tea");
    expect(ui.clear.hidden).toBe(false);
    await expect.poll(() => ui.results.childElementCount).toBe(1);

    ui.clear.focus();
    ui.clear.click();
    expect(ui.input.value).toBe("");
    expect(ui.clear.hidden).toBe(true);
    expect(ui.results.childElementCount).toBe(0);
    expect(document.activeElement).toBe(ui.input);
  });
});

describe("the keyboard", () => {
  const withResults = async () => {
    respond();
    ui.input.focus();
    type(ui.input, "tea");
    await expect.poll(() => ui.results.childElementCount).toBe(1);
  };
  const active = () => ui.input.getAttribute("aria-activedescendant");

  test("Down and Up move through the results while focus stays in the field", async () => {
    await withResults();
    await userEvent.keyboard("{ArrowDown}");
    expect(active()).toBe("o1");
    expect(document.getElementById("o1").getAttribute("aria-selected")).toBe(
      "true",
    );
    await userEvent.keyboard("{ArrowDown}");
    expect(active()).toBe("o2");
    expect(document.getElementById("o1").getAttribute("aria-selected")).toBe(
      "false",
    );
    await userEvent.keyboard("{ArrowUp}");
    expect(active()).toBe("o1");
    expect(document.activeElement).toBe(ui.input);
  });

  test("goes back to the field after the last result, and Up from the field goes to the last", async () => {
    await withResults();
    await userEvent.keyboard("{ArrowUp}");
    expect(active()).toBe("o3");
    await userEvent.keyboard("{ArrowDown}");
    expect(active()).toBeNull();
  });

  test("Enter follows the highlighted result", async () => {
    await withResults();
    const clicked = vi.fn();
    document.getElementById("o2").addEventListener("click", clicked);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  test("Enter with nothing highlighted searches for what was typed", async () => {
    await withResults();
    const submitted = vi.fn((event) => event.preventDefault());
    ui.form.addEventListener("submit", submitted);
    await userEvent.keyboard("{Enter}");
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  test("Enter on an empty field does not submit", async () => {
    ui.input.focus();
    let prevented;
    ui.form.addEventListener("submit", (event) => {
      prevented = event.defaultPrevented;
      event.preventDefault();
    });
    await userEvent.keyboard("{Enter}");
    expect(prevented).toBe(true);
  });

  test("a new set of results starts with nothing highlighted", async () => {
    await withResults();
    await userEvent.keyboard("{ArrowDown}");
    type(ui.input, "teas");
    await expect.poll(() => active()).toBeNull();
  });

  test("typing again clears the highlight, so Enter can't follow a result for the old text", async () => {
    await withResults();
    await userEvent.keyboard("{ArrowDown}");
    expect(active()).toBe("o1");
    type(ui.input, "tea s");
    expect(active()).toBeNull();
    expect(document.getElementById("o1").getAttribute("aria-selected")).toBe(
      "false",
    );
  });

  test("Enter while an IME is composing, or with Cmd or Ctrl, leaves the highlighted result alone", async () => {
    await withResults();
    await userEvent.keyboard("{ArrowDown}");
    const clicked = vi.fn();
    document.getElementById("o1").addEventListener("click", clicked);
    for (const init of [
      { isComposing: true },
      { ctrlKey: true },
      { metaKey: true },
    ]) {
      ui.input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
          ...init,
        }),
      );
    }
    expect(clicked).not.toHaveBeenCalled();
  });
});

describe("closing the modal", () => {
  test("empties the field and the results, so it opens fresh next time", async () => {
    respond();
    type(ui.input, "tea");
    await expect.poll(() => ui.results.childElementCount).toBe(1);
    await userEvent.keyboard("{ArrowDown}");
    ui.dialog.close();
    await expect.poll(() => ui.input.value).toBe("");
    expect(ui.results.childElementCount).toBe(0);
    expect(ui.clear.hidden).toBe(true);
    expect(ui.input.getAttribute("aria-expanded")).toBe("false");
    expect(ui.input.hasAttribute("aria-activedescendant")).toBe(false);
  });
});

describe("the loading state", () => {
  const busy = () =>
    document.querySelector("predictive-search").hasAttribute("data-loading");

  // A request that stays pending until the test lets it answer.
  const pending = () => {
    let answer;
    const fetch = vi.spyOn(window, "fetch").mockImplementation(
      (url, { signal }) =>
        new Promise((resolve, reject) => {
          answer = (body = section, status = 200) =>
            resolve(new Response(body, { status }));
          signal.addEventListener("abort", () =>
            reject(new DOMException("", "AbortError")),
          );
        }),
    );
    return { fetch, answer: (...args) => answer(...args) };
  };

  test("is off until there is something to search for, and on from two characters", async () => {
    pending();
    expect(busy()).toBe(false);
    type(ui.input, "t");
    expect(busy()).toBe(false);
    type(ui.input, "te");
    expect(busy()).toBe(true);
    expect(ui.results.getAttribute("aria-busy")).toBe("true");
  });

  test("stays on through the wait and the request, and ends when the results arrive", async () => {
    const request = pending();
    type(ui.input, "tea");
    await expect.poll(() => request.fetch.mock.calls.length).toBe(1);
    expect(busy()).toBe(true);
    request.answer();
    await expect.poll(() => busy()).toBe(false);
    expect(ui.results.getAttribute("aria-busy")).toBe("false");
    expect(ui.results.childElementCount).toBe(1);
  });

  test("ends when the request fails", async () => {
    const request = pending();
    type(ui.input, "tea");
    await expect.poll(() => request.fetch.mock.calls.length).toBe(1);
    request.answer("", 500);
    await expect.poll(() => busy()).toBe(false);
  });

  test("keeps going when new typing replaces a request, until the newest one answers", async () => {
    const request = pending();
    type(ui.input, "tea");
    await expect.poll(() => request.fetch.mock.calls.length).toBe(1);
    type(ui.input, "teas");
    expect(busy()).toBe(true);
    await expect.poll(() => request.fetch.mock.calls.length).toBe(2);
    expect(busy()).toBe(true);
    request.answer();
    await expect.poll(() => busy()).toBe(false);
  });

  test("a late answer to old text neither shows nor ends the loading for the new text", async () => {
    const request = pending();
    type(ui.input, "tea");
    await expect.poll(() => request.fetch.mock.calls.length).toBe(1);
    type(ui.input, "teas");
    request.answer();
    await pause(50);
    expect(busy()).toBe(true);
    expect(ui.results.childElementCount).toBe(0);
  });

  test("ends when the text is cleared, shortened, or the modal closes", async () => {
    pending();
    type(ui.input, "tea");
    expect(busy()).toBe(true);
    type(ui.input, "t");
    expect(busy()).toBe(false);
    type(ui.input, "tea");
    ui.clear.click();
    expect(busy()).toBe(false);
    type(ui.input, "tea");
    ui.dialog.close();
    await expect.poll(() => busy()).toBe(false);
  });
});
