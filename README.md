# One Product Theme

An industry-agnostic Shopify theme for stores that sell one product. Every heading, image, colour and font comes from theme settings and blocks, so the same theme suits a coffee brand, a gadget or a skincare line.

> **Status:** in development. Demo stores and screenshots will be added as sections land.

## Built on

[Shopify Skeleton theme](https://github.com/Shopify/skeleton-theme) v1.0.0 (Online Store 2.0: sections, JSON templates, theme blocks). The first commit is Skeleton as released, so everything after it is this theme's own work.

## Development

Requires Node 22.22.1+, [pnpm](https://pnpm.io/) 11+ and [Shopify CLI](https://shopify.dev/docs/storefronts/themes/tools/cli).

```sh
pnpm install
pnpm dev --store <your-store>   # local preview with hot reload
pnpm check                      # Theme Check
pnpm format                     # Prettier (Liquid, CSS, JS, JSON)
```

Git hooks: commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (commitlint), staged files are formatted on commit, and Theme Check plus a format check run before each push.

JSON templates, section groups and `config/settings_data.json` are left unformatted because the theme editor rewrites them.

## License

Based on Shopify Skeleton theme, © Shopify Inc. See [LICENSE.md](LICENSE.md).
