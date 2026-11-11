# Developer Guide

This plugin is built on the `webhead/wp-plugin-framework` scaffold. `includes/Plugin.php` is the runtime source of truth for service registration, hooks, settings, capabilities, database tables, jobs, lifecycle, health checks, diagnostics, and compatibility. If you're changing plugin behavior, also read the relevant skill file under `.agents/skills/` (or `.claude/skills/`) before editing - they describe the architectural conventions this codebase follows.

## Building from source

```bash
composer install
npm install
npm run build
```

`composer install` also runs Mozart, which copies the framework runtime into `includes/Dependencies` under the `Webhead\WP\SearchCloud\Dependencies\` namespace. The framework itself (`webhead/wp-plugin-framework`) is a `require-dev` dependency only - it must never ship in a release; `includes/Dependencies` is the runtime copy that does.

WordPress loads the plugin through `includes/autoload.php` and never through Composer's autoloader. That file registers the plugin's namespace as `autoload.psr-4` of `composer.json` names it, loads the autoloader of the bundle, and loads the framework's helper functions, which are functions of the bundle's namespace (`use function Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Support\Helpers\arr_get;`). It is the framework's file: change the namespace map in `composer.json` and run `composer framework:update`. `vendor/autoload.php` is for the test suites, whose bootstraps load it themselves. So the plugin runs on the same files where it is developed and where it is installed, and nothing in `includes/`, the main file or `uninstall.php` may ask for `vendor`: a release package has none.

The build bundles a package the way Node finds it: from the `node_modules` nearest to the file that imports it. A package therefore gets the release of a dependency that npm installed for it, also when another package needs a different one: `motion` runs on its own `framer-motion` and not on the older one `@wordpress/components` brings. Nothing from outside the checkout is bundled. A checkout with no `node_modules` of its own, a git worktree for one, stops with `Can't resolve` where it used to read the directory above it, and so does a `node_modules` that is a link to another checkout's, or a package that `npm link` or a `file:` dependency links in. Run `npm install` in the checkout itself; `npm install --install-links` installs a copy of a linked package. `node vendor/webhead/wp-plugin-framework/tests/scaffold-npm-audit/resolution.js .` asks the configuration where it finds each package, without building.

For a release build:

```bash
composer install
npm ci
npm run build
```

`.distignore` excludes source-only directories (`src/`, `tests/`, `docs/`, `node_modules/` and the agent-guidance folders) from packaged releases, and with them `vendor/`, `composer.json` and `composer.lock`. A package holds `includes/Dependencies` and nothing else of Composer's, so there is no production install to make before packaging.

## Architecture overview

### Settings

`includes/Settings/Plugin_Settings.php` is the single source of truth for every setting: option key, type, default, REST exposure, and (for two of them) masking/encryption. Settings are declared with the framework's `#[Setting(...)]` PHP attribute. Because attribute arguments must be compile-time constants, their `label`/`description` can never be wrapped in `__()` directly - settings with a hand-written place of their own in the admin (the Connection, Indexing and Search Config tabs, the last with its Popular searches list, and the General tab's Support Searcio card) render translated labels client-side instead; the two settings that only render on the generic schema-driven tab (`SYNC_RETENTION_DAYS`, `DELETE_DATA_ON_UNINSTALL`) get their translated label/description merged in server-side via `Plugin_Settings::translated_schema_overrides()` and `Settings_Endpoint::translate_schema()`. Follow the same pattern if you add a setting with no dedicated tab.

Write key and write secret are encrypted at rest with AES-256-GCM, keyed from WordPress's own secure-auth salt (`Plugin_Settings::encrypt_secret()` / `decrypt_secret()`), and the sanitize callback is idempotent so re-saving an already-encrypted value doesn't double-encrypt it.

### REST API

Base route: `/wp-json/searcio/v1/`. Every endpoint lives under `includes/Routing/` and requires a logged-in user with the matching capability.

| Route | Method | Capability | Purpose |
|---|---|---|---|
| `/settings` | GET / POST | view / manage_settings | Generic REST-exposed settings (schema + values). `write_key` and `write_secret` are write-only: a response carries `__stored__` when one is saved and `''` when not, never the value; posting back `__stored__` or an empty string leaves the stored credential untouched |
| `/connection/test` | POST | view | Verify write credentials, kept five minutes for the settings screen (`fresh` asks Searcio now, as "Test connection", Site Health and the daily sync do); returns site ID, every metered allowance, the plan (with `upgrade_url`) and `statistics_url`, the dashboard page with this site's search statistics (`site.statistics_url` from the health check, or the dashboard's sign-in when Searcio names none), and `account`: `served`, `reason` (`no_active_plan`, `payment_overdue` or `account_suspended` when Searcio refuses the account), the reason's translated `title` and `message`, and `support_url` (`account.support_url`, or the dashboard's sign-in) |
| `/connection/legal` | GET | view | The links of the consent checkboxes (terms, privacy, data processing), as Searcio configures them, with the plugin's own as fallback |
| `/connection/connect` | POST | manage_settings | Zero-friction connect: sends the admin's email and name, the site's name and address and the two consents. Stores the keys when a new account was created; answers `flow: pending_claim` when the email already has one |
| `/connection/disconnect` | POST | manage_settings | Calls Searcio's `DELETE /disconnect`, which deletes the site and its index there, then clears the stored credentials. A call that fails for any reason other than Searcio no longer knowing the keys (`401`, `404`) keeps them, so that it can be tried again |
| `/indexing/config` | GET / POST | view / manage_settings | Per-post-type indexing field mapping, plus `indexed_fields`: every field a document can carry under the saved mapping (`Index_Config::indexed_fields()`, with product fields from `Woo::TOGGLE_FIELDS`) |
| `/search-config` | GET / PUT | view / manage_settings | Proxies Searcio's own search configuration, the GET kept ten minutes and forgotten by the PUT (fields, weights, boosts, facets and how each combines its values, suggestions, synonyms, languages, merchandising rules with the `lang` each keeps to). The tab offers *Any (OR)* / *All (AND)* per facet field only while the response carries `facet_match`, and then saves it with every facet field, and *Never show as a popular search* only while it carries `excluded_popular_terms`. The tab's PUT holds only the keys it changed (`toPayload( config, persisted )` in `src/admin/settings/searchConfig.js`; a feature switch only when that switch changed, `facet_match` with changed facet fields): Searcio keeps every key a PUT leaves out, so a change made in the Searcio panel while the tab showed what it had read is kept. A PUT adds the shop's currency (`Woo::currency()`, ISO 4217) when WooCommerce is active; the daily job sends it alone |
| `/quizzes` | GET / POST | manage_settings | The site's quizzes, proxied to Searcio's `/quiz-templates` with the write credentials. GET takes `search`, `status`, `lang`, `order_by`, `order`, `page` and `per_page` and applies them here, since Searcio returns every quiz of a site at once, and keeps that list ten minutes, forgotten by any write; POST creates one from `quiz`, cleaned by `DTO\Quiz_Payload`, and is sent once, never retried |
| `/quizzes/{id}` | GET / PUT / DELETE | manage_settings | One quiz: read, replace (`quiz`) or delete |
| `/quizzes/facet-values` | GET | manage_settings | The values of each facet field with their product counts, for an answer's filters |
| `/quizzes/endings` | POST | manage_settings | Every way through the `quiz` sent and how many products each ends with, before it is saved |
| `/sync/status` | GET | view | Current sync state and indexable-type summary |
| `/sync/start` | POST | run_sync | Start a sync (`?force=true` re-sends everything) |
| `/sync/pause`, `/sync/resume`, `/sync/cancel` | POST | run_sync | Control the active run |
| `/sync/history` | GET | view | Paginated, filterable, sortable run history |
| `/sync/history/{id}` | DELETE | run_sync | Delete one history row |
| `/sync/history` | DELETE | run_sync | Clear all finished history |
| `/cache/clear` | POST | manage_settings | Invalidate the plugin's cache group and reset OPcache |
| `/placement` | GET / POST | view / manage_settings | The Placement tab's settings (the `placement` option, cleaned by `DTO\Placement_Options`) and what the tab needs besides: the theme and the selectors suggested for it, the content types, the preview's address, the look editor's groups and fonts. POST answers with what was stored |
| `/placement/look-css` | POST | manage_settings | The CSS of the look the editor has on screen, for the preview's instance class, and the Google Fonts stylesheet it needs |

