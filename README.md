# One Product Theme

[![CI](https://github.com/rodzainna/one-product-theme/actions/workflows/ci.yml/badge.svg)](https://github.com/rodzainna/one-product-theme/actions/workflows/ci.yml)

An industry-agnostic Shopify theme for stores that sell one product. Every heading, image, colour and font comes from theme settings and blocks, so the same theme suits a coffee brand, a gadget or a skincare line.

> **Status:** in development. Every section and standard page is built; the demo store, screenshots and video are coming.

## What it is

- **One product, done properly.** The buy box, gallery, cart and story pages are built around a single hero product, not a catalogue.
- **Generic by design.** Nothing is tied to one industry. Content, colours, fonts and layout come from settings, with the goal that a new store needs configuration, not code changes.
- **Theme Store standards as the target.** It is being built to the Shopify Theme Store requirements (accessibility, performance, translations, required templates), without being submitted. The final audit, performance testing and the real-device browser pass are still to come.
- **Online Store 2.0.** Sections, JSON templates and theme blocks, on top of the [Shopify Skeleton theme](https://github.com/Shopify/skeleton-theme) v1.0.0. The first commit is Skeleton without its `.github` folder, so everything after it is this theme's own work.

## Features

- **Product page:** variant picker (pills, dropdown or swatches), price states with compare-at and unit price, tax line, selling plans, pickup availability, a gallery with images, video, YouTube, Vimeo and 3D, and a sticky add-to-cart bar.
- **Cart:** a cart drawer and a cart page, both updated through the Cart AJAX API. With the cart drawer, adding an item is announced to screen readers.
- **Home and story sections:** hero (image or video), feature list, link tiles, image with text, FAQ, testimonials, review wall, comparison table, contact form and custom Liquid.
- **Standard pages:** collection with filters and sort, collection list, search with predictive results, blog and article with comments, policy pages, 404, password page and a gift card page with a QR code.
- **Site-wide:** announcement bar, sticky header, phone menu, country and language selectors, footer with newsletter, SEO and social metadata.
- **Design controls:** five colours per colour scheme, font pickers, fluid type and spacing, button and card radius, and optional scroll snap, stacking and parallax.

## How it's built

- **Blocks for repeatable content.** The product buy box, features, FAQ, reviews, testimonials, link tiles, comparison table and footer are built from theme blocks.
- **Design tokens, enforced.** Styles come from tokens. A Stylelint guard (`stylelint.config.mjs`, `scripts/lint-css.mjs`) fails `pnpm check` when colours, type, radius, z-index, padding or timings bypass them.
- **A small component layer.** Buttons, inputs, selects, dialogs, tooltips, accordions and more are snippets with typed `{% doc %}` headers, so every page uses the same parts.
- **Tests at three levels.** Node tests for logic and guards, browser tests in Chromium, Firefox and WebKit, and store tests that render real Liquid against a Shopify test store.
- **Accessibility checked on whole pages.** axe is run by hand on full pages, not only on components, and keyboard behaviour has its own browser tests.
- **Safe output.** A guard test checks that every `_html` translation key escapes the values passed to it.
- **Reviewable history.** Conventional Commits, one pull request per change, squash merges, and CI that must pass before merging.

## Quick start

Requires Node 22.22.2+ (or 24.15+, or 26+), [pnpm](https://pnpm.io/) 11+ (the project pins pnpm 12, and pnpm switches to it by itself) and [Shopify CLI](https://shopify.dev/docs/storefronts/themes/tools/cli).

```sh
pnpm install
pnpm exec playwright install chromium firefox webkit   # browsers for the browser tests
pnpm dev --store <your-store>   # local preview with hot reload
pnpm check                      # Theme Check and the CSS token guard
pnpm test                       # Vitest: tests/ in Node (except tests/store/), tests/browser/ in Chromium, Firefox and WebKit
pnpm test:store                 # Vitest: tests/store/ against a running preview (see Testing)
pnpm format                     # Prettier (Liquid, CSS, JS, JSON)
```

The tests that need a Shopify store are covered under [Testing](#testing).

## Project structure

| Folder       | What is in it                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------- |
| `layout/`    | The theme and password page layouts                                                                |
| `sections/`  | Page sections and section groups (header, footer)                                                  |
| `blocks/`    | Theme blocks. Underscore-prefixed blocks can be used only where a schema names them                |
| `snippets/`  | Shared components: buttons, inputs, cards, dialogs, price, media                                   |
| `templates/` | JSON page templates, plus the gift card template (Liquid)                                          |
| `assets/`    | Scripts, the critical stylesheet and the gift card stylesheet                                      |
| `config/`    | Theme settings and their saved values                                                              |
| `locales/`   | Translation strings (English)                                                                      |
| `tests/`     | `tests/*.test.mjs` run in Node, `tests/browser/` in three browsers, `tests/store/` against a store |
| `scripts/`   | The CSS guard, the test store setup and the Markdown-only check                                    |
| `.github/`   | CI workflow and Dependabot config                                                                  |

## Testing

```sh
pnpm check        # Theme Check and the CSS token guard
pnpm test         # Node and browser tests (Chromium, Firefox, WebKit)
pnpm format:check # Prettier
```

The browser tests include WebKit, which drops mouse clicks while the Mac's screen is locked or asleep. If `pnpm test` fails in WebKit only, wake the screen and run it again.

Git hooks: commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (commitlint), staged files are formatted on commit, and `pnpm check`, `pnpm test` and a format check run before each push. When a branch differs from `origin/main` only in Markdown files, a push runs the format check alone. The CSS guard (Stylelint, `stylelint.config.mjs`) checks `assets/*.css` and every `{% stylesheet %}` block, and fails on colours, font sizes, weights, radii, z-index, padding or timings that bypass the design tokens.

JSON templates, section groups and `config/settings_data.json` are left unformatted because the theme editor rewrites them.

<details>
<summary>Store tests (advanced, needs a Shopify test store)</summary>

`pnpm test:store` fetches rendered sections from the preview of a test store, because Liquid only renders on Shopify. It expects the products in `tests/store/products.mjs` (for example `test-size-sold-out`, with size S out of stock). Create any that are missing with your own Shopify CLI login for that store:

> **Warning:** run these two commands against a throwaway test store only, never a real store. The scopes give write access to products, inventory, files, publications, selling plans, discounts and content. The setup script creates products, discounts, collections, pages, articles and blogs, publishes products and new collections to the Online Store, adds recommendations, replaces a collection image, turns on moderated comments on the News blog if they are closed, and approves pending comments from authors whose names start with "Test commenter". Don't authorize it on a store that has real customers or orders.

```sh
shopify store auth --store <test-store>.myshopify.com --scopes write_products,write_inventory,read_locations,write_files,write_publications,write_purchase_options,write_discounts,write_content
pnpm test:store:setup <test-store>.myshopify.com
```

The pickup tests also need local pickup turned on for the store's location, with an address (Settings → Locations). The gift card product needs gift cards activated (Products → Gift cards). The recommendation tests need the free [Shopify Search & Discovery](https://apps.shopify.com/search-and-discovery) app installed first; the setup script then sets test-two-options' related and complementary products. The cart tests need two automatic discounts, which the setup script creates (named "Test …").

The search tests need an article: the setup script adds `test-article` to the News blog, and creates the blog when the store has none.

Existing products aren't recreated or updated from `products.mjs`: the script only publishes them to the Online Store if needed and adds missing recommendations. To apply any other change, delete that product on the store and run the setup again.

Then start a preview with the storefront password, at `http://127.0.0.1:9293` unless `STORE_URL` says otherwise. `read -s` keeps the password out of your shell history:

```sh
read -s SHOPIFY_FLAG_STORE_PASSWORD && export SHOPIFY_FLAG_STORE_PASSWORD
pnpm dev --store <test-store> --port 9293
```

`pnpm test:store:setup` also copies `tests/store/fixtures/index.featured-test.json` to `templates/`, where the featured product tests read it at `/?view=featured-test`. Git ignores that copy, and it names a test product, so delete it before pushing this theme to a real store.

</details>

## Continuous integration

GitHub Actions runs the same checks as the pre-push hook on every pull request and on pushes to `main`. It only checks: nothing is deployed. A pull request into `main` that changes only Markdown skips the heavy jobs and checks just Prettier and the title; pushes to `main` always run in full.

1. **Lint, Node tests and the PR title** run side by side: Prettier, Theme Check and the CSS guard; the Node tests; and a Conventional Commits check of the title (pull requests only), because the squash merge puts it on `main`.
2. **Chromium, Firefox and WebKit** run side by side, but only when step 1 passed.
3. **CI passed** is the single check to require before merging.

The store tests (`pnpm test:store`) aren't part of CI: they need a live Shopify store and its storefront password.

## Browser and accessibility support

- **Automated today:** the browser tests run in Chromium, Firefox and WebKit, in CI and in the pre-push hook.
- **Checked by hand:** axe (WCAG 2.2 AA and best practice) on the collection, collection list, search, blog, article, plain, policy, 404, password and gift card pages, at four widths from 320px to 1366px in all three engines. The home, product, cart and story pages (about, FAQ, contact, compare and reviews) haven't had that full run yet. axe isn't part of CI.
- **Not verified yet:** performance, real Safari and iPhone, in-app browsers, and screen readers (VoiceOver and NVDA). These checks are planned before launch.

## Roadmap

- A coffee demo store with a README gallery and a video.
- Gadget and skincare presets, to show the same theme works across industries with settings and content only.

## Author

Built by Rodzainna Hamisain, a senior full-stack developer. [Portfolio](https://rodzainna.com) · [LinkedIn](https://linkedin.com/in/rodzainna)

## License and credits

Based on Shopify Skeleton theme, © Shopify Inc. Changes © 2026 Rodzainna Hamisain, offered under the same terms as [LICENSE.md](LICENSE.md).

Icons are mostly from [Lucide](https://lucide.dev) (ISC), some of them derived from [Feather](https://feathericons.com) (MIT), plus a few drawn for this theme. Social icons are from [Simple Icons](https://simpleicons.org) (CC0). The full notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
