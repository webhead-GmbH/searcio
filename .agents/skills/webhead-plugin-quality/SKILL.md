---
name: webhead-plugin-quality
description: "Use this skill when checking WordPress plugin quality in Searcio - Fast AI Product Search for WooCommerce: security, escaping, capabilities, translations, Site Health, diagnostics, release packaging, plugin-check, and operational safety."
license: MIT
metadata:
  author: webhead
---

# webhead Plugin Quality

Use this before finalizing changes that affect WordPress runtime behavior, release output, translations, security, support diagnostics, or operational safety.

## WordPress Quality Rules

- Escape every dynamic output for its final HTML, attribute, URL, JavaScript, or text context.
- Sanitize and validate input at the boundary.
- Use plugin capability constants instead of scattering raw `manage_options`.
- Keep public REST routes intentional and explicit.
- Keep diagnostics and command execution support-only, allowlisted, timeout-limited, and output-limited.
- Keep plugin-owned database cleanup behind `Database_Manager`, registered `Table` classes, `Uninstall_Manager::register_database_tables_cleanup()`, and `Uninstall_Manager::register_metadata_cleanup()` instead of raw `$wpdb` cleanup SQL in plugin bootstrap files.
- Keep plugin-owned filesystem writes under approved roots and handle failure results.
- Keep cache keys scoped and grouped through the framework cache facade.
- Keep Site Health tests and diagnostics aligned with runtime behavior.
- `phpcs.xml` and `phpstan.neon` are written so that this plugin's generated code passes both. When the tools are installed (`wp-coding-standards/wpcs`, `phpstan/phpstan`, `szepeviktor/phpstan-wordpress`), run `vendor/bin/phpcs` and `vendor/bin/phpstan analyse` before finishing a PHP change, and fix a finding in the code rather than by widening the ruleset. Short arrays and a slash in hook names are this project's style.

## Translations

- Keep the text domain `webhead-search-cloud` consistent.
- Update `languages/script-translation-map.json` when JavaScript source paths move.
- Exclude AI skill folders, tests, docs, dependencies, and generated assets from POT generation.

## Release Checks

- A release package ships `includes/Dependencies` and contains neither `vendor` nor `composer.json`; `.distignore` names both. WordPress loads the plugin through `includes/autoload.php`, never through `vendor/autoload.php`, so nothing that only Composer's autoloader loads is available at runtime: no package left in `vendor`, no `autoload.files` entry. Bundle a runtime package through `extra.mozart.packages`.
- `includes/Dependencies` must contain runtime code only. It should hold `Webhead`, `League`, `Psr`, and the prefixed `composer` autoloader — and nothing else. A `Symfony` directory, a `Console` directory, or any `.stub` file means the Mozart configuration in `composer.json` lost its `excluded_packages` or `override_autoload` entries; restore them with `composer framework:update`. Shipping them adds megabytes of development tooling and produces a large number of Plugin Check findings unrelated to this plugin.
- Do not ship `node_modules`, tests, local agent guidance folders, or generated development caches.
- Run Plugin Check before release when scaffolded plugin code or runtime behavior changed. Build the release package first, then check it the way wordpress.org does: `wp plugin check webhead-search-cloud --error-severity=7 --warning-severity=6 --include-low-severity-errors --exclude-checks=prefixing --categories=plugin_repo`. Only a result of type `ERROR` refuses a submission. The `ERROR_LOW_SEVERITY` results inside `includes/Dependencies` for league/container and the Mozart autoloader are third-party code and fail nothing; a finding in a `Webhead` file there is a framework defect to report, not something to suppress here.
- A plugin hosted on WordPress.org may not contain an updater or start processes, and Plugin Check reports both by reading the code. Such a plugin lists `updates` and `command-runner` under `extra.webhead.exclude-modules` in `composer.json`. Guard optional framework services with `has_update_manager()` and `has_diagnostics_command_runner()` before using them.
