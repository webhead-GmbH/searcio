# Claude Code Instructions

This repository is a framework-scaffolded WordPress plugin. Keep changes aligned with the scaffold architecture instead of drifting toward one-off patterns.

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

## Read First

- At the start of every task, read the active top-level guide file and the relevant skill files under `.agents/skills/`.
- Read `.agents/skills/webhead-plugin-architecture/SKILL.md` before changing PHP services, hooks, database code, or plugin bootstrap behavior.
- Read `.agents/skills/webhead-plugin-testing/SKILL.md` before changing behavior or finalizing verification.
- Read `.agents/skills/webhead-wp-env-testing/SKILL.md` before writing or debugging tests under `tests/Integration`, the wp-env bootstrap, or `.wp-env.json`.
- Read `.agents/skills/webhead-e2e-testing/SKILL.md` before writing or debugging Playwright specs under `tests/e2e`.
- Read `.agents/skills/webhead-plugin-quality/SKILL.md` before changing WordPress runtime behavior, translations, releases, or security-sensitive surfaces.
- Read `.agents/skills/webhead-scaffold-maintenance/SKILL.md` before changing generated files, package manifests, or framework update flows.
- Read `.agents/skills/webhead-react-admin/SKILL.md` before changing admin UI, asset loading, DataViews tables, or REST/UI integration.
- Read `.agents/skills/webhead-frontend/SKILL.md` before changing frontend React UI, frontend reset CSS, conditional frontend asset loading, responsive behavior, or accessibility.
- When using Codex, also read `.codex/instructions.md` before editing.
- When using Claude, activate the relevant mirrored skill under `.claude/skills/` before editing plugin code.

## Skills Activation

- This project has domain-specific skills in `.claude/skills/` and `.agents/skills/`.
- Use `webhead-plugin-architecture` for PHP architecture, services, hooks, REST, lifecycle, and multisite work.
- Use `webhead-plugin-testing` before changing behavior or finalizing verification.
- Use `webhead-react-admin` for React, DataViews, block-editor, asset loading, or REST/UI contracts.
- Use `webhead-frontend` for frontend React UI, scoped reset CSS, conditional frontend asset loading, responsive behavior, or accessibility.
- Use `webhead-elementor-widgets` for Elementor widget controls, live previews, style tabs, responsive controls, or widget asset loading.
- Use `webhead-plugin-quality` for security, translations, release checks, diagnostics, and plugin-check readiness.
- Use `webhead-scaffold-maintenance` for framework update merges and generated manifest changes.

## Important Paths

- `webhead-search-cloud.php` is the WordPress entrypoint that loads Composer and boots the plugin class.
- `includes/Plugin.php` is the runtime source of truth for services, hooks, settings, capabilities, jobs, lifecycle, health checks, diagnostics, compatibility, and updates.
- `includes/Capabilities/Plugin_Capabilities.php` is the default capability map for admin, REST, and optional network-admin guards.
- `includes/Settings/Plugin_Settings.php` is the single source of truth for settings metadata, defaults, schema, and REST exposure.
- `.agents/skills/webhead-plugin-architecture/SKILL.md` is the high-level architecture and container guide.
- `.agents/skills/webhead-plugin-testing/SKILL.md` routes a change to the right test tier and defines required coverage.
- `.agents/skills/webhead-wp-env-testing/SKILL.md` covers the wp-env integration suite, its bootstrap, transactions, and multisite runs.
- `.agents/skills/webhead-e2e-testing/SKILL.md` covers Playwright specs, fixtures, seeding, and flake control.
- `tests/Unit`, `tests/Integration`, and `tests/e2e/specs` hold the three test tiers.
- `.agents/skills/webhead-react-admin/SKILL.md` covers React, DataViews, block-editor, asset loading, and REST/UI contracts.
- `.agents/skills/webhead-frontend/SKILL.md` covers frontend React surfaces, scoped reset CSS, conditional asset loading, responsiveness, and accessibility.
- `.agents/skills/webhead-elementor-widgets/SKILL.md` covers Elementor widget controls, live previews, style tabs, responsive controls, and widget-specific asset loading.
- `.agents/skills/webhead-plugin-quality/SKILL.md` covers WordPress runtime quality, security, translations, and release checks.
- `.agents/skills/webhead-scaffold-maintenance/SKILL.md` covers framework update and generated-manifest merge behavior.
- `includes/Admin/Settings_Page.php` handles admin-page registration and asset bootstrapping for the React UI.
- `src/components/Default/*`, `src/admin/settings/*`, and `src/settings/store/*` own the React admin shell, settings screen, and data flow.
- `blocks/example-notice/block.json` is the source of truth for the example block metadata.
- `src/blocks/example-notice/index.js` is the editor entrypoint for the example block.
- `includes/Routing/` contains REST endpoints and permission contracts.
- `includes/Database/Tables/` contains custom table definitions and query entrypoints.

