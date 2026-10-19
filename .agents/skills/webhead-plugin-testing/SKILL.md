---
name: webhead-plugin-testing
description: "Use this skill whenever adding, changing, or fixing behavior in webhead Search Cloud. Routes a change to the right test tier, states required coverage, and lists the commands. For wp-env internals use webhead-wp-env-testing; for Playwright use webhead-e2e-testing."
license: MIT
metadata:
  author: webhead
---

# webhead Plugin Testing

Every behavior change needs a test change in the same task. Manual verification can complement tests, but it does not replace them when PHPUnit, wp-env, or Playwright can prove the behavior.

## Pick The Tier First

Three suites. Choose the cheapest one that can actually prove the change.

| Tier | Location | Runs against | Use it when |
| --- | --- | --- | --- |
| Unit | `tests/Unit` | No WordPress, no database, no Docker | The subject is pure PHP: value objects, DTOs, enums, attribute declarations, calculations |
| Integration | `tests/Integration` | Real WordPress + database in wp-env | Activation, options, capabilities, REST, cron, custom tables, hook timing, multisite |
| End-to-end | `tests/e2e/specs` | Real browser against wp-env | Admin screens, block rendering, anything where the browser is the only place the pieces meet |

Rules of thumb:

- If a unit test needs a WordPress function polyfill to pass, it is an integration test wearing the wrong hat. Move it.
- Do not re-prove in a browser what the integration suite already proved. E2E is the slowest and most fragile tier; spend it only on what a browser alone can see.
- `tests/bootstrap.php` ships with zero polyfills on purpose. Adding one is a deliberate decision, not a reflex.

## Required Coverage

- Feature additions: test the new public behavior.
- Bug fixes: add or update a test that fails before the fix.
- REST endpoints: test who is refused, who is allowed, what an invalid payload returns, and what a valid write persists.
- Settings: test defaults, schema validation, partial updates, unknown keys, and capability checks.
- Lifecycle: test idempotent activation, ordered upgrades, uninstall policy, and destructive safeguards.
- Jobs: test schedule registration, locking, accepted arguments, and multisite policy when applicable.
- Database tables: test schema registration, table version changes, casts, query helpers, truncate/drop helpers, metadata cleanup helpers, uninstall cleanup, and blog-switch behavior where relevant.
- DTOs, value objects, and enums: test construction, normalization, invalid inputs, and exported array shapes.

Do not delete tests without explicit approval. If a test cannot reasonably be written, document the concrete reason and the remaining risk.

## Commands

```
composer test:unit                      # fast, no Docker
npm run env:start                       # start wp-env (Docker must be running)
npm run test:integration                # WordPress + database
npm run test:integration:multisite      # the same suite on a network
npm run test:e2e                        # Playwright (run `npm run build` first if this plugin has a build)
npm run test:php                        # integration + multisite
```

Run the narrowest useful suite first. Run a broader one when shared contracts, manifests, or bootstrap behavior changed.

The wp-env scripts use `--env-cwd=wp-content/plugins/webhead-search-cloud`, so the plugin directory has to be named `webhead-search-cloud`.

If `npm run env:start` fails with `Could not find the current WordPress version in the cache and the network is not available`, this machine blocks the raw DNS lookup wp-env uses to detect connectivity. Pinning `core` does not help — wp-env resolves the version before reading your configuration. See `webhead-wp-env-testing` for the mechanism and the actual remedies.

## Which Files You May Edit

The harness is split by ownership. `composer framework:update` refreshes the framework-owned half and leaves the rest alone.

| Framework-owned — do not edit | Yours — edit freely |
| --- | --- |
| `phpunit.xml.dist`, `phpunit-integration.xml.dist`, `phpunit-integration-multisite.xml.dist` | `.wp-env.json` |
| `tests/bootstrap-framework.php` | `tests/bootstrap.php` |
| `tests/Integration/bootstrap.php` | `tests/Integration/bootstrap-extra.php` |
| `tests/Integration/wp-tests-config.php` | `playwright.config.js`, `tests/e2e/utils.js` |
| `tests/Integration/Framework_Test_Case.php` | `tests/Integration/Integration_Test_Case.php` |
| `.distignore`, `.github/workflows/run-tests.yml` | every test and spec you write |

Framework-owned files carry a `Webhead scaffold managed file` marker. Editing one and leaving the marker in place means the next update silently discards the change.

A seed-once file deleted on purpose is recreated by the next update, because "never existed" and "removed" look identical on disk. Empty it or replace its contents instead of deleting it.

## Example Tests

The generated `Example_*` tests guard themselves with `skip_unless_registered()`, because the matching registrations in `includes/Plugin.php` are commented out. Their skip messages are the to-do list. When you replace an example with real behavior, delete its test along with the example class — ship neither.

## Release Hygiene

Nothing in the test harness may reach the distributed package. `.distignore` already excludes `tests`, `phpunit*.xml.dist`, `playwright.config.js`, `.wp-env.json`, and the artifact directories. Add any new development-only path there in the same change that creates it.

If this plugin was scaffolded before the harness existed, `.gitignore` may still be missing these entries. Add them by hand:

```
/artifacts/
/playwright-report/
/test-results/
.wp-env.override.json
```

## CI

`.github/workflows/run-tests.yml` runs all three suites on pull requests. It needs a `COMPOSER_AUTH` repository secret that can read the private `webhead/wp-plugin-framework` repository; without it the first `composer install` fails.

## Verification Commands

- Run `composer install` on a fresh checkout before testing runtime behavior.
- Run `composer dump-autoload` after file moves, namespace changes, or new classes.
- Add or update the narrowest useful automated test for each changed behavior.
- Run `composer test:unit` for WordPress-free logic; it needs no Docker.
- Run `npm run env:start` then `npm run test:integration` for activation, options, capabilities, REST, cron, tables, or hook timing.
- Run `npm run test:integration:multisite` when the change touches options, tables, activation, blog switching, or capability sync.
- Run `npm run test:e2e` for admin screens, block rendering, or anything only a browser can observe.
- Lint changed PHP files with `php -l` and include `searcio.php` and `includes/Plugin.php` in that pass.
- Confirm the plugin header still reflects minimum WordPress, minimum PHP, and required-plugin slugs.
- Confirm Site Health and admin notices report unmet requirements when a required plugin is missing or inactive.
- Validate multisite behavior when changes touch options, database tables, activation, blog switching, or capability sync.
- Run `npm install` and `npm run build` after JavaScript, block-editor, or admin UI changes, and before the end-to-end suite.
- Open the settings UI in a browser and verify card title sizing, nested card variants, keyboard focus, and responsive wrapping.
- Check every state of a screen, not the screen at rest: click each action, open each overlay, make a field wrong, empty the list, narrow the window, and switch to a right-to-left language.
- Measure that nothing a screen stacks touches what is above it. `leaves a gap between everything it stacks` in `tests/e2e/specs/settings-page.spec.js` does it for the settings screen; copy it for every page you add.
- Open every admin screen you added beside the settings screen, at a width above 1920px as well as on a phone, and measure both: same left edge, same width, same header. A frame that stops growing at some maximum looks right on any screen narrower than that maximum.
- Verify REST routes still use `webhead-search-cloud/v1` and permission callbacks remain explicit.
