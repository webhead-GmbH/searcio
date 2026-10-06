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
- Minimum WordPress version: `6.8`
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
- Elementor widgets: enabled
- REST API scaffold: enabled
- Shortcodes scaffold: disabled
- Database example table: enabled
- Jobs and scheduler layer: enabled by default
- Cache facade, diagnostics, lifecycle, multisite, WPML, Polylang, and Wordfence support: enabled by default

## Core Model

- `webhead-search-cloud.php` is the WordPress bootstrap file and should stay thin.
- `includes/Plugin.php` is the runtime source of truth for services, hooks, admin pages, settings, capabilities, database tables, jobs, lifecycle, health checks, diagnostics, compatibility, and updates.
- Generated `Example_*` classes and `blocks/example-notice` are reference scaffolds only. Keep their registration lines in `includes/Plugin.php` commented until you replace them with real plugin behavior and tests. An example the plugin is not going to build on is deleted, not kept for reference: remove the file, its test under `tests/`, its container binding and its commented registration in the same change.
- The tree holds what the plugin uses and nothing else. A directory exists because a file with something in it is there: create it when you write its first file and remove it when its last file goes. Do not add a directory for later, a `.gitkeep`, or an `index.php` that only says "Silence is golden". The two placeholders that stay are the `index.php` in the plugin root and `languages/`, which the plugin header names as its `Domain Path`.
- Plugin-owned custom tables must use `Table` and `Database_Manager` APIs for create, lookup, truncate, drop, and version-state cleanup. Use `Uninstall_Manager::register_database_tables_cleanup()` for uninstall table removal and `register_metadata_cleanup()`/`Database_Manager::delete_*_meta_keys()` for plugin-owned WordPress metadata instead of raw `$wpdb` cleanup SQL in `includes/Plugin.php`.
- Under the `delete_data` uninstall policy the framework removes what it created itself: settings, capability grants, the activity log table, table version state, lifecycle state and the cache group version options. The tables this plugin registers and the metadata it writes are removed only when `configure_uninstall()` registers their cleanup.
- Reuse framework managers before adding raw WordPress glue:
  - `Hooks_Manager` for hookable classes and attributes
  - `Settings_Manager` for settings schema, validation, REST exposure, and partial writes
  - `Capability_Manager` for capability registration, grants, and migrations
  - `Database_Manager` for table registration, lookup, schema upgrades, truncate/drop helpers, metadata cleanup helpers, and table version-state cleanup
  - `Jobs_Manager` for recurring jobs and one-off scheduling
  - `Lifecycle_Manager`, `Upgrade_Runner`, and `Uninstall_Manager` for upgrades and cleanup
  - `Page_Registry` for React admin pages
  - `Blocks_Manager` and `Shortcode_Manager` for blocks and shortcodes; a block provider with a `render()` method renders the block
  - `Elementor_Manager` for Elementor widgets, through `register_elementor()`
  - `Asset_Registry`, from `get_assets()`, for front-end scripts and stylesheets on the pages that render them
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
- Generated `Example_*` classes and example block files are reference scaffolds. Their registrations in `includes/Plugin.php` must stay commented until replaced with real plugin behavior and tests. An example the plugin is not going to build on is deleted, not kept for reference: remove the file, its test, its container binding and its commented registration in the same change.
- The tree holds what the plugin uses and nothing else. A directory exists because a file with something in it is there: create it with its first file, and remove it when its last file goes. The two placeholders that stay are the `index.php` in the plugin root and `languages/`, which the plugin header names.
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
- **A text setting says what it holds.** A setting of `type: 'string'` with nothing else stores whatever it is sent, markup and scripts included. Say what it is in `schema:` with a `format` (`text-field` for one line of plain text, `textarea-field` for several, `uri`, `email`, `hex-color`), an `enum` or a `pattern`, or give it a `sanitize_callback`. A secret is the exception: mark it `masked: true`. `tests/Unit/Settings/Plugin_Settings_Test.php` fails for a text setting that says nothing.
- **Declare what a route takes in `args:` on `#[Route]`, with the `type` of each parameter.** WordPress then answers `400` for a value of the wrong shape before the method runs. A cast is not a check: `(string)` on `search[]=a` is the word `Array` and a PHP warning. Clamp a number to its range and compare a name with a list in the method.
- Keep lifecycle upgrade steps replay-safe and uninstall policy explicit.
- A release reaches existing sites through an update, and WordPress calls no activation hook on update. The framework runs tables, upgrade steps, capability sync and job sync on the first request after the `VERSION` constant in the main plugin file went up. So raise `VERSION` in every release, put schema changes in a table version and data changes in an `Upgrade_Step`, and never rely on somebody reactivating the plugin.
- Do not store secrets in logs, activity events, diagnostics, or REST payloads.
- `includes/Plugin.php` runs on every request of the site, front end included. Its `register_*()` methods register; they do not read the database or the disk, call `__()`, or compute what only one screen shows. Hand a callback over instead: `add_deferred_fields()` for Site Health values, `add_deferred()` for an admin notice that takes a query to decide on, and translate settings tab titles in the provider's `sections()`, which the framework calls when the settings screen asks.
- Every framework service is in the container under a string key and under its class, as the same object: `$container->get( 'capability_manager' )` and `$container->get( Capability_Manager::class )` are one manager. Give a service of this plugin the class as its constructor argument, `->addArgument( Database_Manager::class )`, with the class imported from this plugin's `Dependencies` namespace.
- Put a table in the container with `addShared()`. It is registered with the `Database_Manager` once, and every other `get()` has to return that same object.
- Each query method called on a table starts a new query. To build one over several statements, keep the builder the first call returns: `$query = $table->where( … ); $query->order_by( … ); $rows = $query->get();`.
- Every write to a table invalidates this plugin's whole cache group. Give a table that is written often its own group with `set_cache_group()`.
- Take the id of a row you inserted from `$table->insert_get_id( $data )`, never from `$wpdb->insert_id` after `insert()`: the write invalidates the cache group, which can insert a row of its own, and `insert_id` is then that row's.
- Store an amount of money in a `$table->decimal( 'total' )` column with the `decimal` cast, never in a float. Declare a uniqueness rule with `$table->unique_index( 'name', [ 'column_a', 'column_b' ] )`.
- A label handed over in a `register_*()` method is handed over while the plugin boots, before translations are loaded. Where the API takes a closure, as `Elementor_Manager::set_category()` does, give it one: `static fn (): string => __( 'Label', 'webhead-search-cloud' )`.
- `Plugin::instance()` is the plugin that is running, for code WordPress builds or includes itself, such as a block's `render.php`. Everything this plugin builds gets what it needs through the container instead.
- A plugin that extends WooCommerce names the WooCommerce features it was tested with in `get_woocommerce_feature_compatibility()`, for example `[ 'custom_order_tables' ]`, and reads orders only through WooCommerce's own API so it works under either order storage.
- On multisite, a setting stored as a network option is only shown to, and saved by, a user with `manage_network_options` through REST. A site administrator sees the site's own settings.
- `masked: true` on `#[Setting]` is a **display** hint, not a security control. Verified: it makes
  the generated control render as a password field and makes `wp ... settings` withhold the value
  without `--reveal-secrets`, but `Settings_Manager::export_values()` never consults `is_masked()`,
  so the real value is in the REST response like any other. Protect a secret with the capability on
  the route and by not exposing it at all — `show_in_rest: false` — rather than by marking it masked.
