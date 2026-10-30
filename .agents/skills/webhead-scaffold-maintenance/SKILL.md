---
name: webhead-scaffold-maintenance
description: "Use this skill when updating framework-owned generated files, composer/package manifests, AI guide files, scaffold:update behavior, or framework upgrade workflows for Searcio - Fast AI Product Search for WooCommerce."
license: MIT
metadata:
  author: webhead
---

# webhead Scaffold Maintenance

Generated files are a framework-owned contract, but product plugins may customize package manifests and source code. Update generated projects by merging framework-owned changes, not by replacing whole files blindly.

## Generated Contract

- `composer.json` keeps `webhead/wp-plugin-framework` in `require-dev`.
- Mozart output lives in `includes/Dependencies` for release builds. The path comes from `extra.mozart.dep_directory` in `composer.json`; read it from there instead of assuming it.
- The main plugin file loads `includes/autoload.php` and nothing from `vendor`. That file is framework-owned and rendered from `autoload.psr-4` and `extra.mozart.dep_directory` of `composer.json`: after changing either, run `composer framework:update`. In a plugin generated earlier, the update replaces the scaffolder's `vendor/autoload.php` line itself; when it cannot, it says why and `.distignore` keeps `vendor` in the package until the reason is gone.
- `composer install` runs `vendor/bin/webhead bundle:prune` after Mozart. It removes the framework modules listed under `extra.webhead.exclude-modules` (`updates`, `command-runner`) and refuses to build while plugin code still uses one of them.
- `package.json` may include product-specific custom dependencies and scripts.
- `package.json` includes framework-owned npm overrides for vulnerable `@wordpress/scripts` transitive build tooling; preserve product-specific custom overrides. `scaffold:update` drops an override the framework has retired, but only when its value is still the one the framework wrote.
- `composer framework:update` runs `vendor/bin/webhead scaffold:update --path=.`.
- Older generated plugins may not have that Composer script; use `wh-plugin update --path=.` from the plugin root when the global CLI is installed.
- Framework-owned config files carry the `Webhead scaffold managed file` marker. Files without that marker are treated as product-owned and must be preserved.
- AI guidance lives in `AGENTS.md`, `CLAUDE.md`, tool-native files, `.agents/skills/*`, `.claude/skills/*`, and `.codex/*` when selected.
- Legacy `.ai` guidance is removed by the scaffold updater after current agent-native files and `.agents/skills/*` files are written.
- Generated `Example_*` classes and example block files are reference scaffolds only. Their registrations in `includes/Plugin.php` should remain commented until replaced with real plugin behavior and tests, and unused examples must be deleted before production.
- `scaffold:update` removes what earlier scaffolds wrote to hold a directory open: an `index.php` that only says "Silence is golden", an empty `.gitkeep`, and then the directories that leaves empty (`templates`, `includes/DTO`, `includes/Enums`, `includes/classes`). It removes a file only while it is still exactly what the scaffold wrote, and it keeps the `index.php` in the plugin root and a `languages` directory that holds nothing else. Do not put those files back.
- `bundle:prune` removes the directory Mozart keeps for class-mapped packages (`extra.mozart.classmap_directory`) when it is empty. `phpstan.neon` names that path with ` (?)` because of it.
- `scaffold:update` refreshes `src/components/AdminPage.js` and `src/components/admin-page.scss`, the shell every admin screen is drawn by, in a plugin that has them. `src/components/Default/default.scss` is the plugin's own and is never rewritten.
- `webpack.config.js` resolves a package as Node does, from the `node_modules` nearest to the file that asks, and bundles nothing from outside the plugin (`resolve.restrictions`). Do not give it a `resolve.modules` list. One that names the top `node_modules` bundles a package with another package's release of its dependency, and the build passes: `motion` ran on the `framer-motion` of `@wordpress/components`, and the words of a page header went out for a frame as they came in. `scaffold:update` refreshes a configuration that carries the marker and names the line to change in one that does not.
- A package linked into `node_modules` from another directory (`npm link`, a `file:` dependency) is outside the plugin and is not bundled. `npm install --install-links` installs a copy of it.

## Update Rules

- Use `vendor/bin/webhead scaffold:update --path=.` after updating the framework package.
- Use `wh-plugin update --path=.` when the local framework copy is too old to provide `composer framework:update`.
- Preserve custom Composer packages, dev packages, scripts, and package metadata.
- Preserve custom npm dependencies, dev dependencies, scripts, and overrides.
- Preserve custom `.agents/skills/*` files while updating framework-owned AI guide files.
- Preserve unmanaged `.editorconfig`, `phpcs.xml`, `phpstan.neon`, and `webpack.config.js` files unless they carry the `Webhead scaffold managed file` marker.
- Do not delete `composer.json` or `package.json` and recreate them from stubs.
- Rename the plugin with `wh-plugin rename`, never by hand. The display name is the `Plugin Name` header. The text domain is the `Text Domain` header and the `TEXT_DOMAIN` constant, and names translations only. The slug is the `PLUGIN_SLUG` constant in the main plugin file, and names everything a site stores: options, tables, capabilities, hooks, REST routes, WP-CLI commands, asset handles, CSS classes and the package in Central. `--slug` moves the text domain and keeps the slug. `--unreleased` moves the slug, the namespace and the main file as well, and is for a plugin that is on no site yet. `scaffold:update` reads the slug from `PLUGIN_SLUG`, so keep it written out in the main file.
- After dependency changes, run `composer update -W` and `npm install` as appropriate.

## Verification

- Confirm custom packages and scripts survived the update.
- Run the affected PHPUnit tests.
- Build JavaScript assets when package or webpack output changed. What is in `public` was made by the configuration of the build before, so an update that refreshed `webpack.config.js` changes nothing on a screen until `npm run build` has run.
- Run `npm install`, then `npm audit` and `npm run build`, when the update changed JavaScript dependencies, npm overrides, or build tooling. (The framework repository audits the generated manifest upstream; that script does not exist in this plugin.)
- An exit code of 0 from `npm install` does not say that an override the update added or raised is in the tree. npm can report `up to date` and keep the copy it had: the lockfile and `node_modules` each hold it for the other. `scaffold:update` names the packages; run `npm ls <package>` for them, and where a copy is `invalid`, delete `package-lock.json` and `node_modules` and install again. `npm audit` goes on reporting the advisory until then.
- Run `npm run test:e2e` for generated React admin UI changes when the wp-env site is running.
- Keep `README.md` and agent skill guidance aligned with the current generated workflow.
