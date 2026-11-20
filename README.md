# One Product Theme

[![CI](https://github.com/rodzainna/one-product-theme/actions/workflows/ci.yml/badge.svg)](https://github.com/rodzainna/one-product-theme/actions/workflows/ci.yml)

An industry-agnostic Shopify theme for stores that sell one product. Every heading, image, colour and font comes from theme settings and blocks, so the same theme suits a coffee brand, a gadget or a skincare line.

> **Status:** in development. Demo stores and screenshots will be added as sections land.

## Built on

[Shopify Skeleton theme](https://github.com/Shopify/skeleton-theme) v1.0.0 (Online Store 2.0: sections, JSON templates, theme blocks). The first commit is Skeleton as released, so everything after it is this theme's own work.

## Development

Requires Node 22.22.2+ (or 24.15+, or 26+), [pnpm](https://pnpm.io/) 11+ (the project pins pnpm 12, and pnpm switches to it by itself) and [Shopify CLI](https://shopify.dev/docs/storefronts/themes/tools/cli).

```sh
pnpm install
pnpm exec playwright install chromium firefox webkit   # browsers for the browser tests
pnpm dev --store <your-store>   # local preview with hot reload
pnpm check                      # Theme Check and the CSS token guard
pnpm test                       # Vitest: tests/ in Node (except tests/store/), tests/browser/ in Chromium, Firefox and WebKit
pnpm test:store                 # Vitest: tests/store/ against a running preview (see below)
pnpm format                     # Prettier (Liquid, CSS, JS, JSON)
```

`pnpm test:store` fetches rendered sections from the preview of a test store, because Liquid only renders on Shopify. It expects the products in `tests/store/products.mjs` (for example `test-size-sold-out`, with size S out of stock). Create any that are missing with your own Shopify CLI login for that store:

```sh
shopify store auth --store <test-store>.myshopify.com --scopes write_products,write_inventory,read_locations,write_files,write_publications,write_purchase_options,write_discounts,write_content
pnpm test:store:setup <test-store>.myshopify.com
```

The pickup tests also need local pickup turned on for the store's location, with an address (Settings → Locations). The gift card product needs gift cards activated (Products → Gift cards). The recommendation tests need the free [Shopify Search & Discovery](https://apps.shopify.com/search-and-discovery) app installed first; the setup script then sets test-two-options' related and complementary products. The cart tests need two automatic discounts, which the setup script creates (named "Test …").

The search tests need an article: the setup script adds `test-article` to the News blog, and creates the blog when the store has none.

Existing products are left as they are, so to apply a change in `products.mjs`, delete that product on the store and run the setup again.

Then start a preview with the storefront password, at `http://127.0.0.1:9293` unless `STORE_URL` says otherwise. `read -s` keeps the password out of your shell history:

```sh
read -s SHOPIFY_FLAG_STORE_PASSWORD && export SHOPIFY_FLAG_STORE_PASSWORD
pnpm dev --store <test-store> --port 9293
```

`pnpm test:store:setup` also copies `tests/store/fixtures/index.featured-test.json` to `templates/`, where the featured product tests read it at `/?view=featured-test`. Git ignores that copy, and it names a test product, so delete it before pushing this theme to a real store.

The browser tests include WebKit, which drops mouse clicks while the Mac's screen is locked or asleep. If `pnpm test` fails in WebKit only, wake the screen and run it again.

Git hooks: commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (commitlint), staged files are formatted on commit, and `pnpm check`, `pnpm test` and a format check run before each push. The CSS guard (Stylelint, `stylelint.config.mjs`) checks `assets/*.css` and every `{% stylesheet %}` block, and fails on colours, font sizes, weights, radii, z-index, padding or timings that bypass the design tokens.

JSON templates, section groups and `config/settings_data.json` are left unformatted because the theme editor rewrites them.

## Continuous integration

GitHub Actions runs the same checks as the pre-push hook on every pull request and on pushes to `main`. It only checks: nothing is deployed.

1. **Lint, Node tests and the PR title** run side by side: Prettier, Theme Check and the CSS guard; the Node tests; and a Conventional Commits check of the title (pull requests only), because the squash merge puts it on `main`.
2. **Chromium, Firefox and WebKit** run side by side, but only when step 1 passed.
3. **CI passed** is the single check to require before merging.

The store tests (`pnpm test:store`) aren't part of CI: they need a live Shopify store and its storefront password.

## License

Based on Shopify Skeleton theme, © Shopify Inc. See [LICENSE.md](LICENSE.md).

## Third-party icons

Most icons in `snippets/icon.liquid` are [Lucide](https://lucide.dev)'s own artwork, used under the ISC License below. Three of them (chevron-down, clock and minus) were derived by Lucide from [Feather](https://feathericons.com) and are under the MIT License below. The rest (account, alert, box, cart, check, close, info, pause, play and plus) are drawn for this theme in Lucide's style.

```text
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

```text
The MIT License (MIT)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
