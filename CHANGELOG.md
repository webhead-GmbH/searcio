# Changelog

All notable changes to Searcio are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The plugin's page on WordPress.org carries the same release notes in shorter form.

## [1.4.1] - Unreleased

### Security

- Password-protected posts and pages are no longer indexed unless "Also index private & password-protected items" is turned on. Content of this kind that is already in the index is removed during the update.
- The connection test no longer sends the public search key from the server. The settings screen checks the key from the browser, the same way a storefront page uses it, because a search key now only works on the site it was connected from.

### Added

- **Profitable products first.** The purchase price of each product can be sent for Searcio's profit ranking (Indexing tab, Product details, "Purchase price, for profit ranking"). It is read from WooCommerce's Cost of goods, or from the meta field of a cost of goods plugin, is entered without tax (where the shop shows prices with tax, Searcio adds it, so the margin comes out the same), is the cheapest variation's for a variable product, and is never shown to shoppers. The ranking itself (strength, target margin, minimum profit per sale, per-category or per-brand targets, excluded search terms) can be set on the Search Config tab. It warns when the ranking is on while products are indexed without a purchase price, and when a target names a field that no product has.
- Filters on product attributes can match a single variation that is in stock, so "red" and "XL" no longer find a jacket whose red XL is sold out (Search Config, "Attributes one variation must match"). Variable products now send their variations with their attributes and stock status.
- Custom fields that hold numbers can be filtered as a range from and to (Search Config, "Fields that hold numbers").
- The category filter tells apart categories that share a name under different parents, and lists categories in the order set in WooCommerce, by name, or by number of products.
- WooCommerce brands can be indexed and offered as a filter of their own.
- Attributes that a product defines for itself can be indexed.
- The title, text, link and image of a result can come from a custom field, such as an ACF field. An image field that stores an attachment ID is sent as the image's address.
- A merchandising rule can fire only when the search term is exactly its trigger.
- On multilingual sites, a search redirect can be limited to one language.
- Card templates designed in Searcio are requested in the language of the page.
- The Search Config tab offers the profit ranking's switch for listings without a search term (a category page, the highlights) once Searcio reports it, and Searcio then counts the least profit per sale without tax: where the shop shows prices with tax, the price without tax is sent beside the purchase price.
- The Connection tab warns when Searcio says the search index of the site is empty although documents were sent.
- The names the shop gives its fields (an attribute's, a taxonomy's) are sent to Searcio, so that its dashboard lists the fields as the shop does. They go beside the settings, when they differ, and on the daily sync.
- The Sync tab says when a running sync has not moved for ten minutes because WP-Cron does not run it, and runs its next step on a click. Site Health lists a task of the plugin that is overdue.
- A new quiz starts in the language the admin works in, where it started in "Every language".
- Developers: the `searcio_is_indexable` filter keeps individual posts out of the index.

### Changed

