// Helpers for tests that fetch real HTML from `shopify theme dev` on the test store.
export const STORE_URL = process.env.STORE_URL || "http://127.0.0.1:9293";

export const isPasswordPage = (url, body) =>
  new URL(url).pathname === "/password" || body.includes('action="/password"');

export async function get(path) {
  let response, body;
  try {
    response = await fetch(new URL(path, STORE_URL), {
      signal: AbortSignal.timeout(30_000),
    });
    body = await response.text();
  } catch (error) {
    throw new Error(
      `GET ${path}: no answer from ${STORE_URL} within 30s. Start the test store preview first (README, "pnpm test:store").`,
      { cause: error },
    );
  }
  if (isPasswordPage(response.url, body)) {
    throw new Error(
      `GET ${path}: got the password page. Start the preview with SHOPIFY_FLAG_STORE_PASSWORD set.`,
    );
  }
  if (response.status === 404) {
    throw new Error(
      `GET ${path}: 404. Is it in tests/store/products.mjs, and created on the test store? (pnpm test:store:setup <store>.myshopify.com, README)`,
    );
  }
  if (!response.ok) throw new Error(`GET ${path}: ${response.status}`);
  return body;
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