## Architecture Rules

- `includes/Plugin.php` owns service registration, hook registration, table registration, compatibility access, and multisite behavior.
- Shared services should be container-managed instead of being re-created ad hoc inside random classes.
- Use the framework hook layer, REST base class, database manager, and PHP attributes when they fit the task.
- Treat stable identifiers such as the plugin slug, namespace, text domain, hook prefix, cache group, and REST namespace as public contracts.
- Write the company/brand name as `webhead` in lowercase in prose, UI copy, documentation, and generated guidance. Preserve existing case only for code identifiers, PHP namespaces/classes, Composer package names, constants, and third-party proper nouns.

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

## Workflow

1. Read the active agent guide and the relevant `.agents/skills/*/SKILL.md` files before editing anything.
2. Identify the affected public contracts first: plugin slug, namespace, text domain, hook prefix, cache group, REST paths, table names, option keys, and capability names.
3. Decide which automated test must be added or updated before implementing the final code.
4. Implement the change inside the existing framework pattern instead of introducing a parallel bootstrap, hook, routing, or database system.
5. Use DTO/value objects or PHP enums when a reusable cross-layer contract appears.
6. Keep multisite, WPML, Polylang, and Wordfence compatibility as a hard requirement.
7. Keep non-table upgrades in `register_upgrade_steps()` and uninstall behavior in `configure_uninstall()`.
8. Run verification, then update `README.md` and `.agents/skills/*` docs if the developer contract changed.
9. If a JavaScript surface changes, validate PHP registration and build output in the same change.

## Do

- Treat `includes/Plugin.php` as the runtime source of truth.
- Register shared services in the container before trying to use them elsewhere.
- Register WordPress hooks through hookable classes and the framework hook manager.
- Prefer framework managers for dependencies, settings, capabilities, jobs, cache, filesystem, diagnostics, and lifecycle work.
- Keep identifiers stable across the plugin: slug, namespace, text domain, hook prefix, cache group, REST namespace, table-version key, and capability names.
- Keep compatibility code defensive when optional third-party plugins are inactive.
- Add or update automated tests in the same change for every behavior, scaffold output, REST/UI contract, lifecycle path, or bug fix you touch.
- Create focused DTO/value object classes for reusable payloads that cross services, REST endpoints, tables, or UI boundaries.
- Create PHP enums for finite states, modes, policies, or option values instead of spreading string literals through the codebase.
- Use `@wordpress/dataviews` for admin tables and keep search, filtering, sorting, and pagination server-driven.
- Use recommended `@wordpress/ui` primitives for generated admin UI: `Card.Root`, `Card.Header`, `Card.Title`, `Card.Content`, `Tabs.Root`, `Tabs.List`, `Tabs.Tab`, `Tabs.Panel`, and `Text`.
- Put titles inside `Card.Header` with `Card.Title`; use the `render` prop for semantic heading levels.
- Use `Text` variants such as `heading-xl`, `heading-lg`, `heading-md`, `body-md`, and `body-sm` instead of hard-coded admin font sizes.
- Use Webhead card variants deliberately: `*-card--dotted` for second-level cards inside another card, `*-card--secondary` for third-level cards inside dotted cards, and `*-card--grid` only when a grid background is intentionally useful.
- Follow WordPress Design System elevation and radius tokens: use card/container radius tokens and extra-small elevation for grouped content, reserving larger elevation for transient overlays or modals.
- Use WordPress Design System tokens by purpose: semantic colors for foreground/background/stroke states, `Text` variants or typography tokens for text, radius tokens by container size, elevation tokens by layer purpose, and motion tokens for duration/easing.
- Follow the documented save/submit pattern: busy state while saving, disabled save button with a "No unsaved changes" tooltip when clean, success feedback through the plugin snackbar/toast pattern, and `ConfirmDialog` for failed saves.
- Follow destructive-action guidance: no destructive styling for reversible non-visible changes, `ConfirmDialog` for visible but undoable changes, and a non-dismissible modal with an `isDestructive` primary action for irreversible changes.
- Choose `Badge` intent by attention priority: prefer `none` or plain text for normal states, then `stable`, `draft`, `informational`, `low`, `medium`, or `high` only when the view needs that emphasis.
- Use higher-level controls or `DataForm` before low-level form primitives, keep tab panels as `Tabs` instead of link lists, and use tooltips only as visual labels with accessible trigger names.
- Keep large tab sets responsive with a horizontally scrollable `Tabs.List`, token spacing, visible focus, and browser checks at desktop and mobile widths.