- Tested up to WooCommerce 11.3. The plugin header declares the supported WooCommerce versions (`WC requires at least: 8.0`, `WC tested up to: 11.3`), and the plugin declares its compatibility with WooCommerce's order storage (HPOS), the Cart and Checkout blocks and Cost of goods, so WooCommerce reports it as compatible.
- Saving the Indexing tab starts a sync that sends only the content the change affects.
- Changing WooCommerce's "Hide out of stock items" or the indexed languages starts a sync.
- Every merchandising rule that matches a search now applies, in list order, instead of only the first one.
- The Search Config tab reads the current settings from Searcio each time it opens, and does not overwrite settings that were changed in the Searcio dashboard in the meantime.
- The "newest" highlights are sorted by publication date. Every document now carries its publication date, so the next sync sends all documents once.
- On shops, the highlights, product rows, the product finder, similar products and photo search show products only.
- On multilingual sites without a language selection, each page searches in its own language. A page in a language that is not indexed falls back to WordPress search in that language.
- WooCommerce's cart, checkout, account and shop pages are no longer indexed, and are removed from the index during the update.
- Products are sent with WooCommerce's own product type, so grouped and external products are no longer reported as simple products.
- Searcio's sync history now tells incremental updates apart from full syncs.
- The "Only index published, visible products" setting is now called "Respect catalog visibility", which describes what it does.
- With a search by meaning, the results heading reads "20 of about 173 results" and the type buttons show their counts, where it read "20 results" over 173.
- The comparison table is of the first four products, and leaves out the publication timestamp and a field that stands beside its own plural ("Category" and "Categories").
- The placeholder image of a card made from a Searcio template is smaller and lighter, like the plugin's own.
- The German word for a product on backorder is WooCommerce's own, "Lieferrückstand".
- A setting of the Placement tab that takes one of a few values, such as the animation, refuses another with a message instead of saving the value it already had.
- A page with a search button loads 10 scripts and about 1.2 MB less JavaScript. The search window no longer loads WordPress's component library with the date library, the rich-text editor and the data layer behind it: what Searcio adds to a page fell from 27 scripts (1.5 MB, 488 KB compressed) to 17 (0.35 MB, 122 KB). On a phone with the processor slowed fourfold the script time Searcio adds fell from about 1.9 s to 0.3 s, and the window opens in about half the time. It looks and works as before.
- The batches of a full sync name their run, so that Searcio's sync history shows one row for the run, not one for each post type and batch.
- The Sync history's search also finds a run by its status or by what started it, and a run started by a settings change is named so.
- The Search Config tab asks to wait a few minutes before changing the fields that hold numbers, or the attributes one variation must match, again, because each change rebuilds the search index.
- On tablets in portrait orientation, results are shown as a grid. The floating search button stays clear of bars fixed to the bottom of the screen, and the "All" filter is available on phones again.

### Fixed

- A change to a variation's price, stock or purchase price, to the purchase price field of a cost of goods plugin, or a variation that is added or removed, reaches the search index with the next incremental sync. Before, only a change to the product itself did, so a variable product kept its old purchase price and price.
- The profit ranking card words its own errors, in the language of the screen, instead of repeating the key names and messages Searcio returns. A message appears under the target it belongs to even when an empty row sits above it, and values outside their range are caught before the card is saved.
- The highlights show the newest products when Searcio refuses the featured filter, as it does when the plugin's copy of the filters is older than the dashboard's, where the row stayed empty.
- The boost of a type no content has any more, such as the old name of a type renamed on the Indexing tab, is marked and can be removed, where it stayed as a row that moved no result.
- The time a sync run was last updated is in UTC like its other times, where it was an hour ahead in a shop in Vienna.
- A negative number of days to keep the sync history for is refused with a message that says what to enter, and a search key that is not one is said so as it is typed.
- A content type renamed on the Indexing tab works in blocks, shortcodes, widgets, placements and type boosts, and its result cards show their text.
- The category filter modes work for post categories, and a post filed under a subcategory is found when filtering by its parent category.
- Filters set to "All (AND)" update their counts after every selection.
- The synonyms field accepts a new line for each group.
- Sites without a shop no longer request featured products, and the search window no longer refers to a shop there.
- A variable product on sale shows its regular price struck through.
- A quiz published on the Product finder tab appears on the next page load instead of minutes later.
- Product rows set to Searcio templates use them, and cards designed in Searcio look the same on the site as in the Searcio editor.
- The comparison table no longer lists internal fields, and products on backorder are labelled as such.
- An invalid search key is refused when saved and reported by "Test connection". Keys entered by hand are checked again as soon as they are saved.
- Product rows accept the product ID that WordPress shows, and the Elementor editor explains why a row is empty.
- Product finder answers are labelled with their question, and the quiz editor marks questions that no answer leads to.
- "Clear cache" only clears the plugin's own files from the PHP opcode cache.
- Elementor no longer lists the Searcio widgets twice.
- After a shop disconnects and connects again, or enters the keys of another Searcio account, the next sync sends every document. Before, it skipped them as unchanged and ended "completed" over an empty index.
- With Polylang, a language given to a post without saving it (a bulk change, the wizard for content from before Polylang, linking translations) reaches the search index with the next incremental sync, where it waited for the daily one.
- A screen of the plugin no longer waits through three tries for a Searcio that does not answer: the Connection and Search Config tabs say so after 15 seconds, where the request was held for 51, longer than the time limit of many hosts, which showed a server error.
- Deleting the plugin's data on uninstall also removes the options WordPress keeps for its two classic widgets.
- Smaller fixes: error messages on the Search Config tab in the language of the screen, a warning for a redirect term entered twice, a working search in the sync history, retention days that cannot be negative, a wider search field on phones, and sync times stored in UTC.

