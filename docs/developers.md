# Developer Guide

This plugin is built on the `webhead/wp-plugin-framework` scaffold. `includes/Plugin.php` is the runtime source of truth for service registration, hooks, settings, capabilities, database tables, jobs, lifecycle, health checks, diagnostics, and compatibility. If you're changing plugin behavior, also read the relevant skill file under `.agents/skills/` (or `.claude/skills/`) before editing — they describe the architectural conventions this codebase follows.

## Building from source

```bash
composer install
npm install
npm run build
```

`composer install` also runs Mozart, which copies the framework runtime into `includes/Dependencies` under the `Webhead\WP\SearchCloud\Dependencies\` namespace. The framework itself (`webhead/wp-plugin-framework`) is a `require-dev` dependency only — it must never ship in a release; `includes/Dependencies` is the runtime copy that does.

For a release build:

```bash
composer install
composer install --no-dev --no-scripts --optimize-autoloader
npm run build
```

`.distignore` excludes source-only directories (`src/`, `tests/`, `docs/`, `node_modules/`, `vendor/webhead/wp-plugin-framework/`, and agent-guidance folders) from packaged releases.

## Architecture overview

### Settings

`includes/Settings/Plugin_Settings.php` is the single source of truth for every setting: option key, type, default, REST exposure, and (for two of them) masking/encryption. Settings are declared with the framework's `#[Setting(...)]` PHP attribute. Because attribute arguments must be compile-time constants, their `label`/`description` can never be wrapped in `__()` directly — settings with their own hand-written admin tab (Connection, Indexing, Search Config, Popular Searches) render translated labels client-side instead; the two settings that only render on the generic schema-driven tab (`SYNC_RETENTION_DAYS`, `DELETE_DATA_ON_UNINSTALL`) get their translated label/description merged in server-side via `Plugin_Settings::translated_schema_overrides()` and `Settings_Endpoint::translate_schema()`. Follow the same pattern if you add a setting with no dedicated tab.

Write key and write secret are encrypted at rest with AES-256-GCM, keyed from WordPress's own secure-auth salt (`Plugin_Settings::encrypt_secret()` / `decrypt_secret()`), and the sanitize callback is idempotent so re-saving an already-encrypted value doesn't double-encrypt it.

### REST API

Base route: `/wp-json/webhead-search-cloud/v1/`. Every endpoint lives under `includes/Routing/` and requires a logged-in user with the matching capability.

| Route | Method | Capability | Purpose |
|---|---|---|---|
| `/settings` | GET / POST | view / manage_settings | Generic REST-exposed settings (schema + values). `write_key` and `write_secret` are write-only: a response carries `__stored__` when one is saved and `''` when not, never the value; posting back `__stored__` or an empty string leaves the stored credential untouched |
| `/connection/test` | POST | view | Verify write credentials; returns site ID and document usage |
| `/indexing/config` | GET / POST | view / manage_settings | Per-post-type indexing field mapping, plus `indexed_fields`: every field a document can carry under the saved mapping (`Index_Config::indexed_fields()`, with product fields from `Woo::TOGGLE_FIELDS`) |
| `/search-config` | GET / PUT | view / manage_settings | Proxies Search Cloud's own search configuration (fields, weights, boosts, facets, suggestions, synonyms, languages) |
| `/sync/status` | GET | view | Current sync state and indexable-type summary |
| `/sync/start` | POST | run_sync | Start a sync (`?force=true` re-sends everything) |
| `/sync/pause`, `/sync/resume`, `/sync/cancel` | POST | run_sync | Control the active run |
| `/sync/history` | GET | view | Paginated, filterable, sortable run history |
| `/sync/history/{id}` | DELETE | run_sync | Delete one history row |
| `/sync/history` | DELETE | run_sync | Clear all finished history |
| `/cache/clear` | POST | manage_settings | Reset OPcache |

One route lives outside this table and namespace: `GET /wp-json/search-cloud/v1/verify` is **public** (no capability), used by Search Cloud's async domain-ownership ping. It echoes only the write key (never the write secret), and only while a verification this site started is still open: connecting opens a one-hour window, and outside it the route answers `404`. The window is the protection. The ping's `?token=` is an HMAC over Search Cloud's own application key, which the plugin cannot check, so requiring it alone proved nothing — appending `?token=x` used to return the write key. A tokenless request is still rejected with `400`, and a closed window or an unconnected site with `404`. It is deliberately registered under `search-cloud/v1`, not the plugin namespace, so the `verify_url` sent on `/connect` stays stable across a plugin-slug change.