## Don't

- Do not rename the plugin slug, namespace, text domain, hook prefix, cache group, or REST namespace in only one place.
- Do not scatter raw `add_action()` or `add_filter()` calls through unrelated files when a centralized hookable class is more appropriate.
- Do not bypass framework managers for schema registration, settings writes, scheduled jobs, cache invalidation, or lifecycle cleanup.
- Do not assume WPML, Polylang, or Wordfence are active.
- Do not assume the plugin will only run on single-site WordPress.
- Do not hardcode environment-specific absolute paths, URLs, or credentials into the plugin.
- Do not edit generated or built assets without updating the source that owns them.
- Do not skip tests when PHPUnit, wp-env, JavaScript tests, or scaffold-output assertions can cover the change.
- Do not edit files carrying the `Webhead scaffold managed file` marker; `scaffold:update` overwrites them. Use `tests/Integration/bootstrap-extra.php` and `Integration_Test_Case` instead.
- Do not add WordPress function polyfills to `tests/bootstrap.php` to force a test into the unit tier; move the test to `tests/Integration`.
- Do not ship the test harness: keep `tests`, `phpunit*.xml.dist`, `playwright.config.js`, and `.wp-env.json` listed in `.distignore`.
- Do not use `Heading`, `Card`, or `TabPanel` from `@wordpress/components` in new WordPress 7+ React admin code when recommended `@wordpress/ui` replacements exist.
- Do not fix wp-admin typography drift by adding arbitrary CSS `font-size` values to generated admin styles.

## Verification

- Run `composer install` on a fresh checkout before testing runtime behavior.
- Run `composer dump-autoload` after file moves, namespace changes, or new classes.
- Add or update the narrowest useful automated test for each changed behavior.
- Run `composer test:unit` for WordPress-free logic; it needs no Docker.
- Run `npm run env:start` then `npm run test:integration` for activation, options, capabilities, REST, cron, tables, or hook timing.
- Run `npm run test:integration:multisite` when the change touches options, tables, activation, blog switching, or capability sync.
- Run `npm run test:e2e` for admin screens, block rendering, or anything only a browser can observe.
- Lint changed PHP files with `php -l` and include `webhead-search-cloud.php` and `includes/Plugin.php` in that pass.
- Confirm the plugin header still reflects minimum WordPress, minimum PHP, and required-plugin slugs.
- Confirm Site Health and admin notices report unmet requirements when a required plugin is missing or inactive.
- Validate multisite behavior when changes touch options, database tables, activation, blog switching, or capability sync.
- Run `npm install` and `npm run build` after JavaScript, block-editor, or admin UI changes, and before the end-to-end suite.
- Open the settings UI in a browser and verify card title sizing, nested card variants, keyboard focus, and responsive wrapping.
- Verify REST routes still use `webhead-search-cloud/v1` and permission callbacks remain explicit.