## [1.4.0] - 2026-11-09

### Added

- A Product finder tab to create, edit, publish and delete quizzes in WordPress. Question images come from the Media Library, answers offer the values the filters actually have, and every path through a quiz is checked for results before it is published.
- Quiz answers can require words that products must contain, or a price range.
- A Placement tab to use Searcio with any theme or page builder: take over the theme's search forms, open the search from the theme's own search icon, add a floating search button or a keyboard shortcut, or place it with the `[searcio]` and `[searcio_products]` shortcodes, the classic widgets, a menu item or a link to `#searcio`. Every option is off until it is turned on.
- A look editor on the Placement tab with the style settings of the Elementor widget, per device, with a live preview.
- Search Config: filters can match all selected values (AND) instead of any (OR), searches can be excluded from popular searches, and the category filter can show all categories, the main categories only, or the main categories with their subcategories.
- Filters show the swatches set up in a swatches plugin or theme: images, two-colour values and short labels as well as colours.
- A "Search statistics" link in the settings header and on the Connection tab.
- The Connection tab and Site Health report an account without an active plan, with an overdue payment or that is suspended, with a link to resolve it.
- German for every locale WordPress offers (formal and informal, Austria, Switzerland), and regional variants of French, Spanish, Italian and Polish.
- Developers: the `searcio_storefront_facet_display`, `searcio_storefront_facet_colors`, `searcio_storefront_facet_images` and `searcio_storefront_is_preview` filters.

### Changed

- The plugin's settings page, blocks, widgets, hooks, options and REST namespace are all named `searcio`. The settings page is at `admin.php?page=searcio`.
- The search window's filters are one bar under the search field. Each filter opens in a popover, or in a sheet on phones, and "All filters" shows them all.
- On phones, the search window fills the screen, results scroll in a grid, and the AI assistant has its message field at the bottom.
- The Search button next to the search field was removed: Enter searches, and the phone keyboard shows a Search key.
- The AI shopping assistant shows its reply as it is written and the products as soon as they are found, numbers its suggestions, and writes prices in the shop's currency.
- On multilingual shops, quizzes, popular searches, suggestions, photo search, similar products and the assistant's products follow the language of the page. A merchandising rule can be limited to one language.
- Saving the Search Config tab only sends the settings that were changed.
- Searches and the search window are faster: unused work is skipped, the connection to Searcio is opened early, and what the window shows before typing is prepared in advance and kept for the visit.
- The settings tabs open at once: data read from Searcio is kept for a few minutes and refreshed after every save.
- Support Searcio, the small logo in the search window, is off unless it is turned on.
- Settings messages appear as WordPress notices, and the previews show a placeholder while they load.
- Styles of blocks, shortcodes, widgets and the floating button are added through WordPress's stylesheet queue.
- The search window's stylesheet is a third of its previous size.
- Updated the webhead plugin framework to 1.11.0.

### Fixed

- The search window opens below the WordPress toolbar for logged-in users.
- Filter values that contain a comma find their products.
- Text in neighbouring paragraphs, headings and list items is indexed as separate words.
- Ctrl+K and Cmd+K open the search with keyboard layouts without Latin letters.
- Names with an "&" are shown as typed instead of as "&amp;".
- A theme that styles WooCommerce block buttons no longer turns the search window's icons white.

### Security

- The address Searcio calls to confirm site ownership answers only to the one-time code sent by the connection request, and only once.

