---
name: webhead-plugin-testing
description: "Use this skill whenever adding, changing, or fixing behavior in webhead Search Cloud. It covers PHPUnit, wp-env integration checks, scaffold-output expectations, and manual verification boundaries."
license: MIT
metadata:
  author: webhead
---

# webhead Plugin Testing

Every behavior change needs a test change in the same task. Manual verification can complement tests, but it should not replace them when PHPUnit, wp-env, JavaScript tests, or scaffold-output assertions can prove the behavior.

## Required Test Coverage

- Feature additions: add tests for the new public behavior.
- Bug fixes: add or update a test that fails before the fix.
- REST endpoints: test permissions, validation, success payloads, and error payloads.
- Settings: test defaults, schema validation, partial updates, unknown keys, and capability checks.
- Lifecycle: test idempotent activation, ordered upgrades, uninstall policy, and destructive safeguards.
- Jobs: test schedule registration, locking, accepted arguments, and multisite policy when applicable.
- Database tables: test schema registration, table version changes, casts, query helpers, truncate/drop helpers, metadata cleanup helpers, uninstall cleanup, and blog-switch behavior where relevant.
- DTOs, value objects, and enums: test construction, normalization, invalid inputs, and exported array shapes when applicable.

## Running Tests

- Run the narrowest useful test first.
- Run broader tests when shared contracts, scaffolding, manifests, or runtime bootstrap behavior changed.
- Use wp-env integration tests when activation, deactivation, uninstall, multisite, or WordPress hook timing cannot be proven in pure unit tests.
- Do not delete tests without explicit approval.
- If a test cannot reasonably be written, document the concrete reason and remaining risk before finalizing.

## Verification Commands

- Run `composer install` on a fresh checkout before testing runtime behavior.
- Run `composer dump-autoload` after file moves, namespace changes, or new classes.
- Add or update the narrowest useful automated test for each changed behavior.
- Run affected PHPUnit, wp-env, or JavaScript tests first; run a broader suite when shared framework or scaffold behavior changed.
- Lint changed PHP files with `php -l` and include `webhead-search-cloud.php` and `includes/Plugin.php` in that pass.
- Confirm the plugin header still reflects minimum WordPress, minimum PHP, and required-plugin slugs.
- Confirm Site Health and admin notices report unmet requirements when a required plugin is missing or inactive.
- Validate multisite behavior when changes touch options, database tables, activation, blog switching, or capability sync.
- Run `npm install` and `npm run build` after JavaScript, block-editor, or admin UI changes.
- Open the settings UI in a browser and verify card title sizing, nested card variants, keyboard focus, and responsive wrapping.
- Verify REST routes still use `webhead-search-cloud/v1` and permission callbacks remain explicit.