### WP-CLI

```bash
wp webhead-search-cloud sync status [--format=table|json]
wp webhead-search-cloud sync run [--force]     # blocking, ticks to completion — good for real system cron
wp webhead-search-cloud sync start [--force]   # non-blocking, cron-driven ticks
wp webhead-search-cloud sync pause
wp webhead-search-cloud sync resume
wp webhead-search-cloud sync cancel
```

Framework-managed runtime commands are also exposed under the plugin slug (`wp webhead-search-cloud capabilities sync`, `settings dump`, `jobs list`, `health check`, `cache clear`, etc.) — see the framework's own CLI docs for those. `vendor/bin/webhead` is scaffolding-only; runtime maintenance always goes through `wp webhead-search-cloud ...`.

### Database tables

Both tables are managed through `Database_Manager` and registered `Table` classes (`includes/Database/Tables/`) — never query them with raw `$wpdb` SQL.

- **`sync_runs`** — one row per sync run (the single active row is live state; finished rows are history). Tracks status, trigger, progress counters, a resumable cursor, and between-batch pause/cancel signals.
- **`change_queue`** — incremental-sync queue. Editorial hooks (save/trash/delete/status-transition) enqueue a coalesced row per post (edit-then-delete collapses to a single delete); the drain job processes and clears them in batches.

### Jobs

- **`Scheduled_Sync_Job`** — daily, lock-protected; starts a sync if idle and applies the history-retention policy.
- **`Sync_Tick_Job`** — the resumable full-sync worker; one-off, self-rescheduling while work remains.
- **`Change_Drain_Job`** — the incremental-sync worker; drains `change_queue` in batches, self-rescheduling while non-empty.

### Capabilities

`includes/Capabilities/Plugin_Capabilities.php` defines three capabilities, all granted to Administrators by default: `VIEW` (read-only), `RUN_SYNC` (operate the sync engine, no credential/mapping changes), and `MANAGE_SETTINGS` (full settings control, implies `VIEW`). Grant them to other roles/users through the framework's capability manager rather than checking `manage_options` directly.

### Multilingual support

`includes/Compatibility/Multilingual_Support.php` deliberately checks **Polylang before WPML** — Polylang registers WPML's own compatibility filters, so WPML-first detection would misidentify a Polylang-only site as running WPML. See the class docblock for the specific live bug this avoided, and [`multilingual.md`](multilingual.md) for user-facing behavior.

### Frontend display

The Gutenberg block (`blocks/search/`) and Elementor widget (`includes/Elementor/Widgets/Search_Widget.php`) share the same rendering, styling, and runtime bundle (`Trigger_Markup`, the `bundle.search` entry) so the two embed points can't drift apart. The search modal is portalled to `document.body` at runtime in both cases, with per-instance CSS custom properties applied to both the trigger and the modal root.

The bundle is printed through the framework's asset registry (`Plugin::get_assets()`), by whatever draws a surface: a block's `render.php` enqueues the entry, and the two Elementor widgets name it in `asset_entries()` so Elementor prints it on the pages that use them and in the editor preview. Nothing is registered on a page with no surface, and the configuration the script is given (`Frontend_Config::to_array()`) is only built when the entry is first asked for - so a page without search costs no query and loads no translation. The widgets are named to the framework's Elementor manager in `Plugin::register_elementor()` and are listed in the editor panel under the plugin's own category.