## [1.3.1] - 2026-10-19

### Changed

- The plugin's main file is now `searcio.php`. After updating from 1.3.0, activate the plugin again under Plugins; settings, sync history and the connection are kept.
- The plugin is called Searcio throughout the admin, the blocks, the Elementor widgets, Site Health and the translations.
- The plugin's link in the plugin list goes to its page on WordPress.org.

### Fixed

- Search result excerpts end at a whole word.
- The product finder counts only the questions on the visitor's own path.
- Spacing of the search block's size controls, alignment of the AI search status and of the photo search button, and the names of type boosts.

## [1.3.0] - 2026-10-19

### Added

- Support Searcio: an optional small logo in the search window.
- French, Spanish, Italian and Polish translations, a complete German translation, and German for Austria and Switzerland.

### Changed

- The plugin's slug and text domain are `searcio`, and it installs into a `searcio/` folder. A site with an earlier release in a different folder should deactivate and delete that copy before installing this one; settings, sync history and the connection are kept.
- The admin menu and the settings header show the Searcio logo.

## [1.2.2] - 2026-10-14

### Fixed

- Every price in the search is the price the shop displays, with or without tax as set in WooCommerce, for simple, variable and grouped products alike. Run a sync after updating, or wait for the daily one.
- Prices are the same whoever runs the sync, including syncs started from WP-CLI.

## [1.2.1] - 2026-10-11

### Changed

- The confirmation before disconnecting explains that the site and its search index are deleted on Searcio.
- Numbers and dates on the settings screen follow the language of the user's profile and the site's date format and time zone.
- The plugin package no longer contains a `vendor` folder or `composer.json`.
- Updated the webhead plugin framework to 1.5.0.

### Fixed

- The settings header no longer flickers.
- The legal links on the Connection tab lead to searcio.com when the service cannot be reached.

## [1.2.0] - 2026-10-06

### Added

- The arrow keys move through search suggestions, and Enter searches for the selected one.

### Changed

- Requires WordPress 6.8 or later.
- A sync that cannot reach the service stays running and retries the same batch after 1, 2, 5, 10, 15 and 30 minutes before it fails. The daily sync resumes a paused sync.
- The WP-CLI command `sync run` retries like the background sync and exits with an error when the sync did not complete.
- The search window keeps its look on sites whose theme or Elementor kit styles every element. Custom rules on `.whsc-*` elements now need `!important`; the `--whsc-*` properties work as before.
- The settings screen uses WordPress's current components, explains why a screen could not load, reports failed saves next to the save button, and asks for confirmation before destructive actions.
- The Elementor widgets have their own category in the editor panel.
- REST routes describe their parameters and refuse values of the wrong shape with a 400 response.
- Updated the webhead plugin framework to 1.4.0.

### Fixed

- A sync that met an error no longer stays paused until it is resumed by hand.
- Result cards designed in Searcio are drawn again, as the Searcio editor draws them.
- Links in AI assistant replies are shown as links.
- The results carousel works in right-to-left languages.
- Keyboard focus rings are drawn completely on chips, cards and the compare table.
- A page without a search trigger no longer runs a database query or loads translations.

## [1.1.0] - 2026-09-30

### Added

- Search by photo.
- A guided quiz (product finder) that turns a few questions into a filtered search.
- A row of similar products for product pages, and a curated category listing.
- Search-term redirects.
- Range filters for price and other numeric facet fields.
- A "Load more" button for further results.
- Plan usage on the Connection tab.
- Merchandising rules for category listings, with their banner shown above the results.
- Style settings for the photo button, the quiz, stock labels and many more parts of the Elementor widget, which can also keep its search window open while editing.

### Changed

- Products are indexed with their parent categories, so filtering by a parent category finds products in its subcategories.
- Renaming, moving or deleting a category updates its products without a manual sync.
- The search service moved to https://searcio.com; existing keys keep working.
- Accessibility: visible focus rings throughout the search window, reduced motion respected, focus management in the quiz, and better behaviour on small and touch screens.
- Tested up to WordPress 7.1.

