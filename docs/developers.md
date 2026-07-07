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

## Testing

```bash
composer test:unit   # PHPUnit — pure-logic PHP classes
npm run test:js      # Jest — pure-logic JS utilities
```

Both suites are intentionally scoped to pure logic — enums, DTOs, response/state normalization, dirty-tracking, multilingual provider resolution, currency/facet/language helpers, card-template evaluation, the request cache, and local-storage-backed recent searches. REST endpoints, WordPress-runtime-dependent classes (activation, full sync execution, WooCommerce integration), and React components are exercised through manual/browser verification rather than PHPUnit, per `tests/bootstrap.php`'s own scope note — a full wp-env integration suite for that layer doesn't exist yet and would be a reasonable next investment.

`tests/bootstrap.php` polyfills a small, explicit set of WordPress functions (translation no-ops, post-meta as an in-memory store, a minimal filter registry, `WP_Post`/`WP_Error` stand-ins) rather than loading all of WordPress, so the suite stays fast and DB-free.

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
