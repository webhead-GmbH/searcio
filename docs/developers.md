# Developer Guide

This plugin is built on the `webhead/wp-plugin-framework` scaffold. `includes/Plugin.php` is the runtime source of truth for service registration, hooks, settings, capabilities, database tables, jobs, lifecycle, health checks, diagnostics, and compatibility. If you're changing plugin behavior, also read the relevant skill file under `.agents/skills/` (or `.claude/skills/`) before editing - they describe the architectural conventions this codebase follows.

## Building from source

```bash
composer install
npm install
npm run build
```

`composer install` also runs Mozart, which copies the framework runtime into `includes/Dependencies` under the `Webhead\WP\SearchCloud\Dependencies\` namespace. The framework itself (`webhead/wp-plugin-framework`) is a `require-dev` dependency only - it must never ship in a release; `includes/Dependencies` is the runtime copy that does.

WordPress loads the plugin through `includes/autoload.php` and never through Composer's autoloader. That file registers the plugin's namespace as `autoload.psr-4` of `composer.json` names it, loads the autoloader of the bundle, and loads the framework's helper functions, which are functions of the bundle's namespace (`use function Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Support\Helpersrr_get;`). It is the framework's file: change the namespace map in `composer.json` and run `composer framework:update`. `vendor/autoload.php` is for the test suites, whose bootstraps load it themselves. So the plugin runs on the same files where it is developed and where it is installed, and nothing in `includes/`, the main file or `uninstall.php` may ask for `vendor`: a release package has none.

The build bundles a package the way Node finds it: from the `node_modules` nearest to the file that imports it. A package therefore gets the release of a dependency that npm installed for it, also when another package needs a different one: `motion` runs on its own `framer-motion` and not on the older one `@wordpress/components` brings. Nothing from outside the checkout is bundled. A checkout with no `node_modules` of its own, a git worktree for one, stops with `Can't resolve` where it used to read the directory above it, and so does a `node_modules` that is a link to another checkout's, or a package that `npm link` or a `file:` dependency links in. Run `npm install` in the checkout itself; `npm install --install-links` installs a copy of a linked package. `node vendor/webhead/wp-plugin-framework/tests/scaffold-npm-audit/resolution.js .` asks the configuration where it finds each package, without building.

For a release build:

```bash
composer install
npm ci
npm run build
```

`.distignore` excludes source-only directories (`src/`, `tests/`, `docs/`, `node_modules/` and the agent-guidance folders) from packaged releases, and with them `vendor/`, `composer.json` and `composer.lock`. A package holds `includes/Dependencies` and nothing else of Composer's, so there is no production install to make before packaging.

## Architecture overview

### Settings

`includes/Settings/Plugin_Settings.php` is the single source of truth for every setting: option key, type, default, REST exposure, and (for two of them) masking/encryption. Settings are declared with the framework's `#[Setting(...)]` PHP attribute. Because attribute arguments must be compile-time constants, their `label`/`description` can never be wrapped in `__()` directly - settings with a hand-written place of their own in the admin (the Connection, Indexing and Search Config tabs, the last with its Popular searches list) render translated labels client-side instead; the two settings that only render on the generic schema-driven tab (`SYNC_RETENTION_DAYS`, `DELETE_DATA_ON_UNINSTALL`) get their translated label/description merged in server-side via `Plugin_Settings::translated_schema_overrides()` and `Settings_Endpoint::translate_schema()`. Follow the same pattern if you add a setting with no dedicated tab.

Write key and write secret are encrypted at rest with AES-256-GCM, keyed from WordPress's own secure-auth salt (`Plugin_Settings::encrypt_secret()` / `decrypt_secret()`), and the sanitize callback is idempotent so re-saving an already-encrypted value doesn't double-encrypt it.

### REST API

Base route: `/wp-json/webhead-search-cloud/v1/`. Every endpoint lives under `includes/Routing/` and requires a logged-in user with the matching capability.