Tokens that default to another token (the active tab's colour to the accent, the button background to the accent's text shade, an icon button's colour to the shared icon colour, and so on) are not declared anywhere: each rule that reads one names the default as its fallback, for example `var(--whsc-tab-text-active, var(--whsc-accent-strong))`. A fallback resolves on the element that uses it, so it follows that placement's own `--whsc-accent`; a value you set - on the placement's `whsc-instance-*` class, or site-wide on `:root` or `body` - is inherited and wins. Text drawn in the accent uses `--whsc-accent-strong`, a darker mix of `--whsc-accent` (`color-mix()`, where supported; the accent itself where not), which takes the default green to 5.8:1 on white. A light custom accent can still fall under 4.5:1 as text - `#f5a623` gives about 3.6:1 - so set `--whsc-accent-strong`, or the text tokens built on it, for such an accent. Borders, dots and focus rings keep the accent itself. The assistant's own accent has the same pair, `--whsc-assistant-accent` and `--whsc-assistant-accent-strong`. These two shades are the only derived tokens declared on each placement (at zero specificity), so set them on the placement rather than on an ancestor.

The storefront stylesheet (`src/frontend/search/scss/style.scss`) is written above the framework's reset on purpose. The reset (`src/components/Default/frontend-reset.scss`, framework-owned) weighs two ids, so that WordPress's controls look the same under any theme or Elementor kit; it takes a site's styles off every button and field of `@wordpress/components`, off every element with no class, and off every element whose class is written `block__element`. That is most of this surface and not all of it: the rule at the top of the stylesheet says the same for the rest - an element whose `whsc-` class has no `__` in it (`.whsc-card`, `.whsc-facet`, `.whsc-chip`), the few tags the reset's list leaves out, and every icon - at the reset's own weight, so that it is above the site and below every rule of the stylesheet. The stylesheet's `$lift` adds three ids to each of its rules, the Elementor widget's literal selectors add four (`Search_Widget::SPECIFICITY_BOOST`), and the three roots - the trigger, a product row and the modal's overlay - hand the page's own type, alignment and background back, which the reset would otherwise replace with the design system's. Theme a placement through the `--whsc-*` properties: a custom property does not compete on specificity. A rule of your own on a `.whsc-*` element has to carry `!important`.

What a site still reaches is what it is meant to: the type the three roots inherit (the font, its size and weight, the colour of the text, the spacing of the letters), a declaration marked `!important`, and the `--whsc-*` properties. Two elements are the package's and are held by name only, for what a site is known to change: the box trigger's field and the modal's frame. `tests/e2e/specs/site-styles.spec.js` keeps all of this true. It walks the storefront on the test site as it is, then again after `tests/e2e/seed-site-styles.php` has set every Site Settings control of the Elementor kit that styles an element the storefront also draws and added a stylesheet of the kind a theme or a designer writes, and compares the computed style of every element the plugin draws, at rest, under the pointer and in keyboard focus. Take the rule at the top of the stylesheet away and it reports several thousand differences.

A card designed in Search Cloud (`cardSource: server`, `src/frontend/search/components/serverCards.js`) is the template's to draw, so the stylesheet treats it differently from everything else on the surface. `.whsc-card--server` is only the box the template fills: it carries no frame of its own. Everything inside it is taken off the site as above, then started from what the panel's canvas is drawn on, Tailwind's preflight - no margin or padding, a heading and a link in the type and colour of what holds them, a list without bullets, an image as a block. The template's stylesheet is written by the service with one class per element (`.sct-12-title`); `ensureTemplateCss()` adds it to the page and then rewrites each selector through the CSSOM to weigh four ids (`liftSelectors()`), which is above the stylesheet, the reset and the site, and changes neither what a rule matches nor one rule's order against another's. A template is restyled in the panel, not from the site.

The search field is a combobox and its suggestions a listbox (`SearchInput.js`, `Suggestions.js`). Focus stays in the field: the arrow keys are handled there (`onInputKeyDown()` in `SearchModal.js`), the option they are on is marked with `aria-selected` and `.is-active`, and the field names it in `aria-activedescendant`. Typing on clears the mark, so Enter never searches for a suggestion the visitor has typed past.

The stock line on product cards reads `--whsc-stock-in-color` and `--whsc-stock-out-color`. The search block (`stockInColor` / `stockOutColor`) and the Elementor search widget (`card_stock_in_color` / `card_stock_out_color`) set them for their modal; product rows (the products block and widget) have no style controls and take the defaults or site-wide CSS.

### Filters

- **`webhead_search_cloud/index/allow_protected_meta`** — `(bool $allow, string $meta_key, WP_Post $post)`. A `meta:{key}` field mapping resolves through `Field_Source_Resolver`, which skips WordPress *protected* meta (keys beginning with `_`, e.g. order internals or plugin bookkeeping) by default so an over-broad mapping can't leak internal data into public search. Return `true` for a specific key to index it anyway:

  ```php
  add_filter( 'webhead_search_cloud/index/allow_protected_meta', function ( $allow, $key ) {
      return '_my_public_field' === $key ? true : $allow;
  }, 10, 2 );
  ```

- **`woocommerce_product_is_visible`** — WooCommerce's own filter, `(bool $visible, int $product_id)`, is also applied when a product mapping has "Only index published, visible products" on. The value it receives is whether WooCommerce's search would list the product (`Woo::is_visible_product()`), not whether the shop would, and a callback runs where the sync runs — WP-Cron, WP-CLI or REST — so `is_search()` is false and there is usually no logged-in user. Return `false` to keep a product out of the index.

## Testing

There are two PHP suites, the JS unit suite, and a Playwright end-to-end suite:

```bash
composer test:unit          # PHPUnit — fast, DB-free pure-logic classes (tests/Unit)
npm run test:integration    # PHPUnit — real WordPress + database via wp-env (tests/Integration)
npm run test:js             # Jest, through `wp-scripts test-unit-jest` — pure-logic JS utilities
npm run test:e2e            # Playwright — real browser, desktop + mobile (tests/e2e)
```

The **unit suite** (`tests/Unit`, `phpunit.xml.dist`) is intentionally scoped to pure logic — enums, DTOs, response/state normalization, dirty-tracking, multilingual provider resolution, currency/facet/language helpers, card-template evaluation, the request cache, and local-storage-backed recent searches. `tests/bootstrap.php` polyfills a small, explicit set of WordPress functions (translation no-ops, post-meta as an in-memory store, a minimal filter registry, `WP_Post`/`WP_Error` stand-ins) rather than loading all of WordPress, so it stays fast and needs no database.

The **integration suite** (`tests/Integration`, `phpunit-integration.xml.dist`) boots a real WordPress and database through `wp-phpunit` and runs inside the wp-env `tests-cli` container. It covers the WordPress-runtime layer the unit suite can't reach: activation and custom-table creation (`Activation_Test`), the resumable full-sync engine start→tick→complete/pause/cancel workflow with the Search Cloud HTTP layer faked out (`Sync_Workflow_Test`), the sync control surface — including the "stuck in Running" recovery when the tick worker is dead (`Sync_Control_Test`) — the `sync/*` REST routes' capability split and payloads (`Sync_Endpoint_Test`), the block editor render (`Frontend\Block_Render_Test`), when a page receives the storefront bundle (`Frontend\Storefront_Entry_Test`), what the plugin does while it boots (`Lifecycle\Boot_Test`), the Elementor widget registration and contract (`Elementor\Widgets_Test`), and WooCommerce product indexing against real product objects (`Indexing\Woo_Test`).

The Elementor and WooCommerce suites need those plugins loaded. `.wp-env.json` installs both, and `tests/Integration/bootstrap-extra.php` loads their main files on `muplugins_loaded` and creates WooCommerce's tables on `setup_theme`. That file is the plugin's own; `tests/Integration/bootstrap.php`, which requires it, is the framework's and is refreshed by `composer framework:update`. Both plugins are optional — the two suites skip themselves when they are absent (e.g. a bare host run), so the rest of the integration suite still runs. The same suite runs again as a network with `npm run test:integration:multisite`.

```bash
npm run wp-env -- start     # boot the Docker environment first
npm run test:integration    # unit + integration together: npm run test:php
```

Both PHP suites run in CI (`.github/workflows/run-tests.yml`): the unit suite across the full PHP × WordPress compatibility matrix (8.3/8.4 × latest/6.8), and the integration suite, single site and multisite, on WordPress `latest` only — the `wp-phpunit` test framework targets current WordPress, and the WP 6.0 test framework is not PHP 8.4-safe. Because of that gating, the CI "latest" leg installs current Elementor + WooCommerce while the "6.0" leg installs the plugin alone (current Elementor needs WP 6.8+, WooCommerce needs WP 6.9+, and neither is exercised on that leg). If the integration suite is ever extended to run on WP 6.0, pin Elementor 3.23.x there — 3.24.0 raised Elementor's minimum to WP 6.3.

The **end-to-end suite** (`tests/e2e`, `playwright.config.js`) drives the real, built front-end in a browser via Playwright and `@wordpress/scripts test-playwright`. Every spec runs twice — a desktop and a mobile (`Pixel 5`) project — so the search modal is proven in both layouts. The hosted Search Cloud API is never contacted: `mockSearchCloud()` (`tests/e2e/utils.js`) intercepts every `…/api/v1/*` request with deterministic, CORS-headed responses, and `configureSearchKey()` sets the plugin's public key so the front end runs a real query instead of degrading to native `?s=` search. Coverage spans opening the modal from both trigger styles, running a query and rendering result cards, the no-results and API-error fallback, type facets, the pre-query browse state (highlights / popular / recent), focus and keyboard behaviour, responsive layout, the unconfigured fallback, cards designed in Search Cloud drawn from a template shaped like the service's compiler output (`server-cards.spec.js` - the unit tests read that markup through jsdom, which accepts selectors a browser refuses), the storefront on a site whose kit and stylesheet style every element (`site-styles.spec.js`), the carousel in a page written right to left (`right-to-left.spec.js`; `rightToLeft()` serves the page as WordPress does on such a site, since the test site has no such language), and an Elementor smoke test that skips when Elementor is not active.

```bash
npm run build               # E2E drives the built bundle, so build first
npm run wp-env -- start
npm run test:e2e            # both projects; test:e2e:desktop for desktop only
```

E2E needs a browser (`npx playwright install chromium`) and the built assets, and runs on WordPress `latest` with Elementor + WooCommerce in its own CI job. It targets the wp-env tests site (`http://localhost:8889`); set `WP_BASE_URL` to point it elsewhere (e.g. the dev site on `:8888`).

Add or update the narrowest useful test for every behavior change. `npm run build` after any JavaScript, block, or admin UI change, followed by a manual check in a real browser (desktop and mobile widths, keyboard focus, no horizontal overflow).

## Translations

Text domain: `webhead-search-cloud`. `Domain Path: /languages` in the main plugin header. `languages/script-translation-map.json` maps JS source files to their built bundle for `wp i18n make-json`.

```bash
wp i18n make-pot . languages/webhead-search-cloud.pot --domain=webhead-search-cloud --exclude=.agents,.claude,.codex,tests,docs,node_modules,vendor,public,languages,includes/Dependencies,includes/classes
wp i18n update-po languages/webhead-search-cloud.pot languages
wp i18n make-mo languages languages
wp i18n make-json languages languages --use-map=languages/script-translation-map.json --update-mo-files
```

Rules of thumb:

- Every string sent to the browser via `wp_localize_script()` / inline script data must be wrapped in `__()` at the PHP call site — a raw literal there bypasses gettext entirely, even though it renders identically to a wrapped string in English until a second locale is tested.
- `#[Setting(label:..., description:...)]` values can never be `__()`-wrapped — see "Settings" above for the established workaround.
- If your `wp` CLI has no `i18n-command` package installed, run the same commands through a full `wp-cli.phar` instead (`php /path/to/wp-cli.phar i18n ...`). If `make-pot` fails on an SSL error fetching WordPress core's `block-i18n.json`, pass a current CA bundle explicitly (`-d curl.cainfo="<path>"`) rather than editing global PHP config.
- Don't trust `wp i18n update-po` to preserve every existing translation when re-merging a PO file that already has `msgctxt`-scoped entries — verify with `msgfmt --check` after merging, and be ready to refill `msgstr` values from your own translation source of truth if entries came back empty.

## Contributing

1. Identify the affected public contracts first: settings option keys, REST routes, capability names, table names — these are stable identifiers, not internal details.
2. Implement inside the existing framework patterns (settings via `Plugin_Settings`, REST via the framework's `Rest_API` base class, tables via `Database_Manager`/`Table`) rather than a parallel system.
3. Add or update the narrowest useful test in the same change.
4. Run `php -l` on changed PHP files, `composer test:unit`, `npm run test:js`, and `npm run build`.
5. Update this documentation (and `CHANGELOG.md`) when the developer-facing contract changes.