One route lives outside this table and namespace: `GET /wp-json/search-cloud/v1/verify/<code>` takes no user, and is used by Searcio's async domain-ownership ping. Connecting sends Searcio a `verify_url` with a one-time code of 32 letters and digits in its path, and the route's permission callback (`Verify_Endpoint::is_searcio()`) lets a request in only with that code, within an hour of connecting, and once (`Connection_State::open_verification_window()`, `verification_code_matches()`, `close_verification_window()`); everything else is answered `404`, as if the route did not exist. It then echoes only the write key, never the write secret. The ping's `?token=` is an HMAC over Searcio's own application key, which the plugin cannot check, so the code is the protection. It is in the path because Searcio replaces the query string of `verify_url` with its own. A connect retried within the hour keeps its code. It is deliberately registered under `search-cloud/v1`, not the plugin namespace, so the `verify_url` sent on `/connect` stays stable across a plugin-slug change.

### WP-CLI

```bash
wp searcio sync status [--format=table|json]
wp searcio sync run [--force]     # blocking, ticks to completion - good for real system cron; waits out a failing index as the background sync does, exits non-zero when the run fails or is cancelled; a run paused while it works ends the command with a warning
wp searcio sync start [--force]   # non-blocking, cron-driven ticks
wp searcio sync pause
wp searcio sync resume
wp searcio sync cancel
```

Framework-managed runtime commands are also exposed under the plugin slug (`wp searcio capabilities sync|revoke|restore`, `settings dump|validate`, `jobs list|run`, `upgrades run`, `health check`, `cache clear`) - see the framework's own CLI docs for those. `vendor/bin/webhead` is scaffolding-only; runtime maintenance always goes through `wp searcio ...`.

### Database tables

Both tables are managed through `Database_Manager` and registered `Table` classes (`includes/Database/Tables/`) - never query them with raw `$wpdb` SQL.

- **`sync_runs`** - one row per sync run (the single active row is live state; finished rows are history). Tracks status, trigger, progress counters, a resumable cursor, and between-batch pause/cancel signals.
- **`change_queue`** - incremental-sync queue. Editorial hooks (save/trash/delete/status-transition, a WooCommerce product update, and a term renamed, moved or deleted, which queues the posts filed under it and under its descendants) enqueue a coalesced row per post (edit-then-delete collapses to a single delete); the drain job processes and clears them in batches.

### Jobs

- **`Scheduled_Sync_Job`** - daily, lock-protected; starts a sync if idle and applies the history-retention policy. A run is the only one that can be active, and while one is, the drain sends nothing, so the job never leaves one standing: it re-arms a running one whose worker died and resumes a paused one.
- **`Sync_Tick_Job`** - the resumable full-sync worker; one-off, self-rescheduling while work remains. A batch the index did not take (after the client's own three tries within seconds) leaves the run `running`: the cursor counts the failure in `retries`, `last_error` says when the next try is, and the tick is scheduled 1, 2, 5, 10, 15 and then 30 minutes ahead (`Sync_Service::RETRY_DELAYS`). The seventh failure in a row ends the run as `failed`. A batch that is taken sets `retries` back to 0. Nothing of a batch that failed is counted; its documents are added to `failed_count` once, when the run gives up. An account Searcio does not serve is the exception: a `402` or `403` with a `reason` (`no_active_plan`, `payment_overdue`, `account_suspended`; `Enums\Account_Refusal`) ends the run as `failed` at once, from a batch or from a delete of the prune phase, with `last_error` naming the reason, and nothing is tried again. The incremental drain keeps a refused update queued without rescheduling itself, and hands a refused delete, and every one after it in the batch, to the next full sync's prune phase.
- **`Change_Drain_Job`** - the incremental-sync worker; drains `change_queue` in batches, self-rescheduling while non-empty.

A post is sent again only when the hash of its document changed, or a sync is forced (`Dirty_Tracker::is_fresh()`); a change of the mapping's `config_version` alone is no reason, since a document the change leaves as it was is the same document. Saving a changed mapping starts a sync (`Indexing_Endpoint::save_config()`, its answer's `sync.started`), which sends what the change altered and prunes what it left out. A password-protected post is indexed with the private ones, only when `include_private` is on (`Document_Builder::is_indexable()`); the 1.4.1 upgrade step `Unindex_Password_Protected_Posts` queues the ones 1.4.0 indexed, so the drain takes them out.

### Capabilities

`includes/Capabilities/Plugin_Capabilities.php` defines three capabilities, all granted to Administrators by default: `VIEW` (`searcio_view`, read-only: it opens the screen and the routes that only read), `RUN_SYNC` (`searcio_run_sync`, operate the sync engine, no credential/mapping changes), and `MANAGE_SETTINGS` (`searcio_manage_settings`, connection, indexing mapping and search configuration). Each is checked by itself and none implies another, so a role that is to change settings needs `VIEW` as well, or it cannot open the screen. A fourth, `MANAGE_NETWORK_SETTINGS`, is the network-admin guard: it maps to `manage_network_options` on a multisite network and to `MANAGE_SETTINGS` on a single site. Grant them to other roles/users through the framework's capability manager rather than checking `manage_options` directly.

### Multilingual support

`includes/Compatibility/Multilingual_Support.php` deliberately checks **Polylang before WPML** - Polylang registers WPML's own compatibility filters, so WPML-first detection would misidentify a Polylang-only site as running WPML. See the class docblock for the specific live bug this avoided, and [`multilingual.md`](multilingual.md) for user-facing behavior.

### Frontend display