| Route | Method | Capability | Purpose |
|---|---|---|---|
| `/settings` | GET / POST | view / manage_settings | Generic REST-exposed settings (schema + values). `write_key` and `write_secret` are write-only: a response carries `__stored__` when one is saved and `''` when not, never the value; posting back `__stored__` or an empty string leaves the stored credential untouched |
| `/connection/test` | POST | view | Verify write credentials; returns site ID and document usage |
| `/connection/legal` | GET | view | The links of the consent checkboxes (terms, privacy, data processing), as Search Cloud configures them, with the plugin's own as fallback |
| `/connection/connect` | POST | manage_settings | Zero-friction connect: sends the admin's email and name, the site's name and address and the two consents. Stores the keys when a new account was created; answers `flow: pending_claim` when the email already has one |
| `/connection/disconnect` | POST | manage_settings | Calls Search Cloud's `DELETE /disconnect`, which deletes the site and its index there, then clears the stored credentials. A call that fails for any reason other than Search Cloud no longer knowing the keys (`401`, `404`) keeps them, so that it can be tried again |
| `/indexing/config` | GET / POST | view / manage_settings | Per-post-type indexing field mapping, plus `indexed_fields`: every field a document can carry under the saved mapping (`Index_Config::indexed_fields()`, with product fields from `Woo::TOGGLE_FIELDS`) |
| `/search-config` | GET / PUT | view / manage_settings | Proxies Search Cloud's own search configuration (fields, weights, boosts, facets, suggestions, synonyms, languages) |
| `/sync/status` | GET | view | Current sync state and indexable-type summary |
| `/sync/start` | POST | run_sync | Start a sync (`?force=true` re-sends everything) |
| `/sync/pause`, `/sync/resume`, `/sync/cancel` | POST | run_sync | Control the active run |
| `/sync/history` | GET | view | Paginated, filterable, sortable run history |
| `/sync/history/{id}` | DELETE | run_sync | Delete one history row |
| `/sync/history` | DELETE | run_sync | Clear all finished history |
| `/cache/clear` | POST | manage_settings | Invalidate the plugin's cache group and reset OPcache |

One route lives outside this table and namespace: `GET /wp-json/search-cloud/v1/verify` is **public** (no capability), used by Search Cloud's async domain-ownership ping. It echoes only the write key (never the write secret), and only while a verification this site started is still open: connecting opens a one-hour window, and outside it the route answers `404`. The window is the protection. The ping's `?token=` is an HMAC over Search Cloud's own application key, which the plugin cannot check, so requiring it alone proved nothing - appending `?token=x` used to return the write key. A tokenless request is still rejected with `400`, and a closed window or an unconnected site with `404`. It is deliberately registered under `search-cloud/v1`, not the plugin namespace, so the `verify_url` sent on `/connect` stays stable across a plugin-slug change.

### WP-CLI

```bash
wp webhead-search-cloud sync status [--format=table|json]
wp webhead-search-cloud sync run [--force]     # blocking, ticks to completion - good for real system cron; waits out a failing index as the background sync does, exits non-zero unless the run completed
wp webhead-search-cloud sync start [--force]   # non-blocking, cron-driven ticks
wp webhead-search-cloud sync pause
wp webhead-search-cloud sync resume
wp webhead-search-cloud sync cancel
```

Framework-managed runtime commands are also exposed under the plugin slug (`wp webhead-search-cloud capabilities sync|revoke|restore`, `settings dump|validate`, `jobs list|run`, `upgrades run`, `health check`, `cache clear`) - see the framework's own CLI docs for those. `vendor/bin/webhead` is scaffolding-only; runtime maintenance always goes through `wp webhead-search-cloud ...`.

### Database tables

Both tables are managed through `Database_Manager` and registered `Table` classes (`includes/Database/Tables/`) - never query them with raw `$wpdb` SQL.

- **`sync_runs`** - one row per sync run (the single active row is live state; finished rows are history). Tracks status, trigger, progress counters, a resumable cursor, and between-batch pause/cancel signals.
- **`change_queue`** - incremental-sync queue. Editorial hooks (save/trash/delete/status-transition) enqueue a coalesced row per post (edit-then-delete collapses to a single delete); the drain job processes and clears them in batches.

### Jobs

