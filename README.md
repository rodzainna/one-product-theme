# One Product Theme

An industry-agnostic Shopify theme for stores that sell one product. Every heading, image, colour and font comes from theme settings and blocks, so the same theme suits a coffee brand, a gadget or a skincare line.

> **Status:** in development. Demo stores and screenshots will be added as sections land.

## Built on

[Shopify Skeleton theme](https://github.com/Shopify/skeleton-theme) v1.0.0 (Online Store 2.0: sections, JSON templates, theme blocks). The first commit is Skeleton as released, so everything after it is this theme's own work.

## Development

Requires Node 22.22.2+ (or 24.15+, or 26+), [pnpm](https://pnpm.io/) 11+ and [Shopify CLI](https://shopify.dev/docs/storefronts/themes/tools/cli).

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
shopify store auth --store <test-store>.myshopify.com --scopes write_products,write_inventory,read_locations,write_publications
pnpm test:store:setup <test-store>.myshopify.com
```

Existing products are left as they are, so to apply a change in `products.mjs`, delete that product on the store and run the setup again.

Then start a preview with the storefront password, at `http://127.0.0.1:9293` unless `STORE_URL` says otherwise. `read -s` keeps the password out of your shell history:

```sh
read -s SHOPIFY_FLAG_STORE_PASSWORD && export SHOPIFY_FLAG_STORE_PASSWORD
pnpm dev --store <test-store> --port 9293
```

Git hooks: commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (commitlint), staged files are formatted on commit, and `pnpm check`, `pnpm test` and a format check run before each push. The CSS guard (Stylelint, `stylelint.config.mjs`) checks `assets/*.css` and every `{% stylesheet %}` block, and fails on colours, font sizes, weights, radii, z-index, padding or timings that bypass the design tokens.

JSON templates, section groups and `config/settings_data.json` are left unformatted because the theme editor rewrites them.

## License

Based on Shopify Skeleton theme, © Shopify Inc. See [LICENSE.md](LICENSE.md).
