// Stands in for Shopify's @shopify/standard-events (cdn.shopify.com/storefront/standard-events.js), per its documented API.
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const standardEvent = (name) =>
  class extends Event {
    static eventName = name;
    static createPromise = deferred;
    static createCartFromAjaxResponse = (cart) => ({
      id: cart.token,
      totalQuantity: cart.item_count,
      lines: cart.items.map((item) => ({
        id: item.key,
        quantity: item.quantity,
      })),
    });

    constructor(init) {
      super(name, { bubbles: true, cancelable: true });
      Object.assign(this, init);
    }
  };

export const ProductSelectEvent = standardEvent("shopify:product:select");
export const CartLinesUpdateEvent = standardEvent("shopify:cart:lines-update");
export const CartNoteUpdateEvent = standardEvent("shopify:cart:note-update");
export const CartErrorEvent = standardEvent("shopify:cart:error");