### Fixed

- Products set to "Search results only" are indexed, and "Shop only" products are not.
- Content that should no longer be searchable is removed by full syncs, including after a failed removal.
- The AI assistant no longer breaks after a long reply.
- A failed search-as-you-type request no longer navigates away.
- Saving Search Config no longer deletes boosts for content types the site does not index, and a switch left on after a plan downgrade no longer blocks saving.
- Clearing the write key field no longer erases the saved key.
- Category, tag and attribute names no longer show HTML entities.

### Security

- The domain verification endpoint no longer returns the site's write key to unauthenticated callers.
- The write key and secret are no longer sent to the browser.

## [1.0.4] - 2026-07-27

### Fixed

- AI assistant answers render their formatting instead of raw Markdown.
- The comparison table no longer shows internal fields, duplicate rows or raw values.
- Turning on the AI assistant no longer restyles the search tab.

## [1.0.3] - 2026-07-27

### Added

- A border-radius setting for the AI assistant's message field, and style settings for the assistant tab.
- Search Config manages merchandising rules and the AI search, visual tagging and click ranking switches.
- Developers: the `searcio_sync_tick_budget` filter sets how long a sync step may run.

### Changed

- Smaller package and faster front end: unused bundled tooling was removed.
- Sync steps are limited by time as well as batch size.

### Fixed

- The search window and AI assistant are translated on translated sites.
- Click tracking records clicks.
- A sync interrupted mid-step no longer stays stuck, and the scheduled sync revives it.
- Documents that cannot be removed from the index are reported, and incremental syncs record why they failed.
- Sync history retention deletes old runs.

## [1.0.2] - 2026-07-14

### Security

- Result cards designed in Searcio escape every field value and strip unsafe link schemes.
- The domain verification endpoint requires the token the service sends.
- Protected meta keys (starting with an underscore) are no longer indexed through a custom field mapping by default. Developers can allow a key with the `searcio_index_allow_protected_meta` filter.

## [1.0.1] - 2026-07-12

### Fixed

- A sync whose background worker stopped no longer stays on "Running"; pause, resume and cancel recover it.

## [1.0.0] - 2026-07-07

### Added

- Initial release: field mapping per content type and a resumable, batched sync (full, scheduled and incremental).
- A full-screen search window as a block and an Elementor widget, with search as you type, suggestions, filters, recent and popular searches and a highlights carousel.
- Result cards designed in Searcio as an alternative to the built-in cards.
- Search configuration (searchable fields and weights, type boosts, filters, suggestions, synonyms) in the plugin's settings.
- Language restriction for indexing and search with WPML and Polylang.
- WP-CLI commands for running and monitoring syncs.

[1.4.1]: https://github.com/webhead-GmbH/searcio/compare/1.4.0...1.x
[1.4.0]: https://github.com/webhead-GmbH/searcio/compare/1.3.1...1.4.0
[1.3.1]: https://github.com/webhead-GmbH/searcio/compare/1.3.0...1.3.1
[1.3.0]: https://github.com/webhead-GmbH/searcio/compare/1.2.2...1.3.0
[1.2.2]: https://github.com/webhead-GmbH/searcio/compare/1.2.1...1.2.2
[1.2.1]: https://github.com/webhead-GmbH/searcio/compare/1.2.0...1.2.1
[1.2.0]: https://github.com/webhead-GmbH/searcio/compare/1.1.0...1.2.0
[1.1.0]: https://github.com/webhead-GmbH/searcio/compare/1.0.4...1.1.0
[1.0.4]: https://github.com/webhead-GmbH/searcio/compare/1.0.3...1.0.4
[1.0.3]: https://github.com/webhead-GmbH/searcio/compare/1.0.2...1.0.3
[1.0.2]: https://github.com/webhead-GmbH/searcio/compare/1.0.1...1.0.2
[1.0.1]: https://github.com/webhead-GmbH/searcio/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/webhead-GmbH/searcio/releases/tag/1.0.0
