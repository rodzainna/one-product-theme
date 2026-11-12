/**
 * Shows and enables the gift card recipient fields while their checkbox is checked, so
 * nothing is sent otherwise. Sets the shopper's time zone offset and limits the send date
 * to today through 90 days ahead (shopify.dev's gift card recipient guide).
 */
const isoDate = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

export class GiftCardRecipient extends HTMLElement {
  connectedCallback() {
    this.checkbox = this.querySelector('input[type="checkbox"]');
    this.fields = this.querySelector("fieldset");
    this.checkbox.addEventListener("change", this.#sync);

    this.querySelector("[data-offset]").value = String(
      new Date().getTimezoneOffset(),
    );
    const sendOn = this.querySelector("[data-send-on]");
    const today = new Date();
    sendOn.min = isoDate(today);
    sendOn.max = isoDate(new Date(today.getTime() + 90 * 86_400_000));
    this.#sync();
  }

  disconnectedCallback() {
    this.checkbox.removeEventListener("change", this.#sync);
  }

  #sync = () => {
    const on = this.checkbox.checked;
    this.fields.hidden = !on;
    this.fields.disabled = !on;
  };
}

if (!customElements.get("gift-card-recipient")) {
  customElements.define("gift-card-recipient", GiftCardRecipient);
}