- **`Scheduled_Sync_Job`** - daily, lock-protected; starts a sync if idle and applies the history-retention policy. A run is the only one that can be active, and while one is, the drain sends nothing, so the job never leaves one standing: it re-arms a running one whose worker died and resumes a paused one.
- **`Sync_Tick_Job`** - the resumable full-sync worker; one-off, self-rescheduling while work remains. A batch the index did not take (after the client's own three tries within seconds) leaves the run `running`: the cursor counts the failure in `retries`, `last_error` says when the next try is, and the tick is scheduled 1, 2, 5, 10, 15 and then 30 minutes ahead (`Sync_Service::RETRY_DELAYS`). The seventh failure in a row ends the run as `failed`. A batch that is taken sets `retries` back to 0. Nothing of a batch that failed is counted; its documents are added to `failed_count` once, when the run gives up.
- **`Change_Drain_Job`** - the incremental-sync worker; drains `change_queue` in batches, self-rescheduling while non-empty.

### Capabilities

`includes/Capabilities/Plugin_Capabilities.php` defines three capabilities, all granted to Administrators by default: `VIEW` (`webhead-search-cloud_view`, read-only: it opens the screen and the routes that only read), `RUN_SYNC` (`webhead-search-cloud_run_sync`, operate the sync engine, no credential/mapping changes), and `MANAGE_SETTINGS` (`webhead-search-cloud_manage_settings`, connection, indexing mapping and search configuration). Each is checked by itself and none implies another, so a role that is to change settings needs `VIEW` as well, or it cannot open the screen. A fourth, `MANAGE_NETWORK_SETTINGS`, is the network-admin guard: it maps to `manage_network_options` on a multisite network and to `MANAGE_SETTINGS` on a single site. Grant them to other roles/users through the framework's capability manager rather than checking `manage_options` directly.

### Multilingual support

`includes/Compatibility/Multilingual_Support.php` deliberately checks **Polylang before WPML** - Polylang registers WPML's own compatibility filters, so WPML-first detection would misidentify a Polylang-only site as running WPML. See the class docblock for the specific live bug this avoided, and [`multilingual.md`](multilingual.md) for user-facing behavior.

### Frontend display

The Gutenberg block (`blocks/search/`) and Elementor widget (`includes/Elementor/Widgets/Search_Widget.php`) share the same rendering, styling, and runtime bundle (`Trigger_Markup`, the `bundle.search` entry) so the two embed points can't drift apart. The search modal is portalled to `document.body` at runtime in both cases, with per-instance CSS custom properties applied to both the trigger and the modal root.

The bundle is printed through the framework's asset registry (`Plugin::get_assets()`), by whatever draws a surface: a block's `render.php` enqueues the entry, and the two Elementor widgets name it in `asset_entries()` so Elementor prints it on the pages that use them and in the editor preview. Nothing is registered on a page with no surface, and the configuration the script is given (`Frontend_Config::to_array()`) is only built when the entry is first asked for - so a page without search costs no query and loads no translation. The widgets are named to the framework's Elementor manager in `Plugin::register_elementor()` and are listed in the editor panel under the plugin's own category.

Tokens that default to another token (the active tab's colour to the accent, the button background to the accent's text shade, an icon button's colour to the shared icon colour, and so on) are not declared anywhere: each rule that reads one names the default as its fallback, for example `var(--whsc-tab-text-active, var(--whsc-accent-strong))`. A fallback resolves on the element that uses it, so it follows that placement's own `--whsc-accent`; a value you set - on the placement's `whsc-instance-*` class, or site-wide on `:root` or `body` - is inherited and wins. Text drawn in the accent uses `--whsc-accent-strong`, a darker mix of `--whsc-accent` (`color-mix()`, where supported; the accent itself where not), which takes the default green to 5.8:1 on white. A light custom accent can still fall under 4.5:1 as text - `#f5a623` gives about 3.6:1 - so set `--whsc-accent-strong`, or the text tokens built on it, for such an accent. Borders, dots and focus rings keep the accent itself. The assistant's own accent has the same pair, `--whsc-assistant-accent` and `--whsc-assistant-accent-strong`. These two shades are the only derived tokens declared on each placement (at zero specificity), so set them on the placement rather than on an ancestor.

The storefront stylesheet (`src/frontend/search/scss/style.scss`) is written above the framework's reset on purpose. The reset (`src/components/Default/frontend-reset.scss`, framework-owned) weighs two ids, so that WordPress's controls look the same under any theme or Elementor kit; it takes a site's styles off every button and field of `@wordpress/components`, off every element with no class, and off every element whose class is written `block__element`. That is most of this surface and not all of it: the rule at the top of the stylesheet says the same for the rest - an element whose `whsc-` class has no `__` in it (`.whsc-card`, `.whsc-facet`, `.whsc-chip`), the few tags the reset's list leaves out, and every icon - at the reset's own weight, so that it is above the site and below every rule of the stylesheet. The stylesheet's `$lift` adds three ids to each of its rules, the Elementor widget's literal selectors add four (`Search_Widget::SPECIFICITY_BOOST`), and the three roots - the trigger, a product row and the modal's overlay - hand the page's own type, alignment and background back, which the reset would otherwise replace with the design system's. Theme a placement through the `--whsc-*` properties: a custom property does not compete on specificity. A rule of your own on a `.whsc-*` element has to carry `!important`.

What a site still reaches is what it is meant to: the type the three roots inherit (the font, its size and weight, the colour of the text, the spacing of the letters), a declaration marked `!important`, and the `--whsc-*` properties. Two elements are the package's and are held by name only, for what a site is known to change: the box trigger's field and the modal's frame. `tests/e2e/specs/site-styles.spec.js` keeps all of this true. It walks the storefront on the test site as it is, then again after `tests/e2e/seed-site-styles.php` has set every Site Settings control of the Elementor kit that styles an element the storefront also draws and added a stylesheet of the kind a theme or a designer writes, and compares the computed style of every element the plugin draws, at rest, under the pointer and in keyboard focus. Take the rule at the top of the stylesheet away and it reports several thousand differences.

A card designed in Search Cloud (`cardSource: server`, `src/frontend/search/components/serverCards.js`) is the template's to draw, so the stylesheet treats it differently from everything else on the surface. `.whsc-card--server` is only the box the template fills: it carries no frame of its own. Everything inside it is taken off the site as above, then started from what the panel's canvas is drawn on, Tailwind's preflight - no margin or padding, a heading and a link in the type and colour of what holds them, a list without bullets, an image as a block. The template's stylesheet is written by the service with one class per element (`.sct-12-title`); `ensureTemplateCss()` adds it to the page and then rewrites each selector through the CSSOM to weigh four ids (`liftSelectors()`), which is above the stylesheet, the reset and the site, and changes neither what a rule matches nor one rule's order against another's. A template is restyled in the panel, not from the site.

The search field is a combobox and its suggestions a listbox (`SearchInput.js`, `Suggestions.js`). Focus stays in the field: the arrow keys are handled there (`onInputKeyDown()` in `SearchModal.js`), the option they are on is marked with `aria-selected` and `.is-active`, and the field names it in `aria-activedescendant`. Typing on clears the mark, so Enter never searches for a suggestion the visitor has typed past.

An address that did not come from the plugin's own code goes through `safeHref()` (`src/utils/url.js`) before it becomes an `href` or reaches `window.location`: a search redirect a merchant configured, and a link the assistant wrote into a reply (`markdown.js`, which builds React elements and never markup). It follows an `http(s)` address or a path that starts with one slash, and nothing else; `//host` and `/\host` are another host in the clothes of a path.

An error the modal shows is the surface's own element (`.whsc-search-error`, with the assistant's and the product finder's error colours), not a `Notice` of `@wordpress/components`, whose look changes with the package.

The stock line on product cards reads `--whsc-stock-in-color` and `--whsc-stock-out-color`. The search block (`stockInColor` / `stockOutColor`) and the Elementor search widget (`card_stock_in_color` / `card_stock_out_color`) set them for their modal; product rows (the products block and widget) have no style controls and take the defaults or site-wide CSS.

### Filters

- **`webhead_search_cloud/index/allow_protected_meta`** - `(bool $allow, string $meta_key, WP_Post $post)`. A `meta:{key}` field mapping resolves through `Field_Source_Resolver`, which skips WordPress *protected* meta (keys beginning with `_`, e.g. order internals or plugin bookkeeping) by default so an over-broad mapping can't leak internal data into public search. Return `true` for a specific key to index it anyway:

  ```php
  add_filter( 'webhead_search_cloud/index/allow_protected_meta', function ( $allow, $key ) {
      return '_my_public_field' === $key ? true : $allow;
  }, 10, 2 );
  ```

- **`woocommerce_product_is_visible`** - WooCommerce's own filter, `(bool $visible, int $product_id)`, is also applied when a product mapping has "Only index published, visible products" on. The value it receives is whether WooCommerce's search would list the product (`Woo::is_visible_product()`), not whether the shop would, and a callback runs where the sync runs - WP-Cron, WP-CLI or REST - so `is_search()` is false and there is usually no logged-in user. Return `false` to keep a product out of the index.

## Testing

There are two PHP suites, the JS unit suite, and a Playwright end-to-end suite:

```bash
composer test:unit          # PHPUnit - fast, DB-free pure-logic classes (tests/Unit)
npm run test:integration    # PHPUnit - real WordPress + database via wp-env (tests/Integration)
npm run test:js             # Jest, through `wp-scripts test-unit-jest` - pure-logic JS utilities
npm run test:e2e            # Playwright - real browser, desktop + mobile (tests/e2e)
```

The **unit suite** (`tests/Unit`, `phpunit.xml.dist`) is intentionally scoped to pure logic - enums, DTOs, response/state normalization, dirty-tracking, multilingual provider resolution, currency/facet/language helpers, card-template evaluation, the request cache, and local-storage-backed recent searches, plus one test of another kind, `Release\Version_Test`, which reads the repository's own files and compares the version, and the WordPress and PHP the plugin asks for, wherever they are written. `tests/bootstrap.php` polyfills a small, explicit set of WordPress functions (translation no-ops, post-meta as an in-memory store, a minimal filter registry, `WP_Post`/`WP_Error` stand-ins) rather than loading all of WordPress, so it stays fast and needs no database.

The **integration suite** (`tests/Integration`, `phpunit-integration.xml.dist`) boots a real WordPress and database through `wp-phpunit` and runs inside the wp-env `tests-cli` container. It covers the WordPress-runtime layer the unit suite can't reach: activation and custom-table creation (`Activation_Test`), the resumable full-sync engine start→tick→complete/pause/cancel workflow with the Search Cloud HTTP layer faked out (`Sync_Workflow_Test`), the sync control surface - including the "stuck in Running" recovery when the tick worker is dead (`Sync_Control_Test`) - what a run does when the index does not take a batch: wait, try again, give up, and never stand in the way of the changes or of the next scheduled sync (`Sync_Retry_Test`), `sync run` waiting for each next try and ending with an error when the sync was given up (`WP_CLI\Sync_Command_Test`, against a stand-in for the `WP_CLI` class), the `sync/*` REST routes' capability split and payloads (`Sync_Endpoint_Test`), the block editor render (`Frontend\Block_Render_Test`), when a page receives the storefront bundle (`Frontend\Storefront_Entry_Test`), what the plugin does while it boots (`Lifecycle\Boot_Test`), the Elementor widget registration and contract (`Elementor\Widgets_Test`), and WooCommerce product indexing against real product objects (`Indexing\Woo_Test`).

The Elementor and WooCommerce suites need those plugins loaded. `.wp-env.json` installs both, and `tests/Integration/bootstrap-extra.php` loads their main files on `muplugins_loaded` and creates WooCommerce's tables on `setup_theme`. That file is the plugin's own; `tests/Integration/bootstrap.php`, which requires it, is the framework's and is refreshed by `composer framework:update`. Both plugins are optional - the two suites skip themselves when they are absent (e.g. a bare host run), so the rest of the integration suite still runs. The same suite runs again as a network with `npm run test:integration:multisite`.

```bash
npm run wp-env -- start     # boot the Docker environment first
npm run test:integration    # unit + integration together: npm run test:php
```

Both PHP suites run in CI (`.github/workflows/run-tests.yml`): the unit suite across the full PHP × WordPress compatibility matrix (8.3/8.4 × latest/6.8), and the integration suite, single site and multisite, on WordPress `latest` only - the `wp-phpunit` test framework targets current WordPress. Because of that gating, the CI "latest" leg installs current Elementor + WooCommerce while the "6.8" leg, the oldest WordPress the plugin supports, installs the plugin alone: it runs the unit suite only, and current WooCommerce (which needs WP 6.9+) would abort `wp-env start` there. If the integration suite is ever extended to the 6.8 leg, pin a WooCommerce release that still supports it.

The **end-to-end suite** (`tests/e2e`, `playwright.config.js`) drives the real, built front-end in a browser via Playwright and `@wordpress/scripts test-playwright`. Every spec runs twice - a desktop and a mobile (`Pixel 5`) project - so the search modal is proven in both layouts. The hosted Search Cloud API is never contacted: `mockSearchCloud()` (`tests/e2e/utils.js`) intercepts every `…/api/v1/*` request with deterministic, CORS-headed responses, and `configureSearchKey()` sets the plugin's public key so the front end runs a real query instead of degrading to native `?s=` search. Coverage spans opening the modal from both trigger styles, running a query and rendering result cards, the no-results and API-error fallback, type facets, the pre-query browse state (highlights / popular / recent), focus and keyboard behaviour, responsive layout, the unconfigured fallback, cards designed in Search Cloud drawn from a template shaped like the service's compiler output (`server-cards.spec.js` - the unit tests read that markup through jsdom, which accepts selectors a browser refuses), the storefront on a site whose kit and stylesheet style every element (`site-styles.spec.js`), the carousel in a page written right to left (`right-to-left.spec.js`; `rightToLeft()` serves the page as WordPress does on such a site, since the test site has no such language), what the Sync tab says about a run that is waiting to try again and about one that is paused (`sync-tab.spec.js`, on a mocked `/sync/status`), and an Elementor smoke test that skips when Elementor is not active.

```bash
npm run build               # E2E drives the built bundle, so build first
npm run wp-env -- start
npm run test:e2e            # both projects; test:e2e:desktop for desktop only
```

E2E needs a browser (`npx playwright install chromium`) and the built assets, and runs on WordPress `latest` with Elementor + WooCommerce in its own CI job. It targets the wp-env tests site (`http://localhost:8889`); set `WP_BASE_URL` to point it elsewhere (e.g. the dev site on `:8888`).

Add or update the narrowest useful test for every behavior change. `npm run build` after any JavaScript, block, or admin UI change, followed by a manual check in a real browser (desktop and mobile widths, keyboard focus, no horizontal overflow).

## Translations

Text domain: `searcio`, the plugin's slug on wordpress.org, which installs it in a `searcio/` folder and files its translations under that name. Only the translations follow it: the hook prefix, the cache group, the options, the asset handles, the admin page, the REST namespace and the WP-CLI command keep the first slug, `webhead-search-cloud`, which the main file sets as `PLUGIN_SLUG` whatever folder the plugin is in. `Plugin::get_text_domain()` returns `searcio`; `Plugin` also keeps the framework's lifecycle keys at their earlier names (the framework names them after the text domain, and a renamed key makes a site that ran an earlier release look new) and loads `languages/` from the folder the plugin is installed in. `Domain Path: /languages` in the main plugin header. The plugin ships German (`de_DE`, and copies for `de_AT` and `de_CH`, the Swiss one with ss for ß), French (`fr_FR`), Spanish (`es_ES`), Italian (`it_IT`) and Polish (`pl_PL`); `tests/Unit/Release/Translations_Test.php` reads each PO file against the template (placeholders, HTML tags, plural forms, no dash, the header, a compiled MO and script translations per bundle). `languages/script-translation-map.json` maps JS source files to their built bundle for `wp i18n make-json`.

```bash
wp i18n make-pot . languages/searcio.pot --domain=searcio --slug=searcio --exclude=.agents,.claude,.codex,tests,docs,node_modules,vendor,public,languages,includes/Dependencies,includes/classes
wp i18n update-po languages/searcio.pot languages
wp i18n make-mo languages languages
wp i18n make-json languages languages --use-map=languages/script-translation-map.json --update-mo-files
```

Rules of thumb:

- Every string sent to the browser via `wp_localize_script()` / inline script data must be wrapped in `__()` at the PHP call site - a raw literal there bypasses gettext entirely, even though it renders identically to a wrapped string in English until a second locale is tested.
- `#[Setting(label:..., description:...)]` values can never be `__()`-wrapped - see "Settings" above for the established workaround.
- A number in the React admin goes through `formatNumber()` (`src/utils/number.js`) and a date through `dateI18n()` from `@wordpress/date`, never through a bare `toLocaleString()`. That one follows the browser, which is often set to another language than the user's WordPress profile, and the sentence around the number is in the profile's. The end-to-end suite runs in `en-US`, the one browser that cannot show the difference: a spec about it sets `test.use( { locale: 'fa-IR' } )`.
- If your `wp` CLI has no `i18n-command` package installed, run the same commands through a full `wp-cli.phar` instead (`php /path/to/wp-cli.phar i18n ...`). If `make-pot` fails on an SSL error fetching WordPress core's `block-i18n.json`, pass a current CA bundle explicitly (`-d curl.cainfo="<path>"`) rather than editing global PHP config.
- `make-pot` takes the plugin's slug from the name of the directory it runs in, and writes it into the template's `Report-Msgid-Bugs-To`. The checkout is not named `searcio`, so always pass `--slug=searcio`.
- Don't trust `wp i18n update-po` to preserve every existing translation when re-merging a PO file that already has `msgctxt`-scoped entries - verify with `msgfmt --check` after merging, and be ready to refill `msgstr` values from your own translation source of truth if entries came back empty.

## Releasing

The version is written in the plugin header and the `VERSION` constant of `webhead-search-cloud.php`, in `Stable tag` and the first changelog block of `readme.txt`, in `CHANGELOG.md` (the `Unreleased` heading becomes the version), in `package.json` and twice in `package-lock.json`, in both `blocks/*/block.json`, in the translation template's `Project-Id-Version` (regenerate it) and in the version badge of `README.md`. The README and `docs/installation.md` also repeat what the header asks for - the WordPress and PHP minimums - and the README's last badge the *Tested up to* of `readme.txt`. `tests/Unit/Release/Version_Test.php` compares all of them, so a place that was missed fails the unit suite. None of this changes the build: `public/` comes out the same.

A release is a GitHub release on the merge commit of `master`, tagged with the version (no `v`), with `searcio-<version>.zip` attached. `.github/workflows/deploy.yml` builds that package when a release is published - the release build above, a copy of the tree without what `.distignore` and the workflow name, without `languages/*.po` and `*.pot`, zipped with `searcio/` as its only root folder, the folder wordpress.org installs the plugin in. When the workflow cannot run, build the package the same way by hand and attach it to the release. Before publishing, install the zip on a clean WordPress with `WP_DEBUG` on and run Plugin Check against it as wordpress.org does:

```bash
wp plugin check searcio --error-severity=7 --warning-severity=6 --include-low-severity-errors --exclude-checks=prefixing --categories=plugin_repo
```

`includes/Dependencies` must hold `Webhead`, `League`, `Psr` and the prefixed `composer` autoloader, and nothing else.

Do not run `scaffold:update` (`composer framework:update`) until the framework resolves a plugin's slug from somewhere other than its `Text Domain` header. It reads the slug from that header first and derives the hook prefix, the cache group, the REST namespace and the admin page's class names from it, so today it would rewrite the managed files for a plugin named `searcio`. The text domain of the two strings in `src/components/AdminPage.js` and `src/components/Modal.js` is already the one it writes.

`.wordpress-org` holds the plugin's page on wordpress.org: `icon.svg`, `icon-128x128.png` and `icon-256x256.png`, `banner-772x250.png` and `banner-1544x500.png`, and `screenshot-N.png`, numbered as the **Screenshots** section of `readme.txt` captions them. They go in the `assets/` folder of the wordpress.org SVN repository, never in the plugin: `.distignore` leaves every hidden folder out of the package. A screenshot that is added, removed or reordered changes its caption in `readme.txt` in the same change.

## Contributing

1. Identify the affected public contracts first: settings option keys, REST routes, capability names, table names - these are stable identifiers, not internal details.
2. Implement inside the existing framework patterns (settings via `Plugin_Settings`, REST via the framework's `Rest_API` base class, tables via `Database_Manager`/`Table`) rather than a parallel system.
3. Add or update the narrowest useful test in the same change.
4. Run `php -l` on changed PHP files, `composer test:unit`, `npm run test:js`, and `npm run build`.
5. Update this documentation (and `CHANGELOG.md`) when the developer-facing contract changes.
