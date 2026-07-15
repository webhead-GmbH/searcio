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
| `/settings` | GET / POST | view / manage_settings | Generic REST-exposed settings (schema + values) |
| `/connection/test` | POST | view | Verify write credentials; returns site ID and document usage |
| `/indexing/config` | GET / POST | view / manage_settings | Per-post-type indexing field mapping |
| `/search-config` | GET / PUT | view / manage_settings | Proxies Search Cloud's own search configuration (fields, weights, boosts, facets, suggestions, synonyms, languages) |
| `/sync/status` | GET | view | Current sync state and indexable-type summary |
| `/sync/start` | POST | run_sync | Start a sync (`?force=true` re-sends everything) |
| `/sync/pause`, `/sync/resume`, `/sync/cancel` | POST | run_sync | Control the active run |
| `/sync/history` | GET | view | Paginated, filterable, sortable run history |
| `/sync/history/{id}` | DELETE | run_sync | Delete one history row |
| `/sync/history` | DELETE | run_sync | Clear all finished history |
| `/cache/clear` | POST | manage_settings | Reset OPcache |

One route lives outside this table and namespace: `GET /wp-json/search-cloud/v1/verify` is **public** (no capability), used by Search Cloud's async domain-ownership ping. It echoes only the write key (never the write secret) and only when the site is connected. It requires the `?token=` query parameter the ping always sends — a tokenless request is rejected with `400` so the write key is never handed to an unauthenticated scanner. It is deliberately registered under `search-cloud/v1`, not the plugin namespace, so the `verify_url` sent on `/connect` stays stable across a plugin-slug change.

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

The Gutenberg block (`blocks/search/`) and Elementor widget (`includes/Frontend/Elementor/Search_Widget.php`) share the same rendering, styling, and runtime bundle (`Trigger_Markup`, `Frontend_Assets`) so the two embed points can't drift apart. The search modal is portalled to `document.body` at runtime in both cases, with per-instance CSS custom properties applied to both the trigger and the modal root.

### Filters

- **`webhead_search_cloud/index/allow_protected_meta`** — `(bool $allow, string $meta_key, WP_Post $post)`. A `meta:{key}` field mapping resolves through `Field_Source_Resolver`, which skips WordPress *protected* meta (keys beginning with `_`, e.g. order internals or plugin bookkeeping) by default so an over-broad mapping can't leak internal data into public search. Return `true` for a specific key to index it anyway:

  ```php
  add_filter( 'webhead_search_cloud/index/allow_protected_meta', function ( $allow, $key ) {
      return '_my_public_field' === $key ? true : $allow;
  }, 10, 2 );
  ```

## Testing

There are two PHP suites, the JS unit suite, and a Playwright end-to-end suite:

```bash
composer test:unit          # PHPUnit — fast, DB-free pure-logic classes (tests/Unit)
npm run test:integration    # PHPUnit — real WordPress + database via wp-env (tests/Integration)
npm run test:js             # Jest — pure-logic JS utilities
npm run test:e2e            # Playwright — real browser, desktop + mobile (tests/e2e)
```

The **unit suite** (`tests/Unit`, `phpunit.xml.dist`) is intentionally scoped to pure logic — enums, DTOs, response/state normalization, dirty-tracking, multilingual provider resolution, currency/facet/language helpers, card-template evaluation, the request cache, and local-storage-backed recent searches. `tests/bootstrap.php` polyfills a small, explicit set of WordPress functions (translation no-ops, post-meta as an in-memory store, a minimal filter registry, `WP_Post`/`WP_Error` stand-ins) rather than loading all of WordPress, so it stays fast and needs no database.

The **integration suite** (`tests/Integration`, `phpunit-integration.xml.dist`) boots a real WordPress and database through `wp-phpunit` and runs inside the wp-env `tests-cli` container. It covers the WordPress-runtime layer the unit suite can't reach: activation and custom-table creation (`Activation_Test`), the resumable full-sync engine start→tick→complete/pause/cancel workflow with the Search Cloud HTTP layer faked out (`Sync_Workflow_Test`), the sync control surface — including the "stuck in Running" recovery when the tick worker is dead (`Sync_Control_Test`) — the `sync/*` REST routes' capability split and payloads (`Sync_Endpoint_Test`), the block editor render (`Frontend\Block_Render_Test`), the Elementor widget registration and contract (`Frontend\Elementor_Widget_Test`), and WooCommerce product indexing against real product objects (`Indexing\Woo_Test`).

The Elementor and WooCommerce suites need those plugins loaded. `.wp-env.json` installs both, and the integration bootstrap (`tests/Integration/bootstrap.php`) loads their main files on `muplugins_loaded` and creates WooCommerce's tables on `setup_theme`. Both are optional — the two suites skip themselves when the plugins are absent (e.g. a bare host run), so the rest of the integration suite still runs.

```bash
npm run wp-env -- start     # boot the Docker environment first
npm run test:integration    # unit + integration together: npm run test:php
```

Both PHP suites run in CI (`.github/workflows/run-tests.yml`): the unit suite across the full PHP × WordPress compatibility matrix (8.3/8.4 × latest/6.0), and the integration suite on WordPress `latest` only — the `wp-phpunit` test framework targets current WordPress, and the WP 6.0 test framework is not PHP 8.4-safe. Because of that gating, the CI "latest" leg installs current Elementor + WooCommerce while the "6.0" leg installs the plugin alone (current Elementor needs WP 6.8+, WooCommerce needs WP 6.9+, and neither is exercised on that leg). If the integration suite is ever extended to run on WP 6.0, pin Elementor 3.23.x there — 3.24.0 raised Elementor's minimum to WP 6.3.

The **end-to-end suite** (`tests/e2e`, `playwright.config.js`) drives the real, built front-end in a browser via Playwright and `@wordpress/scripts test-playwright`. Every spec runs twice — a desktop and a mobile (`Pixel 5`) project — so the search modal is proven in both layouts. The hosted Search Cloud API is never contacted: `mockSearchCloud()` (`tests/e2e/utils.js`) intercepts every `…/api/v1/*` request with deterministic, CORS-headed responses, and `configureSearchKey()` sets the plugin's public key so the front end runs a real query instead of degrading to native `?s=` search. Coverage spans opening the modal from both trigger styles, running a query and rendering result cards, the no-results and API-error fallback, type facets, the pre-query browse state (highlights / popular / recent), focus and keyboard behaviour, responsive layout, the unconfigured fallback, and an Elementor smoke test that skips when Elementor is not active.

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
