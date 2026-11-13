// Helpers for tests that fetch real HTML from `shopify theme dev` on the test store.
export const STORE_URL = process.env.STORE_URL || "http://127.0.0.1:9293";

export const isPasswordPage = (url, body) =>
  new URL(url).pathname === "/password" || body.includes('action="/password"');

// Fetches from the preview, with a clear error when it's down, locked or missing the page.
async function request(path, init = {}) {
  let response, body;
  try {
    response = await fetch(new URL(path, STORE_URL), {
      ...init,
      signal: AbortSignal.timeout(30_000),
    });
    body = await response.text();
  } catch (error) {
    throw new Error(
      `${path}: no answer from ${STORE_URL} within 30s. Start the test store preview first (README, "pnpm test:store").`,
      { cause: error },
    );
  }
  if (isPasswordPage(response.url, body)) {
    throw new Error(
      `${path}: got the password page. Start the preview with SHOPIFY_FLAG_STORE_PASSWORD set.`,
    );
  }
  if (response.status === 404) {
    throw new Error(
      `${path}: 404. Is it in tests/store/products.mjs, and created on the test store? (pnpm test:store:setup <store>.myshopify.com, README)`,
    );
  }
  if (!response.ok) throw new Error(`${path}: ${response.status} ${body}`);
  return { response, body };
}

export async function get(path) {
  return (await request(path)).body;
}

export async function product(handle) {
  return JSON.parse(await get(`/products/${handle}.js`));
}

export function variantId(productJson, title) {
  const variant = productJson.variants.find((v) => v.title === title);
  if (!variant)
    throw new Error(`${productJson.handle} has no variant ${title}`);
  return variant.id;
}

// The Section Rendering API needs the full `template--<theme id>__<key>` ID; the bare key 404s.
export async function sectionId(path, key) {
  const html = await get(path);
  const ids = html.matchAll(/id="shopify-section-(template--\d+__([^"]+))"/g);
  const id = [...ids].find((match) => match[2] === key)?.[1];
  if (!id) throw new Error(`${path} has no template section "${key}"`);
  return id;
}

export async function section(path, id) {
  const separator = path.includes("?") ? "&" : "?";
  return get(`${path}${separator}section_id=${id}`);
}

// A shopper with their own cart: the cart cookie from /cart/add.js goes with each later request.
export async function cartSession(items) {
  const { response } = await request("/cart/add.js", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return async (path) => (await request(path, { headers: { cookie } })).body;
}
