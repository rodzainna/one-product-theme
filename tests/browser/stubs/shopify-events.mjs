// Stands in for Shopify's @shopify/events (cdn.shopify.com/storefront/standard-events.js), per its documented API.
export class ProductSelectEvent extends Event {
  static eventName = "shopify:product:select";

  static createPromise() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  constructor(init) {
    super(ProductSelectEvent.eventName, { bubbles: true, cancelable: true });
    Object.assign(this, init);
  }
}
