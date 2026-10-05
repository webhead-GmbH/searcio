---
name: webhead-wp-env-testing
description: "Use this skill when writing or debugging webhead Search Cloud's wp-env integration tests: the tests/Integration suite, the wp-phpunit bootstrap, database transactions, activation state, multisite runs, .wp-env.json, or a suite that will not boot."
license: MIT
metadata:
  author: webhead
---

# webhead wp-env Integration Testing

The integration suite boots real WordPress against a real database inside Docker, so it can prove the things unit tests structurally cannot: activation, options, capabilities, REST routing, cron, custom tables, hook timing, and multisite.

## Running It

```
npm run env:start                       # Docker must already be running
npm run test:integration
npm run test:integration:multisite
npm run env:stop
```

Both suites run inside the wp-env `tests-cli` container against the throwaway `tests-*` database, never the development site on port 8888.

To run a single file or filter:

```
npm run test:integration -- --filter Activation_Test
```

## How The Bootstrap Works

`tests/Integration/bootstrap.php` runs in this order:

1. Loads Composer's autoloader, which exports `WP_PHPUNIT__DIR`.
2. Points `WP_TESTS_CONFIG_FILE_PATH` at `tests/Integration/wp-tests-config.php`, which reads the `WORDPRESS_DB_*` variables wp-env exports into the container.
3. Requires `tests/Integration/bootstrap-extra.php` when it exists — your hook, see below.
4. Registers the plugin's main file on `muplugins_loaded`, so it is active for every test.
5. Captures the booted instance from the `webhead_search_cloud/after_load` action into `$GLOBALS['webhead_search_cloud_test_plugin']`.
6. Boots WordPress, which drops and recreates every table in the test database.
7. Calls `activate()` once, so the suite starts against the plugin's real schema, options, and capabilities.

`bootstrap.php` is framework-owned. Never edit it.

## Extending The Bootstrap

`tests/Integration/bootstrap-extra.php` is where anything plugin-specific goes. It is loaded before the plugin registers its own `muplugins_loaded` callback, so callbacks it adds on that action run first — which is how you make a companion plugin's classes exist before this plugin boots against them.

The scaffold writes the file when the plugin has a `Requires Plugins` header or an Elementor widget, already loading those plugins. It is yours from then on; create it yourself when the plugin gains its first companion later.

The test database is installed from scratch on every run, so WordPress starts with **no active plugin**. A companion that `.wp-env.json` installs is on disk and nothing more: unless this file requires its main file, every test that needs it skips.

```php
tests_add_filter(
	'muplugins_loaded',
	static function (): void {
		foreach ( [ 'woocommerce' ] as $slug ) {
			$main_file = WP_PLUGIN_DIR . '/' . $slug . '/' . $slug . '.php';

			if ( is_readable( $main_file ) ) {
				require_once $main_file;
			}
		}
	}
);

// WooCommerce creates its tables and roles when it is installed, which a test
// database never was.
tests_add_filter(
	'setup_theme',
	static function (): void {
		if ( class_exists( 'WC_Install' ) ) {
			WC_Install::install();
		}
	}
);
```

## Transactions: What Resets And What Does Not

Every test runs inside a database transaction that is rolled back afterwards.

- Rows created in a test disappear. Never write a test that depends on another test's rows.
- Schema changes (`CREATE TABLE`, `ALTER TABLE`) are committed implicitly by MySQL and survive the rollback. That is why table creation belongs in bootstrap, not in a test.
- Options written during bootstrap persist for the whole suite; options written inside a test roll back.
- Anything cached in a PHP static or singleton does not roll back. Reset it in `set_up()`.

## Test Base Class

Extend `Integration_Test_Case`, which extends the framework-owned `Framework_Test_Case`. Available helpers:

| Helper | Purpose |
| --- | --- |
| `plugin()`, `container()`, `service( $id )`, `settings()` | Reach the booted plugin and its services |
| `acting_as( $role )` | Run as a new user with that role; pass `''` for logged out |
| `rest_request( $method, $route, $body )` | Dispatch through the real REST server, so permissions and validation run |
| `skip_if_multisite()`, `skip_unless_multisite()` | Express divergent expectations across the two runs |
| `skip_unless_registered( $check, $message )` | Guard a test whose subject is still a commented-out example |

Put your own shared fixtures in `Integration_Test_Case`. Do not edit `Framework_Test_Case`.

## Multisite

The same suite runs twice. The multisite run sets `WP_MULTISITE=1` through `phpunit-integration-multisite.xml.dist`, because PHPUnit applies `<env>` before it loads the bootstrap — which is exactly when wp-phpunit reads it — and because an inline environment variable is not portable to PowerShell.

Bootstrap calls `activate( is_multisite() )`, so the multisite run exercises network activation.

When expectations genuinely differ, use the skip helpers rather than branching on `is_multisite()` inside an assertion. A branched assertion hides which run actually covered the behavior.

## Adding Companion Plugins

Add them to `plugins` in `.wp-env.json`, which is yours to edit, **before** this plugin:

```json
"plugins": [ "https://downloads.wordpress.org/plugin/woocommerce.zip", "." ]
```

Two things about that line are load-bearing:

- **Order.** wp-env activates the plugins in the order listed, and WordPress refuses to activate a plugin whose `Requires Plugins` are not active yet. A requirement listed after `.` stops `npm run env:start`.
- **The unversioned URL.** wp-env names a plugin's folder after its zip file, so `woocommerce.latest-stable.zip` lands in `woocommerce.latest-stable/`. WordPress matches `Requires Plugins: woocommerce` against the folder name and does not find it. `woocommerce.zip` is the same release and lands in `woocommerce/`. To pin a version use `woocommerce.9.8.1.zip`: wp-env strips a trailing version from the name.

Then `npm run env:destroy && npm run env:start`, and add the slug to the list in `tests/Integration/bootstrap-extra.php` so the integration suite loads it. Tests that need a companion plugin must skip themselves when it is absent, so the suite still passes on an install that does not have it.

## Pinning The WordPress Version

`.wp-env.json` omits `core` on purpose, so the suites run against the current stable release.

To reproduce a bug on a specific release, copy the generated example and edit it:

```
cp .wp-env.override.json.example .wp-env.override.json
npm run env:destroy && npm run env:start
```

`.wp-env.override.json` is gitignored, so this stays a local decision and CI keeps testing against current WordPress. If you also change ports there, set `WP_BASE_URL` to match or the end-to-end suite drives the wrong site.

## When It Will Not Boot

- `wp-phpunit was not found` — run `composer install`.
- `Could not find the current WordPress version in the cache and the network is not available` — a machine-level problem, not a plugin one, and **pinning `core` does not fix it**. wp-env decides whether it is online with `dns.resolve('WordPress.org')` rather than an HTTPS request, so a network that proxies or refuses raw DNS looks offline to it even when HTTPS works. It then resolves "latest" while building its own default configuration, before your `.wp-env.json` or override is read, so an explicit `core` never gets a chance to apply. The version cache that would satisfy it lives in `~/.wp-env/<hash-of-your-config-path>/wp-env-cache.json` and is created per project, so each new plugin hits this once. Fix DNS resolution for WordPress.org, or start the environment once from a network where it resolves.
- Connection refused or unknown database — the containers are not up or MySQL is still starting. Run `npm run env:start`, then `npx wp-env run tests-cli wp db check`.
- Changes to `.wp-env.json` not taking effect — wp-env caches its configuration. Run `npm run env:destroy` then `npm run env:start`.
- Class not found for framework classes — Mozart has not run. Run `composer install`, which triggers it.
- `--env-cwd` path errors — the plugin directory must be named `webhead-search-cloud`.
