---
name: webhead-plugin-architecture
description: "Use this skill when editing PHP architecture in webhead Search Cloud: bootstrap, services, hooks, settings, capabilities, database tables, jobs, lifecycle, REST endpoints, Site Health, diagnostics, updates, multisite, or compatibility integrations."
license: MIT
metadata:
  author: webhead
---

# webhead Plugin Architecture

This plugin was scaffolded by the webhead WordPress Plugin Framework. Keep the generated architecture intact and follow existing sibling files before introducing a new pattern.

## Project Snapshot

- Plugin name: `webhead Search Cloud`
- Main plugin file: `webhead-search-cloud.php`
- Scaffold preset: `Existing Plugin`
- Plugin slug: `webhead-search-cloud`
- Namespace root: `Webhead\WP\SearchCloud`
- Description: `Connect WordPress and WooCommerce to webhead Search Cloud.`
- Minimum WordPress version: `6.0`
- Minimum PHP version: `8.3`
- Required plugin slugs: `none`
- Text domain: `webhead-search-cloud`
- Hook prefix: `webhead_search_cloud`
- Cache group: `webhead_search_cloud`
- REST namespace: `webhead-search-cloud/v1`
- Settings group: `webhead_search_cloud_settings`
- Table versions key: `webhead_search_cloud_table_versions`
- Default block metadata path: `blocks/example-notice/block.json`

## Enabled Features

- Scaffold preset: `Existing Plugin`
- React admin UI: enabled
- Block editor scaffold: enabled
- Elementor integration: disabled
- REST API scaffold: enabled
- Shortcodes scaffold: disabled
- Database example table: enabled
- Jobs and scheduler layer: enabled by default
- Cache facade, diagnostics, lifecycle, multisite, WPML, Polylang, and Wordfence support: enabled by default

## Core Model

- `webhead-search-cloud.php` is the WordPress bootstrap file and should stay thin.
- `includes/Plugin.php` is the runtime source of truth for services, hooks, admin pages, settings, capabilities, database tables, jobs, lifecycle, health checks, diagnostics, compatibility, and updates.
- Generated `Example_*` classes and `blocks/example-notice` are reference scaffolds only. Keep their registration lines in `includes/Plugin.php` commented until you replace them with real plugin behavior and tests, and delete unused example files before production.
- Plugin-owned custom tables must use `Table` and `Database_Manager` APIs for create, lookup, truncate, drop, and version-state cleanup. Use `Uninstall_Manager::register_database_tables_cleanup()` for uninstall table removal and `register_metadata_cleanup()`/`Database_Manager::delete_*_meta_keys()` for plugin-owned WordPress metadata instead of raw `$wpdb` cleanup SQL in `includes/Plugin.php`.
- Reuse framework managers before adding raw WordPress glue:
  - `Hooks_Manager` for hookable classes and attributes
  - `Settings_Manager` for settings schema, validation, REST exposure, and partial writes
  - `Capability_Manager` for capability registration, grants, and migrations
  - `Database_Manager` for table registration, lookup, schema upgrades, truncate/drop helpers, metadata cleanup helpers, and table version-state cleanup
  - `Jobs_Manager` for recurring jobs and one-off scheduling
  - `Lifecycle_Manager`, `Upgrade_Runner`, and `Uninstall_Manager` for upgrades and cleanup
  - `Page_Registry` for React admin pages
  - `Cache_Manager`, `Filesystem`, and diagnostics services for operational work
- Keep stable identifiers aligned: slug, namespace, text domain, hook prefix, cache group, REST namespace, option keys, table names, and capability names.

## DTOs, Value Objects, And Enums

- Create a DTO or value object when a payload crosses services, REST endpoints, table/query layers, settings writes, diagnostics payloads, logs, or JavaScript-facing admin data.
- Create a PHP enum when a value is a finite set of modes, states, policies, scopes, lifecycle phases, update strategies, or option choices.
- Do not create DTOs or enums for one-off local arrays or simple scalar values that are clearer inline.
- Add focused tests for every new DTO, value object, or enum.

## Feature Notes

- React is scaffolded. Keep the PHP asset loader, schema-driven REST payload, and JS settings screen aligned.
- Block support is scaffolded. Keep `block.json`, render templates, and build output aligned.
- REST endpoints are present. Keep permission callbacks explicit and settings reads schema-driven.
- Custom table support is present. Keep schema changes, table lookup, truncation, drops, version-state cleanup, metadata cleanup, and uninstall table removal behind `Database_Manager` and registered `Table` classes.
- Generated `Example_*` classes and example block files are reference scaffolds. Their registrations in `includes/Plugin.php` must stay commented until replaced with real plugin behavior and tests, and unused examples must be deleted before production.
- A recurring job example is part of the framework contract. Keep recurring work idempotent and lock-aware.
- Use `get_cache_manager()` for new caching work and invalidate by group instead of flushing global caches.
- Put non-table migrations, option renames, data backfills, and capability resync steps in `register_upgrade_steps()`.
- Keep uninstall behavior explicit through `configure_uninstall()`. Use `Uninstall_Manager::register_database_tables_cleanup()` for plugin-owned custom tables and `register_metadata_cleanup()` for plugin-owned metadata instead of raw `$wpdb` cleanup SQL in `includes/Plugin.php`.
- Settings belong in `includes/Settings/Plugin_Settings.php`; treat that class as the source of truth.
- The framework assumes multisite, WPML, Polylang, and Wordfence compatibility. New code must preserve that baseline.

## Rules

- Keep multisite behavior explicit and safe.
- Keep WPML, Polylang, and Wordfence compatibility defensive when those plugins are inactive.
- Declare a permission callback on every `#[Route]`. This is enforced, not advisory: `Rest_API::resolve_permission_callback()` throws an `InvalidArgumentException` naming the class and method when one is missing, so a route without it fails at boot rather than shipping open. Use `__return_true` only for intentionally public routes.
- Keep settings schema-driven from `includes/Settings/Plugin_Settings.php`.
- Keep lifecycle upgrade steps replay-safe and uninstall policy explicit.
- Do not store secrets in logs, activity events, diagnostics, or REST payloads.
- `masked: true` on `#[Setting]` is a **display** hint, not a security control. Verified: it makes
  the generated control render as a password field and makes `wp ... settings` withhold the value
  without `--reveal-secrets`, but `Settings_Manager::export_values()` never consults `is_masked()`,
  so the real value is in the REST response like any other. Protect a secret with the capability on
  the route and by not exposing it at all — `show_in_rest: false` — rather than by marking it masked.
