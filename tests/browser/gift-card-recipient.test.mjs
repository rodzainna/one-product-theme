import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../../assets/gift-card-recipient.js";

const render = () => {
  document.body.innerHTML = `
    <form>
      <gift-card-recipient>
        <label><input type="checkbox" name="properties[__shopify_send_gift_card_to_recipient]" value="true">Send as a gift</label>
        <fieldset hidden disabled>
          <label>Recipient email <input type="email" name="properties[Recipient email]" required></label>
          <label>Send on <input type="date" name="properties[Send on]" data-send-on></label>
          <input type="hidden" name="properties[__shopify_offset]" data-offset>
        </fieldset>
      </gift-card-recipient>
    </form>`;
  return document.querySelector("form");
};
const sent = (form) => [...new FormData(form).keys()];

afterEach(() => {
  document.body.innerHTML = "";
});

describe("gift card recipient", () => {
  test("sends no recipient fields until the checkbox is checked", () => {
    const form = render();
    expect(document.querySelector("fieldset").hidden).toBe(true);
    expect(sent(form)).toEqual([]);
  });

  test("checking it shows the fields and sends them, with the time zone offset", async () => {
    const form = render();
    await userEvent.click(page.getByLabelText("Send as a gift"));
    expect(document.querySelector("fieldset").hidden).toBe(false);
    await userEvent.type(
      page.getByLabelText("Recipient email"),
      "a@example.com",
    );
    const data = new FormData(form);
    expect(data.get("properties[__shopify_send_gift_card_to_recipient]")).toBe(
      "true",
    );
    expect(data.get("properties[Recipient email]")).toBe("a@example.com");
    expect(data.get("properties[__shopify_offset]")).toBe(
      String(new Date().getTimezoneOffset()),
    );
  });

  test("unchecking it stops sending them again", async () => {
    const form = render();
    const box = page.getByLabelText("Send as a gift");
    await userEvent.click(box);
    await userEvent.click(box);
    expect(sent(form)).toEqual([]);
  });

  test("the send date runs from today to 90 days ahead", () => {
    render();
    const input = document.querySelector("[data-send-on]");
    const days = (Date.parse(input.max) - Date.parse(input.min)) / 86_400_000;
    expect(days).toBe(90);
    const today = new Date();
    const local = new Date(
      today.getTime() - today.getTimezoneOffset() * 60_000,
    );
    expect(input.min).toBe(local.toISOString().slice(0, 10));
  });
});