The storefront config (`Frontend_Config::to_array()`) tells the window, besides the search key and the facets: `documentTypes`, post type => the type its documents carry, since the Indexing tab lets an admin rename it ("artikel" for posts) while a block, a shortcode, a widget and a placement name the post type (`documentType()` in `src/utils/documentType.js` turns one into the other); `typeLabels`, keyed by that document type; `hasFeatured`, whether `featured` is one of the site's facet fields, without which featured highlights fall back to the newest, since Searcio refuses a filter on any other field (422); `hasProducts`, whether products are indexed, without which the assistant speaks of the site rather than a shop; and `siteHome`, the front page of the page's language (`Multilingual_Support::home_url()`), which a search handed to WordPress goes to. Where products are indexed, what is about them asks for their type (`productType()` in `src/utils/api.js`): the highlights without a type of their own, the product rows, the product finder's matches, and photo search, whose hits are kept to it in the browser because the service takes no type there. Similar products keep to the source's own post type, read from the document ids. On a page in a language the site does not index, the window asks Searcio for nothing before a search. A facet whose picks must all match (Searcio's `facet_match`, kept by `Facet_Config::set_match()` beside the facet fields) carries `match: 'all'`, and the window then takes its fresh counts after a pick of its own. A result card is chosen by its document type, then by the post type in its id (`product-12`), and is the post card, with the text, for any other.

The Gutenberg block (`blocks/search/`) and Elementor widget (`includes/Elementor/Widgets/Search_Widget.php`) share the same rendering, styling, and runtime bundle (`Trigger_Markup`, the `bundle.search` entry) so the two embed points can't drift apart. The search modal is portalled to `document.body` at runtime in both cases, with per-instance CSS custom properties applied to both the trigger and the modal root.

The bundle is printed through the framework's asset registry (`Plugin::get_assets()`), by whatever draws a surface: a block's `render.php` enqueues the entry, and the two Elementor widgets name it in `asset_entries()` so Elementor prints it on the pages that use them and in the editor preview. Nothing is registered on a page with no surface, and the configuration the script is given (`Frontend_Config::to_array()`) is only built when the entry is first asked for - so a page without search costs no query and loads no translation. The widgets are named to the framework's Elementor manager in `Plugin::register_elementor()` and are listed in the editor panel under the plugin's own category.

Tokens that default to another token (the active tab's colour to the accent, the button background to the accent's text shade, an icon button's colour to the shared icon colour, and so on) are not declared anywhere: each rule that reads one names the default as its fallback, for example `var(--whsc-tab-text-active, var(--whsc-accent-strong))`. A fallback resolves on the element that uses it, so it follows that placement's own `--whsc-accent`; a value you set - on the placement's `whsc-instance-*` class, or site-wide on `:root` or `body` - is inherited and wins. Text drawn in the accent uses `--whsc-accent-strong`, a darker mix of `--whsc-accent` (`color-mix()`, where supported; the accent itself where not), which takes the default green to 5.8:1 on white. A light custom accent can still fall under 4.5:1 as text - `#f5a623` gives about 3.6:1 - so set `--whsc-accent-strong`, or the text tokens built on it, for such an accent. Borders, dots and focus rings keep the accent itself. The assistant's own accent has the same pair, `--whsc-assistant-accent` and `--whsc-assistant-accent-strong`. These two shades are the only derived tokens declared on each placement (at zero specificity), so set them on the placement rather than on an ancestor.

The storefront stylesheet (`src/frontend/search/scss/style.scss`) is written above the framework's reset on purpose. The reset (`src/components/Default/frontend-reset.scss`, framework-owned) weighs two ids, so that WordPress's controls look the same under any theme or Elementor kit; it takes a site's styles off every button and field of `@wordpress/components`, off every element with no class, and off every element whose class is written `block__element`. That is most of this surface and not all of it: the rule at the top of the stylesheet says the same for the rest - an element whose `whsc-` class has no `__` in it (`.whsc-card`, `.whsc-facet`, `.whsc-chip`), the few tags the reset's list leaves out, and every icon - at the reset's own weight, so that it is above the site and below every rule of the stylesheet. The stylesheet's `$lift` adds three ids to each of its rules, the Elementor widget's literal selectors add four (`Search_Widget::SPECIFICITY_BOOST`), and the roots - the trigger and a product row, which hand the page's own type, alignment and background back, and the overlays of the modal and of the filter sheet, which hand back its type and alignment and keep their own colours - take back what the reset would otherwise replace with the design system's. Theme a placement through the `--whsc-*` properties: a custom property does not compete on specificity. A rule of your own on a `.whsc-*` element has to carry `!important`.

The stylesheet loads the reset with `$components: ( modal, button, popover, tooltip, input-control )` and `$marked-overlays: true` (framework 1.11.0). The first writes only those families of `@wordpress/components` under the reset's scope - the ones the window draws and the ones they draw inside them: a Modal draws a Button, a Tooltip a Popover, the trigger's SearchControl an InputControl - where it wrote the whole package, 383 KB of a 510 KB stylesheet that is 179 KB now. The second scopes what WordPress draws at the end of `body` (the modal, the filter sheet, the popover container) by `data-webhead-frontend-overlay`, which `src/components/Default/frontend-overlays.js`, imported by the entry, sets on them, so no rule of the reset waits on `body:has()`. A component of another family added to the window needs its family named there, or the reset no longer holds it against the theme.

**What the storefront keeps and asks for early.** `src/utils/api.js` keeps every answer in memory for the page, and the answers that do not depend on the page - the storefront config, the card templates, the popular searches, the quizzes and the highlights row - in `sessionStorage` for the visit (`searcio.cache:`; the highlights five minutes), so the next page of a visit opens the window full at once. Two callers asking for the same address share one request, each with its own abort. As the pointer reaches a search control, it takes focus or a finger touches it, `warmUp()` asks for the storefront config, the popular searches and that control's highlights row, once per page. A page that enqueues the storefront by `wp_head` carries `<link rel="preconnect" crossorigin>` to the service's origin (`Frontend\Resource_Hints`), and the script adds the same link as it starts, for a page whose script comes later (a shortcode). Every `/search` sends `highlight=0`, since the window never shows a hit's highlighted fragments, and a result card's image is the 768px size (`medium_large`).

What a site still reaches is what it is meant to: the type the roots inherit (the font, its size and weight, the colour of the text, the spacing of the letters), a declaration marked `!important`, and the `--whsc-*` properties. Two elements are the package's and are held by name only, for what a site is known to change: the box trigger's field and the modal's frame. `tests/e2e/specs/site-styles.spec.js` keeps all of this true. It walks the storefront on the test site as it is, then again after `tests/e2e/seed-site-styles.php` has set every Site Settings control of the Elementor kit that styles an element the storefront also draws and added a stylesheet of the kind a theme or a designer writes, and compares the computed style of every element the plugin draws, at rest, under the pointer and in keyboard focus. Take the rule at the top of the stylesheet away and it reports several thousand differences.

A card designed in Searcio (`cardSource: server`, `src/frontend/search/components/serverCards.js`) is the template's to draw, so the stylesheet treats it differently from everything else on the surface. `.whsc-card--server` is only the box the template fills: it carries no frame of its own. Everything inside it is taken off the site as above, then started from what the panel's canvas is drawn on, Tailwind's preflight - no margin or padding, a heading and a link in the type and colour of what holds them, a list without bullets, an image as a block. The template's stylesheet is written by the service with one class per element (`.sct-12-title`); `ensureTemplateCss()` adds it to the page and then rewrites each selector through the CSSOM to weigh four ids (`liftSelectors()`), which is above the stylesheet, the reset and the site, and changes neither what a rule matches nor one rule's order against another's. A template is restyled in the panel, not from the site.

The search field is a combobox and its suggestions a listbox (`SearchInput.js`, `Suggestions.js`). Focus stays in the field: the arrow keys are handled there (`onInputKeyDown()` in `SearchModal.js`), the option they are on is marked with `aria-selected` and `.is-active`, and the field names it in `aria-activedescendant`. Typing on clears the mark, so Enter never searches for a suggestion the visitor has typed past.

An address that did not come from the plugin's own code goes through `safeHref()` (`src/utils/url.js`) before it becomes an `href` or reaches `window.location`: a search redirect a merchant configured, and a link the assistant wrote into a reply (`markdown.js`, which builds React elements and never markup). It follows an `http(s)` address or a path that starts with one slash, and nothing else; `//host` and `/\host` are another host in the clothes of a path.

**Requests in the page's language.** On a multilingual site the storefront sends `filter[lang]` with a search, its suggestions, `/quizzes`, `/search/popular` and `/search/visual`, and `filter: { lang }` in the body of an assistant message; a single-language site sends none, and a service from before ignores them. Photo search, similar products and the assistant's products also keep their hits in the page's language themselves (`visualSearch()`, `fetchSimilar()`, `askAssistant()` in `src/utils/api.js`). A filter value that holds a comma goes out as a list, `filter[field][]=` once per value (`filterValue()` in `src/utils/facets.js`); every other value keeps the plain form, which every service reads.

**The assistant's reply is shown as it is written.** `streamAssistant()` reads `POST /assistant/stream` with `fetch` and a stream reader, since `EventSource` cannot POST: `products` carries the whole list so far, `delta` the next piece of the reply, `done` the turn kept in the history, and `error` a failure after the stream began. A refusal comes before the stream, with its status.

An error the modal shows is the surface's own element (`.whsc-search-error`, with the assistant's and the product finder's error colours), not a `Notice` of `@wordpress/components`, whose look changes with the package.

The search window's filters are one bar under the search field (`FilterBar`), a group's values in a popover on a tablet or a desktop (`FilterPopover`) or a sheet on a phone, and every group in "All filters", a drawer or a sheet (`FilterSheet`, a `Modal` nested in the search modal); `FilterPanel` draws a group's values in all of them. The bar's order is the order Search Config lists the facet fields in, which the plugin keeps a copy of (`Facet_Config`, refreshed with the languages whenever an admin reads or writes the search configuration) and hands over as `facets` in the storefront config; without the copy, the groups the results carry most come first. Every control is a `.whsc-facet` and reads `--whsc-filter-*` with the `--whsc-facet-*` property of the same part as its fallback, so styling written for the old filter chips reaches it. The layout follows the modal's own width (the `whsc-modal` container query, 640px), not the viewport's.

**Placements without a block or a widget** (the Placement tab). The settings are one object option, `placement`, cleaned by `DTO\Placement_Options` and read and written by `Frontend\Placement_Config` through `/searcio/v1/placement`. `Frontend\Search_Surface` draws a search with `Trigger_Markup`, the look's CSS (`Look_Styles`) and `Style_Tokens` (the block's colour and length maps, shared with `blocks/search/render.php`), and a product row with `Product_List_Markup`, and enqueues the entry as it draws (for a product row, only when there is one to draw). No placement prints a `<style>`: its CSS goes to WordPress through `Frontend\Inline_Styles` (`wp_add_inline_style()` on a handle of its own, named after the instance class), which prints it in the head when the page is drawn before it, as a block theme's is, and with the footer's styles in a classic theme, and a Google font through `wp_enqueue_style()`:

- `[searcio]` and `[searcio_products]` (`includes/Shortcodes/`) are registered through the framework's `Shortcode_Manager`, which also tells Elementor's element cache to run an element that holds one. Their `defaults()` are the Placement tab's settings, so an attribute left out takes them. The classic widgets (`includes/Widgets/`) draw through the same shortcodes.
- The form takeover (`Frontend\Site_Placement`) filters `get_search_form`, `get_product_search_form`, `render_block_core/search` and `render_block_woocommerce/product-search`, and prints the form it replaces in a `.searcio-fallback` beside the trigger; the storefront removes it when it hydrates the trigger.
- The selectors, the shortcut and the floating button enqueue the entry on `wp_enqueue_scripts` on every front-end page. A link to `#searcio` or the class `searcio-open` in `the_content`, a menu, a widget, a Navigation link, a Button block or what Elementor prints enqueues it on that page. Either way, `wp_footer` (priority 19) prints the site's own trigger, `data-whsc-site="hidden"` or the floating button, which is what they open.
- `src/frontend/search/openers.js` listens on `window` in the capture phase, so a theme's own handler never sees a click it takes, and asks the App with a `whsc:open` event (`detail.query` is the text to start with). Any script can do the same: `window.dispatchEvent( new CustomEvent( 'whsc:open', { detail: { query: 'jacket' } } ) )`.
- Nothing of it runs in the admin, a REST request, a feed, Elementor's editor canvas or the tab's preview (`?searcio-preview=1`, a page of the site that draws unsaved settings for a user who may manage them, with the tab's nonce).
- The floating button's colours are `--whsc-floating-bg` (the accent by default) and `--whsc-floating-color` (white), and its distance from the bottom `--whsc-floating-offset`.
- The look (`search.look` in the option, edited in the tab's look editor) is every style setting of the Elementor Search widget: `Frontend\Look_Schema` lists them in groups, each with the custom property or the selectors the widget writes and the widget's own label, `DTO\Look` cleans a value by its control's type, and `Frontend\Look_Styles` writes the CSS for an instance class, with a tablet's and a phone's values in `@media (max-width:1024px)` and `@media (max-width:767px)`. A value per device is `{ desktop, tablet, mobile }`; a plain value is the desktop's. `Search_Surface` adds it before `Style_Tokens`' rule, so a shortcode's own attributes outweigh it, and loads the Google Fonts it names (`Frontend\Google_Fonts`) unless the site's global styles have the family. Settings saved before the editor carried `accent`, `background`, `text`, `icon_color` and `radius`; `Placement_Options` moves them into the look while there is none.
- The tab's preview draws its search under the instance class `whsc-instance-preview` and leaves the stored look out: the editor asks `POST /searcio/v1/placement/look-css` for the CSS of the look on screen and posts it into the preview (`{ type: 'searcio-look', css, fonts }`), which takes it only from the admin's origin and says `searcio-look-ready` when it can be sent it. The preview page's own style and that script are enqueued too (`wp_add_inline_style()`, `wp_add_inline_script()`); the script adds the style the look goes into at the end of the page, after the footer's styles. A change of anything else reloads the preview with the settings in its address, without the look.
- The placeholder and the heading are registered as the strings *Search placeholder* and *Products heading* in the *Searcio* group: with Polylang on every admin request (`pll_register_string()` keeps a string for the request), with WPML when they are saved.
- The selectors suggested per theme are in `Frontend\Theme_Presets`, each read from the theme's own markup; the class says where each came from.

**Names WordPress keeps escaped.** Terms, the site's title, display names, a post type's label as the plugin that registered it gave it, WooCommerce's attribute names and price settings, and custom fields saved by a user without `unfiltered_html` can hold HTML entities (`&amp;`, `&lt;`, `&nbsp;`). The plugin prints all of them as text (React, the index, Searcio's dashboard), so it decodes each where it hands it on, once, with `Indexing\Term_Names::decode()` (`wp_strip_all_tags()` first where the source may hold markup, as `Field_Source_Resolver::clean()` does). A value a filter sends back has to match the index, so a name is decoded on both sides or on neither. Decode only for output that escapes again: React text, `esc_html()` at echo time.

**What a search tells Searcio for the site's statistics.** Every `/search` the storefront sends carries hints that never change its results (`searchHints()` in `src/utils/api.js`):

- `surface`: where its results are shown. `overlay` is the search window's results, including "load more" and a listing by a filter alone; `highlights` is the window's empty-field carousel; `category` is a category product row; `quiz` is the product finder.
- `live=1`: a search as you type in `type` mode that the visitor has not settled on. Searcio leaves it out of the counts unless one of its results is clicked. A settled search is sent without it, so it never answers from the cache the live request for the same words left behind.
- `origin`: how a settled search was started, one of `typed` (Enter), `suggestion`, `popular`, `recent`, `voice` and `filter` (a filter picked with words in the field).
- `preview=1`, also on `/search/similar`: the page is a page builder's editor or the Placement tab's preview. `Frontend_Config` tells the storefront so (`preview`) for Elementor, Divi, Beaver Builder, Oxygen, WPBakery's frontend editor, Bricks, the Customizer and the Placement tab's preview (`?searcio-preview=1`), and Elementor's frontend says so itself.

`live` and `origin` are only sent on page one of a search with words: a listing without them and "load more" are never counted. Only a settled search outside an editor is saved as a recent search.

A click on a result sends `POST /search/click` with the `search_id` of the list it was in and its 1-based position there. This covers the search window's results and highlights, a category row, a similar-products row, a photo search, the product finder, and the assistant's cards and compare table. Each assistant product carries the `search_id` of the catalogue search that found it, and its position counts among the products of that search (`positionInSearch()` in `src/utils/clicks.js`). A middle click, which opens a result in a new tab without a `click` event, sends one too (`openHandlers()`). A service that returns no `search_id` for a list gets no beacon from it.

The stock line on product cards reads `--whsc-stock-in-color` and `--whsc-stock-out-color`. The search block (`stockInColor` / `stockOutColor`), the Elementor search widget (`card_stock_in_color` / `card_stock_out_color`) and the Placement tab's look editor (the same two controls) set them for their modal; product rows (the products block and widget) have no style controls and take the defaults or site-wide CSS.

### Filters

The plugin's filters are named `searcio_{area}_{name}`, in WordPress's own form, which Plugin Check reads as carrying the plugin's prefix. The framework's two actions in `searcio.php` keep theirs, `searcio/before_load` and `searcio/after_load`.

- **`searcio_is_indexable`** - `(bool $index, WP_Post $post)`. Asked for each post the mapping would index, after the plugin's own checks (status, catalog visibility, WooCommerce's own pages, language); return `false` to keep it out of the index. It cannot let in a post the mapping keeps out. A post it turns away is taken out of the index the next time it is saved, and by the next full sync:

  ```php
  add_filter( 'searcio_is_indexable', function ( $index, $post ) {
      return 'page' === $post->post_type && 'impressum' === $post->post_name ? false : $index;
  }, 10, 2 );
  ```

- **`searcio_index_allow_protected_meta`** - `(bool $allow, string $meta_key, ?WP_Post $post)`; `$post` is null when `Index_Config::indexed_fields()` asks whether any document carries the field. A `meta:{key}` field mapping resolves through `Field_Source_Resolver`, which skips WordPress *protected* meta (keys beginning with `_`, e.g. order internals or plugin bookkeeping) by default so an over-broad mapping can't leak internal data into public search. Return `true` for a specific key to index it anyway:

  ```php
  add_filter( 'searcio_index_allow_protected_meta', function ( $allow, $key ) {
      return '_my_public_field' === $key ? true : $allow;
  }, 10, 2 );
  ```

- **`searcio_storefront_facet_display`** - `(string $display, string $field)`. How the search window draws a field's values in its filter panels: `auto` (the default: colour pills when every value has a colour, image pills when every value has an image, tiles for sizes, shoe sizes and capacities, a checkbox list otherwise), `list`, `tiles`, `color`, `image` or `range`. Anything else is `auto`. `color` and `image` draw pills as soon as one value has a colour or an image, and a value that has none is an empty ring; with none at all they are a list. The filter is given `tiles` for an attribute a swatches plugin shows as labels or buttons, and `color` or `image` for one the shop set up as colour or image swatches, by the attribute's type or by a swatch type the plugin keeps per term, so a value the shop has not given a swatch yet does not turn the whole group into a list:

  ```php
  add_filter( 'searcio_storefront_facet_display', function ( $display, $field ) {
      return 'attr_fit' === $field ? 'tiles' : $display;
  }, 10, 2 );
  ```

- **`searcio_storefront_facet_colors`** - `(array $colors, string $field, string $taxonomy)`. Value => hex colour for a field's values, in the language of the page. The plugin fills it for a WooCommerce attribute a swatches plugin has dressed (see below); `$taxonomy` is empty for a field that is not an attribute. A value without a valid hex colour is dropped.

- **`searcio_storefront_facet_images`** - `(array $images, string $field, string $taxonomy)`. Value => image address, in the same way. An address that is not `http` or `https` is dropped. Use it, with `facet_colors`, for a theme or a plugin the list below does not name.

**Swatches.** What a swatches plugin or a theme set for an attribute's terms reaches the filters by itself, in `Swatch_Reader`, with the keys read from each one's own source and each checked by saving swatches in its own admin screens. The attribute's type (`wc_get_attribute()`) says which counts, since a plugin keeps what was set before the type changed:

| Plugin or theme | Colour | Image | Label |
|---|---|---|---|
| Variation Swatches for WooCommerce, by GetWooPlugins, and its Pro | `product_attribute_color`, with `is_dual_color` and `secondary_color` | `product_attribute_image` | |
| Variation Swatches for WooCommerce, by RadiusTheme | as GetWooPlugins (a second colour is its Pro's) | as GetWooPlugins | |
| Variation Swatches for WooCommerce, by CartFlows | `cfvsw_color` | `cfvsw_image` (an address) | |
| Variation Swatches for WooCommerce, by Woosuite | `color` | `image` | `label` |
| WCBoost - Variation Swatches | `swatches_color` | `swatches_image` | `swatches_label` |
| WPC Variation Swatches | `wpcvs_color` | `wpcvs_image` | `wpcvs_button` |
| Variation Swatches and Photos, of WooCommerce.com | `{taxonomy}_swatches_id_color`, when `{taxonomy}_swatches_id_type` is `color` | `{taxonomy}_swatches_id_photo`, when it is `photo` | |
| Kadence Shop Kit | `_kt_woo_extras_swatch_color` (or the option `kt_woo_extras_tax_swatch_type` of older releases) | `_kt_woo_extras_swatch_image` | |
| Choosly - Product Variations Swatches, by VillaTheme | `vi_wpvs_terms_params` `color`, one or two | `vi_wpvs_terms_params` `img_id` | |
| Product Variation Swatches, by ThemeHigh | `product_{taxonomy}` | `product_{taxonomy}` | `product_{taxonomy}` |
| YITH WooCommerce Color, Image & Label Variation Swatches | `_yith_wccl_value` | `_yith_wccl_value` | `_yith_wccl_value` |
| Flatsome | `ux_color`, one or two | `ux_image` | `ux_label` |
| Porto, with Porto Functionality | `color_value` | `image_value` | `label_value` |
| WoodMart, while it is the theme | `color` | `image` | |

An image may be an attachment's id, which gives its thumbnail, or an address. `color`, `image` and `label`, and the other names that are plain or whose meaning is the attribute's type (Woosuite's, WCBoost's, Porto's, ThemeHigh's and YITH's), count only on an attribute of a swatch type (`color`, `colorpicker`, `image`, `label`, `button`, or Flatsome's `ux_color`, `ux_image`, `ux_label`); WoodMart gives an attribute no type of its own, so its `color` and `image` count while `get_template()` is `woodmart`. XStore keeps its swatches in its own core plugin, which this list does not read. A term the plugin has translated without its swatch has none on that language's page.

**The category filter** is set on the Search Config tab (`category_filter`: `all`, `main` or `nested`; `category_filter_depth`; `category_filter_order`: `shop`, `name` or `count`). `Facet_Config` then hands the `categories` filter a `tree`, the levels to show and each category's parent by name, read from `product_cat` and `category`, and `arrangeTree()` in `src/utils/facets.js` draws it. A search answers with names, so two categories of one name are one value, a main one if either is. The WooCommerce mapping writes every ancestor of a product's categories (`Term_Names::for_post()` with `$with_ancestors`), so picking a main category finds the products in its subcategories. A field mapped from a hierarchical taxonomy, such as `taxonomy:category`, sends the parents of the terms the post carries too (`Field_Source_Resolver::resolve_taxonomy()`); a flat one, such as the tags, sends the terms alone. The category filter is every field of `Index_Config::category_fields()`: `categories`, and any field a mapping writes from `product_cat` or `category`, each with the tree and the order of its own taxonomy.

The same categories go as paths in `category_paths` (`Term_Paths::for_post()`: each level of each category from the top, joined by `" > "`, a `>` that stands alone in a name written as `›`). Searcio reads a facet field whose name ends in `_paths` as a tree (search-cloud #195): each path is its own value with its own count, `/search` gives each value its `label` and `parent` and returns all of a field's values (up to 1000), and `filter[category_paths][]=A > B` finds everything filed under *A > B*. When `category_paths` is a facet field and the filter is a tree, `Facet_Config` hands it `tree: { depth, paths: true }`, and `arrangeTree()` reads each value's parent from the value; `categories` is then `hidden`, a facet field the quizzes and rules keep using that `extractFieldFacets()` leaves out of the window. In one list it is the other way round: `categories` is drawn and `category_paths` is `hidden`. A post type writes paths too when its mapping sends a hierarchical taxonomy as `categories` (`Index_Config::category_paths_taxonomy()`).

The category filter's values are sorted before `arrangeTree()` places them, so siblings keep that order (`sortCategoryValues()`). With `shop`, the facet carries `valuesOrder`, its values as the shop sorted them: `get_terms()` with `orderby: menu_order`, which WooCommerce reads from the term meta its drag-and-drop writes, walked as a tree, each main category followed by what is under it. A value it does not list comes after the ones it does, by count.

- **`searcio_storefront_is_preview`** - `(bool $is_preview)`. Whether the page is a page builder's editor, whose searches Searcio meters but keeps out of the site's statistics. The plugin knows Elementor, Divi, Beaver Builder, Oxygen, WPBakery's frontend editor and Bricks by their editor's address, and the Customizer; return `true` for another editor:

  ```php
  add_filter( 'searcio_storefront_is_preview', function ( $is_preview ) {
      return $is_preview || isset( $_GET['my_builder_edit'] );
  } );
  ```

- **`woocommerce_product_is_visible`** - WooCommerce's own filter, `(bool $visible, int $product_id)`, is also applied when a product mapping has "Only index published, visible products" on. The value it receives is whether WooCommerce's search would list the product (`Woo::is_visible_product()`), not whether the shop would, and a callback runs where the sync runs - WP-Cron, WP-CLI or REST - so `is_search()` is false and there is usually no logged-in user. Return `false` to keep a product out of the index.
- **`searcio_sync_tick_budget`** - `(int $budget)`. How many seconds one tick of a full sync may run, checked between batches, 20 by default. Lower it where PHP's execution limit is shorter, so a tick ends before it is stopped.

## Testing

There are two PHP suites, the JS unit suite, and a Playwright end-to-end suite:

```bash
composer test:unit          # PHPUnit - fast, DB-free pure-logic classes (tests/Unit)
npm run test:integration    # PHPUnit - real WordPress + database via wp-env (tests/Integration)
npm run test:js             # Jest, through `wp-scripts test-unit-jest` - JS utilities and components rendered in jsdom
npm run test:e2e            # Playwright - real browser, desktop + mobile (tests/e2e)
```

The **unit suite** (`tests/Unit`, `phpunit.xml.dist`) is intentionally scoped to pure logic - enums, DTOs, response/state normalization, dirty-tracking, multilingual provider resolution, term names, field sources, style tokens, theme presets and the trigger markup - plus the release tests in `tests/Unit/Release` (`Brand_Test`, `Legal_Links_Test`, `Package_Test`, `Text_Domain_Test`, `Translations_Test`, `Version_Test`), which read the repository's own files: the name, the legal links, what the package holds, the text domain, every translation, and the version and the WordPress, PHP and WooCommerce the plugin asks for, wherever they are written. The storefront's helpers (currency, facets, languages, card templates, the request cache, recent searches) and the admin's (the Search Config and Placement tabs, the look editor, the quiz editor and its picture) are Jest tests. `tests/bootstrap.php` polyfills a small, explicit set of WordPress functions (translation no-ops, post-meta as an in-memory store, a minimal filter registry, `WP_Post`/`WP_Error` stand-ins) rather than loading all of WordPress, so it stays fast and needs no database.

The **integration suite** (`tests/Integration`, `phpunit-integration.xml.dist`) boots a real WordPress and database through `wp-phpunit` and runs inside the wp-env `tests-cli` container. It covers the WordPress-runtime layer the unit suite can't reach: activation and custom-table creation (`Activation_Test`), the resumable full-sync engine start→tick→complete/pause/cancel workflow with the Searcio HTTP layer faked out (`Sync_Workflow_Test`), the sync control surface - including the "stuck in Running" recovery when the tick worker is dead (`Sync_Control_Test`) - what a run does when the index does not take a batch: wait, try again, give up, and never stand in the way of the changes or of the next scheduled sync (`Sync_Retry_Test`), what it does for an account Searcio does not serve: stop at once and say why (`Sync\Account_Refusal_Sync_Test`), Site Health's report of the same (`Health\Connection_Reachable_Test`), `sync run` waiting for each next try and ending with an error when the sync was given up (`WP_CLI\Sync_Command_Test`, against a stand-in for the `WP_CLI` class), the `sync/*` REST routes' capability split and payloads (`Sync_Endpoint_Test`), the block editor render (`Frontend\Block_Render_Test`), when a page receives the storefront bundle (`Frontend\Storefront_Entry_Test`), what the plugin does while it boots (`Lifecycle\Boot_Test`), the Elementor widget registration and contract (`Elementor\Widgets_Test`), WooCommerce product indexing against real product objects (`Indexing\Woo_Test`), the Placement tab's settings and what WordPress does with them (`Frontend\Site_Placement_Test`, `Frontend\Placement_Shortcode_Test`, `Frontend\Classic_Widgets_Test`, `Frontend\Placement_Strings_Test`, `Routing\Placement_Endpoint_Test`), the look editor's settings, CSS and preview (`Frontend\Look_Test`), the storefront's filters and swatches (`Frontend\Storefront_Facets_Test`, `Indexing\Swatch_Reader_Test`), the Product finder tab's routes and what they send Searcio (`Routing\Quizzes_Endpoint_Test`), the Media Library on the settings screen (`Admin\Settings_Page_Test`), the translation each German locale reads and the one that stands in for a locale without its own (`Compatibility\Translation_Fallback_Test`), and names WordPress keeps escaped (`Indexing\Escaped_Labels_Test`).

The Elementor and WooCommerce suites need those plugins loaded. `.wp-env.json` installs both, and `tests/Integration/bootstrap-extra.php` loads their main files on `muplugins_loaded` and creates WooCommerce's tables on `setup_theme`. That file is the plugin's own; `tests/Integration/bootstrap.php`, which requires it, is the framework's and is refreshed by `composer framework:update`. Both plugins are optional - the two suites skip themselves when they are absent (e.g. a bare host run), so the rest of the integration suite still runs. The same suite runs again as a network with `npm run test:integration:multisite`.

```bash
npm run wp-env -- start     # boot the Docker environment first
npm run test:integration    # unit + integration together: npm run test:php
```

Both PHP suites run in CI (`.github/workflows/run-tests.yml`): the unit suite across the full PHP × WordPress compatibility matrix (8.3/8.4 × latest/6.8), and the integration suite, single site and multisite, on WordPress `latest` only - the `wp-phpunit` test framework targets current WordPress. Because of that gating, the CI "latest" leg installs current Elementor + WooCommerce while the "6.8" leg, the oldest WordPress the plugin supports, installs the plugin alone: it runs the unit suite only, and current WooCommerce (which needs WP 6.9+) would abort `wp-env start` there. If the integration suite is ever extended to the 6.8 leg, pin a WooCommerce release that still supports it.

The **end-to-end suite** (`tests/e2e`, `playwright.config.js`) drives the real, built front-end in a browser via Playwright and `@wordpress/scripts test-playwright`. Every spec runs twice - a desktop and a mobile (`Pixel 5`) project - so the search modal is proven in both layouts. The hosted Searcio API is never contacted: `mockSearchCloud()` (`tests/e2e/utils.js`) intercepts every `…/api/v1/*` request with deterministic, CORS-headed responses, and `configureSearchKey()` sets the plugin's public key so the front end runs a real query instead of degrading to native `?s=` search. Coverage spans opening the modal from both trigger styles, running a query and rendering result cards, the no-results and API-error fallback, type facets, the filter bar with its popovers, drawer and sheets (`filter-bar.spec.js`; `setFacetFields()` sets the copy of Search Config's facet order), the pre-query browse state (highlights / popular / recent), focus and keyboard behaviour, responsive layout, the unconfigured fallback, cards designed in Searcio drawn from a template shaped like the service's compiler output (`server-cards.spec.js` - the unit tests read that markup through jsdom, which accepts selectors a browser refuses), the storefront on a site whose kit and stylesheet style every element (`site-styles.spec.js`), the carousel in a page written right to left (`right-to-left.spec.js`; `rightToLeft()` serves the page as WordPress does on such a site, since the test site has no such language), what the Sync tab says about a run that is waiting to try again and about one that is paused (`sync-tab.spec.js`, on a mocked `/sync/status`), the Placement tab and each way it places the search on a page (`placement.spec.js`), the look editor (`look-editor.spec.js`), the Search Config tab with its Any/All choice per facet field (`search-config-tab.spec.js`), the Product finder tab's list, editor, picture and endings (`quizzes-tab.spec.js`), the full-screen window and results grid on a phone (`responsive.spec.js`), what each search tells Searcio (`search-analytics.spec.js`), and an Elementor smoke test that skips when Elementor is not active.

```bash
npm run build               # E2E drives the built bundle, so build first
npm run wp-env -- start
npm run test:e2e            # both projects; test:e2e:desktop for desktop only
```

E2E needs a browser (`npx playwright install chromium`) and the built assets, and runs on WordPress `latest` with Elementor + WooCommerce in its own CI job. It targets the wp-env tests site (`http://localhost:8889`); set `WP_BASE_URL` to point it elsewhere (e.g. the dev site on `:8888`).

Add or update the narrowest useful test for every behavior change. `npm run build` after any JavaScript, block, or admin UI change, followed by a manual check in a real browser (desktop and mobile widths, keyboard focus, no horizontal overflow).

## Translations

Text domain: `searcio`, the plugin's slug on wordpress.org, which installs it in a `searcio/` folder, knows it by its main file `searcio.php`, shows its page at https://wordpress.org/plugins/searcio/ and files its translations under that name. Every other name follows the same slug, the `PLUGIN_SLUG` constant of the main file: the hook prefix, the cache group, the options, the tables, the capabilities, the asset handles, the admin page, the REST namespace, the blocks and the WP-CLI command. The `TEXT_DOMAIN` constant of `searcio.php` sets it, and the framework does the rest: its `get_text_domain()` returns `searcio`, it names the lifecycle keys after the slug (`searcio_lifecycle_state`), so a site that ran an earlier release does not look new, and it loads `languages/` from the folder the plugin is installed in. `Plugin` overrides none of it. `Domain Path: /languages` in the main plugin header. The plugin ships German in every locale WordPress has for it, each in the form of address WordPress uses there: `de_DE` and `de_AT` say *du*, `de_DE_formal` ("Deutsch (Sie)") says *Sie*, and the Swiss ones write ss for ß, `de_CH` with *Sie* and `de_CH_informal` with *du*; a string added to `de_DE` is added to the other four in their form. It also ships French (`fr_FR`), Spanish (`es_ES`), Italian (`it_IT`) and Polish (`pl_PL`); `tests/Unit/Release/Translations_Test.php` reads each PO file against the template (placeholders, HTML tags, plural forms, no dash, the header, a compiled MO and script translations per bundle). WordPress loads a plugin's translation for the exact locale and no other, so the framework's `Support\Translation_Fallback`, attached as the plugin boots, stands the language's main locale in for a locale of the plugin's languages it has no file for (`fr_CA` and `fr_BE` read `fr_FR`, every `es_*` but `es_ES` reads `es_ES`), for PHP on `load_translation_file` and for the scripts on `load_script_translation_file`. It touches only files of the plugin's own `languages/` folder, and a WordPress.org language pack for the exact locale in `wp-content/languages/plugins` still comes first. `languages/script-translation-map.json` maps JS source files to their built bundle for `wp i18n make-json`.

```bash
wp i18n make-pot . languages/searcio.pot --domain=searcio --slug=searcio --exclude=.agents,.claude,.codex,tests,docs,node_modules,vendor,public,languages,includes/Dependencies,includes/classes
wp i18n make-mo languages languages
wp i18n make-json languages languages --no-purge --use-map=languages/script-translation-map.json
```

A new string goes into each PO file with its translation, the POT's `#:` lines on top: `make-json` files a string in the bundle its PO entry names. `--no-purge` keeps the strings of the scripts in the PO files, which `make-json` takes out of them otherwise; compare each JSON's message keys with the committed one afterwards.

Rules of thumb:

- Every string sent to the browser via `wp_localize_script()` / inline script data must be wrapped in `__()` at the PHP call site - a raw literal there bypasses gettext entirely, even though it renders identically to a wrapped string in English until a second locale is tested.
- `#[Setting(label:..., description:...)]` values can never be `__()`-wrapped - see "Settings" above for the established workaround.
- A number in the React admin goes through `formatNumber()` (`src/utils/number.js`) and a date through `dateI18n()` from `@wordpress/date`, never through a bare `toLocaleString()`. That one follows the browser, which is often set to another language than the user's WordPress profile, and the sentence around the number is in the profile's. The end-to-end suite runs in `en-US`, the one browser that cannot show the difference: a spec about it sets `test.use( { locale: 'fa-IR' } )`.
- If your `wp` CLI has no `i18n-command` package installed, run the same commands through a full `wp-cli.phar` instead (`php /path/to/wp-cli.phar i18n ...`). If `make-pot` fails on an SSL error fetching WordPress core's `block-i18n.json`, pass a current CA bundle explicitly (`-d curl.cainfo="<path>"`) rather than editing global PHP config.
- `make-pot` takes the plugin's slug from the name of the directory it runs in, and writes it into the template's `Report-Msgid-Bugs-To`. The checkout is not named `searcio`, so always pass `--slug=searcio`.
- Don't trust `wp i18n update-po` to preserve every existing translation when re-merging a PO file that already has `msgctxt`-scoped entries - verify with `msgfmt --check` after merging, and be ready to refill `msgstr` values from your own translation source of truth if entries came back empty.

## Branches

Work happens on the branch of the major version: `1.x` while the plugin is at 1.*. Every pull request is opened against it and merged into it. `master` holds what was released and takes nothing else: for a release, the version is bumped on `1.x` and `1.x` is merged into `master` with a pull request, and the GitHub release is tagged on that merge commit of `master`. A 2.0 gets its own branch, `2.x`, made from `master` the same way. The tests run on pull requests into `master` and into every `*.x` branch.

## Releasing

The version is written in the plugin header and the `VERSION` constant of `searcio.php`, in `Stable tag` and the first changelog block of `readme.txt`, in `CHANGELOG.md` (the `Unreleased` heading becomes the version), in `package.json` and twice in `package-lock.json`, in both `blocks/*/block.json` and in the translation template's `Project-Id-Version` (regenerate it). The README and `docs/installation.md` also repeat what the header asks for - the WordPress and PHP minimums; the README, `docs/installation.md` and `docs/faq.md` also name the WooCommerce the plugin asks for (`Woo::MIN_VERSION`). `tests/Unit/Release/Version_Test.php` compares all of them, so a place that was missed fails the unit suite. The README's badges read the version, the PHP, the *Tested up to* and the rating from the plugin's wordpress.org page and need no edit. None of this changes the build: `public/` comes out the same.

A release is a GitHub release on the merge commit of `master` that brought the version branch in (see **Branches**), tagged with the version (no `v`). Publishing it starts `.github/workflows/deploy.yml`, which puts it on wordpress.org and attaches the package to the release:

1. It runs the test suites (`run-tests.yml`) on the tag, and goes on only when they pass.
2. It checks that the tag, the plugin header's `Version` and the `Stable tag` of `readme.txt` are one version, that the tag is on `master`, and that wordpress.org has no such version yet.
3. It builds the package: the release build above, a copy of the tree without what `.distignore` and the workflow name, without `languages/*.po` and `*.pot`. It then checks that the package holds the plugin's files, its bundled dependencies and its build, and none of `vendor`, `composer.json`, `src` or `tests`.
4. [10up/action-wordpress-plugin-deploy](https://github.com/10up/action-wordpress-plugin-deploy), pinned to a commit, copies that package to SVN `trunk` and to `tags/<version>`, and `.wordpress-org` to `assets/`, in one commit. It then zips what it committed, with `searcio/` as its only root folder, the folder wordpress.org installs the plugin in.
5. That zip is attached to the release as `searcio-<version>.zip`, and its size and SHA-256 are in the run's summary.

The workflow needs the repository secrets `SVN_USERNAME` and `SVN_PASSWORD` (the SVN password made under *Account & Security* on the wordpress.org profile) besides `COMPOSER_AUTH`. Run by hand (`gh workflow run deploy.yml --ref <tag>`), it is a dry run unless told otherwise: it builds and checks the package, keeps the zip as a workflow artifact for seven days, and commits and uploads nothing. So push the tag first, run a dry run from it, and then publish the release on that tag. A release whose run failed is deployed by running it by hand from its tag with `dry-run` off. When the workflow cannot run at all, build the package the same way by hand, attach it to the release and commit it to SVN as the workflow does. Before publishing, install the zip on a clean WordPress with `WP_DEBUG` on and run Plugin Check against it as wordpress.org does:

```bash
wp plugin check searcio --error-severity=7 --warning-severity=6 --include-low-severity-errors --exclude-checks=prefixing --categories=plugin_repo
```

`includes/Dependencies` must hold `Webhead`, `League`, `Psr` and the prefixed `composer` autoloader, and nothing else.

The plugin has three names, each written in one place, and `scaffold:update` (`composer framework:update`) reads them from there, so a framework update leaves them as they are:

- **The display name** is the `Plugin Name` header of `searcio.php`.
- **The text domain**, `searcio`, is the `Text Domain` header and the `TEXT_DOMAIN` constant of `searcio.php`. It names the translations.
- **The slug**, `searcio`, is the `PLUGIN_SLUG` constant of `searcio.php`. Options, tables, capabilities, hooks, the REST namespace, the blocks, the Elementor widgets, the classic widgets, the WP-CLI command and the admin page are named after it. Sites hold their data under it, so it does not change again.

A new name goes through `vendor/bin/webhead scaffold:rename` (`wh-plugin rename`), never by hand: `--name` for the display name. The folder of the release zip is `searcio`.

To update the framework:

1. `composer update webhead/wp-plugin-framework -W`. Mozart rebuilds `includes/Dependencies` and `bundle:prune` runs after it.
2. `composer framework:update`, and read the diff of every managed file.
3. Do what the update says: when the `@wordpress/*` majors move, delete `package-lock.json` and `node_modules` and run `npm install`, then rename what it names and build.

`.wordpress-org` holds the plugin's page on wordpress.org: `icon.svg`, `icon-128x128.png` and `icon-256x256.png`, `banner-772x250.png` and `banner-1544x500.png`, and `screenshot-N.png`, numbered as the **Screenshots** section of `readme.txt` captions them. They go in the `assets/` folder of the wordpress.org SVN repository with every release (`deploy.yml`), never in the plugin: `.distignore` leaves every hidden folder out of the package. A screenshot that is added, removed or reordered changes its caption in `readme.txt` in the same change.

## Contributing

1. Branch from `1.x` and open the pull request against `1.x`, never against `master` (see **Branches**).
2. Identify the affected public contracts first: settings option keys, REST routes, capability names, table names - these are stable identifiers, not internal details.
3. Implement inside the existing framework patterns (settings via `Plugin_Settings`, REST via the framework's `Rest_API` base class, tables via `Database_Manager`/`Table`) rather than a parallel system.
4. Add or update the narrowest useful test in the same change.
5. Run `php -l` on changed PHP files, `composer test:unit`, `npm run test:js`, and `npm run build`.
6. Update this documentation (and `CHANGELOG.md`) when the developer-facing contract changes.
