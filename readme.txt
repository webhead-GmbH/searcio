=== webhead Search Cloud ===
Contributors: webheadgmbh, mohammad425
Tags: search, woocommerce
Requires at least: 6.8
Tested up to: 7.1
Requires PHP: 8.3
Stable tag: 1.2.2
License: GPL-3.0-or-later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Instant full-screen search for your posts, pages and products, powered by the hosted webhead Search Cloud service.

== Description ==

Connect WordPress and WooCommerce to `webhead Search Cloud` - a fast, hosted search service - and give visitors an instant, full-screen search experience for your posts, pages, and products.

The plugin indexes your content into Search Cloud, keeps it in sync as content changes, and renders a client-side search modal (via a Gutenberg block or an Elementor widget) that searches, filters, and displays results without a page reload.

### Key Features:
- **Full-screen search modal** - a fast, keyboard-friendly overlay with search-as-you-type, autocomplete suggestions,
  recent and popular searches, and an empty-state highlights carousel.
- **Faceted filtering** - filter results by content type and by any field you've configured as a facet (category, tags,
  and so on), with a minimum/maximum for numeric fields such as price or rating.
- **WooCommerce support** - indexes products with price, stock status, categories, tags, ratings, and variations; result
  cards show formatted prices, sale badges, and stock status.
- **Gutenberg block and Elementor widget** - the same search experience, fully themeable (colors, radius, typography,
  spacing) from either editor, with no code required.
- **Server-designed result cards** - optionally use card templates designed in the Search Cloud dashboard instead of the
  plugin's built-in card layout.
- **Configurable indexing** - choose which post types and WooCommerce products to index, and map custom fields,
  taxonomies, and built-in properties to searchable data.
- **Search relevance control** - tune searchable fields and weights, per-type ranking boosts, facet and suggestion
  fields, and synonyms - all from Search Cloud's own configuration, editable from the plugin's admin screen.
- **AI Assistant** - a chat tab that answers in prose and shows the products it is talking about, with a table to
  compare them.
- **Search by photo** - shoppers upload a photo instead of typing; a vision model describes it and searches for that.
- **Guided quiz** - a few questions that narrow the catalogue down for shoppers who know what they want but not what it is called.
- **Search redirects** - send well-known terms straight to a page instead of showing results.
- **Similar products** - a "you may also like" row on product pages, matched by meaning rather than by shared tags.
- **Category merchandising** - curate a category listing: pin products to the top, keep products out, show a banner.
- **Multilingual (WPML / Polylang)** - optionally restrict indexing and search to specific languages; visitors only see
  results in their current language.
- **Background sync** - a resumable, batched sync engine keeps your index up to date automatically, plus an incremental
  sync that pushes edits shortly after they happen. A sync that cannot reach Search Cloud tries again by itself. Full
  sync history, pause/resume/cancel controls, and retention settings are all available from the dashboard.
- **WP-CLI support** - run and monitor syncs from the command line for real system-cron setups.

== Installation ==

1. Install and activate the plugin like any other WordPress plugin.
2. Go to **Search Cloud** in the WordPress admin menu. A site that is not connected yet opens on the **Connection**
   tab.
3. Accept the terms and click **Connect to Search Cloud**. If you already have keys for this site, enter them under
   **Advanced: manual key entry** instead.
4. Open the **Indexing** tab and choose which content should be searchable.
5. Open the **Sync** tab and start your first sync.
6. Add the **Search Cloud** block to a page (or the **Search Cloud** widget in Elementor) to place the search trigger
   anywhere on your site.

== External services ==

This plugin sends data to webhead Search Cloud, the hosted service that powers the search. Search does not work without it.

* **When you connect:** the site's name and address, and the email address and name of the admin who connects. Search Cloud uses them to create your account, or to find the one you have.
* **When you sync:** the content you chose to index - for example a post's title, text and link.
* **When you save the Search Config tab:** the search configuration you set there - weights, filters, synonyms, merchandising rules and redirects - which Search Cloud stores and applies.
* **When a visitor searches:** the search term, and which result they open. Their browser contacts the service directly, so their IP address is visible to it.
* **When a visitor uses the AI Assistant** (off unless you turn it on): the message they type.
* **When a visitor searches by photo** (off unless you turn it on): the photo they upload.

Nothing else is sent, and no visitor accounts are created.

Service: https://searcio.com - Privacy policy: https://searcio.com/datenschutz

== Source code ==

The JavaScript in `public/` is built with webpack. The unminified source it is
built from lives in `src/` in the plugin's repository:

https://github.com/webhead-GmbH/webhead-search-cloud

To rebuild it, check the repository out and run `npm install` followed by
`npm run build`.

== Changelog ==

= 1.2.2 =
- Fixed simple products showing their price without tax in the search while variable products showed it with tax, in a shop that enters prices without tax and shows them with tax (and the other way round). Every price in the search is now the price your shop displays, with or without tax as set under WooCommerce > Settings > Tax > Display prices in the shop, and the price filter compares like with like. After updating, run a sync from the Sync tab, or wait for the daily one: it sends only the products whose price changes.
- Grouped products show the range of their children's prices, each child with its own tax class, as your shop shows it.
- The search prices are the same whoever runs the sync. A sync run with WP-CLI could price products for the address of the user it ran as.

= 1.2.1 =
- Fixed the words in the header of the settings screen flickering as they appear.
- The confirmation before disconnecting says what disconnecting does: Search Cloud removes the site and permanently deletes its search index, your shop uses WordPress's own search until you connect again and run a sync, and nothing in WordPress is deleted. It said that only the saved credentials are removed. The button that goes ahead now reads "Disconnect and delete the index".
- Numbers and dates on the settings screen follow the language of your WordPress profile instead of the language of your browser. A date in the sync history is shown in your site's date format and time zone.
- "How connecting works" names the link for another email address by its label, "Not this email?".
- The Terms of Service, Privacy Policy and Data Processing Agreement links on the Connection tab lead to the documents at searcio.com when Search Cloud cannot be reached. They led to an address that asks for a password.
- This readme says what connecting sends to Search Cloud, and what saving the Search Config tab sends.
- The plugin package no longer carries a `vendor` folder and a `composer.json`. The plugin loads its own files, and nothing changes in how it works.
- Updated the webhead plugin framework to 1.5.0.

= 1.2.0 =
- Requires WordPress 6.8 or newer, up from 6.0. A site on an older WordPress keeps the version it has.
- Fixed a sync that met an error staying paused until somebody resumed it by hand. Until then no scheduled sync ran and no change made in the shop was sent, so a price or a stock level could be wrong in the search for days. A sync that cannot reach Search Cloud now stays running, says when it tries again, and sends the same batch after 1, 2, 5, 10, 15 and 30 minutes. If that fails too it ends as failed, which lets the changes through again.
- The daily scheduled sync continues a paused sync. A sync an earlier version left paused comes back within a day of updating (or at once with Resume), and a pause made by hand now lasts until the next scheduled sync at the latest. The Sync tab says so while a sync is paused.
- A batch that is sent again is counted once in a sync's Processed and Failed numbers.
- `wp webhead-search-cloud sync run` waits and tries again as the background sync does, and exits with an error when the sync did not complete. It used to report a failed sync as completed.
- Fixed result cards designed in Search Cloud showing an empty search modal, since 1.0.2. They are drawn again, and as the panel draws them: without the plugin's own card frame round them, and without the site's styles for headings, links and images reaching into them.
- The search looks the same on a site that styles every element. A customized Elementor kit, or a theme's rules for buttons, fields, links and headings, no longer changes the modal's chips, filters, fields and cards. The site's own font, text size and text colour are still followed.
- Theming through the `--whsc-*` properties is unchanged. A rule of your own that restyles a `.whsc-*` element directly now needs `!important` to win.
- New: the arrow keys move through the search suggestions, and Enter searches for the one they are on.
- A link in an AI assistant reply is shown as a link instead of as brackets and an address. Only an http(s) address or a path on your site becomes one.
- Fixed the results carousel in right-to-left languages: its arrows, its page dots and the arrow keys work there now.
- Keyboard focus rings are drawn whole on filter chips, carousel cards, the Compare switch and the compare table, and at the same width on every screen.
- The message shown when a search or a photo search fails matches the rest of the modal, and the search box's placeholder follows the colour of the box's text.
- A page without a search trigger no longer costs a database query and the loading of translations.
- The settings screen is redrawn with WordPress's current components: one title, a tab strip that scrolls on a phone, and the same cards, fields and notices throughout.
- A settings screen that could not load says why and offers to try again, and a save that fails is reported beside its button with the reason.
- Clearing the sync history, deleting a run from it and disconnecting from Search Cloud ask for confirmation first.
- The Elementor widgets are listed under "webhead Search Cloud" in the editor panel instead of "General". Widgets already on a page are unaffected.
- REST routes describe their parameters, so a value of the wrong shape is refused with a 400.
- Updated the webhead plugin framework to 1.4.0. The package no longer carries the framework's updater or its command runner.

= 1.1.0 =
- New: search by photo. Shoppers can upload a photo instead of typing, and see the tags the vision model read.
- New: a guided quiz tab that turns a few questions into a filtered search.
- New: a "you may also like" row of similar products for your product pages.
- New: a curated category listing, so your merchandising rules for a category actually apply on that page.
- Products are indexed under their parent categories too, so filtering on "Shoes" - or a quiz answer or merchandising rule naming it - finds products filed under "Sneakers".
- Category, tag and attribute names no longer show HTML entities such as "&amp;" in filters and the compare table.
- Renaming, moving or deleting a category now updates the products in it without a manual sync.
- New: search-term redirects - send a search straight to a page instead of showing results.
- Security: the domain-verification endpoint no longer returns the site's write key to unauthenticated callers; it now answers only while a connection attempt is in progress.
- Fixed the AI assistant breaking permanently after a long reply.
- Fixed a failed search-as-you-type keystroke navigating the shopper away mid-word.
- Fixed saving Search Config deleting ranking boosts for content types this site does not index.
- Fixed a switch left on after a plan downgrade blocking every other Search Config save.
- Fixed WooCommerce products set to "Search results only" being left out of the search index while "Shop only" products were included. Private products are now indexed when the private option is on. The next sync corrects the index; no forced re-sync is needed.
- New: filter results by price (and any other numeric field you use as a facet) with a minimum and a maximum.
- New: a Load more button. Results were locked to the first page of twenty, with no way to reach the rest.
- New: the Connection tab shows what your plan has used this month - searches, documents, AI messages, photo searches - and marks anything near or past its limit.
- Merchandising rules can now curate a category listing page, not just a typed search.
- A merchandising banner now appears above the results; the setting existed but nothing ever rendered it.
- The photo button and the quiz are themeable in the block editor and Elementor like the rest of the widget.
- The search service moved to a new address, https://searcio.com. Nothing to do on your side; your existing keys keep working.
- Security: the write key and secret are no longer sent to the browser, even encrypted - including to users who can only view the settings.
- Fixed clearing the write key field erasing the saved key; leaving it blank now keeps it, as the field says.
- The admin cards have their shadow back, the Indexing tab's sections are collapsible with headings in order, and the admin's animations respect the reduced-motion setting.
- The storefront search shows a clearly visible keyboard focus ring, and disabled buttons there look disabled.
- The search icon is announced as "Search" to screen readers even when no placeholder text is set.
- A link to the General settings tab now opens it instead of the Sync tab, and each setting there shows its name and description once.
- A photo search shows the photo it is searching with while it works, and keeps it beside the tags it produced.
- The quiz moves keyboard and screen-reader focus to each new question, and its Back and Start over links sit next to the results they belong to.
- On a phone, search results now appear above the recent and popular searches instead of below them.
- The default accent colour now passes contrast wherever it is used as text (text in the accent uses a darker shade of it), and a placement's own accent reaches every part of its modal.
- Every control in the search modal shows a visible keyboard focus outline, including the mode tabs, which had none.
- Escape closes the search suggestions without clearing what you typed.
- Better on small and touch screens: the mode tabs scroll instead of being cut off, the carousel's page dots are easier to tap, and the assistant and price fields no longer make iOS zoom in.
- The results carousel respects the reduced-motion setting.
- The "In stock" / "Out of stock" colours on the search modal's product cards can be set in the search block and the Elementor search widget.
- The AI assistant on a phone: the message field follows the products and stays in view, Compare only appears when there is something to compare, and field names like "Categories" are translated.
- On a phone the search field shows its whole placeholder, and the photo-search row lines up with its tags.
- Photo search and typed search no longer get mixed up on screen, and a failed photo search restores the filters.
- Product-row carousels show their page dots.
- The Elementor widget can keep its search modal open while you edit it, optionally with a search already run, so style changes show as you make them.
- The Elementor widget's settings are regrouped by the part they style, with new ones for the overlay colour, the modal's font and content width, the card image, the sale badge, the carousel's card width and arrows, filter group names, and the trigger's alignment and width. The modal can also be a centred, floating dialog.
- The modal overlay fades in as intended, and the carousel's page dots stay right after its width changes.
- Fixed a full sync leaving content in search that should no longer be there, when an edit had indexed it after the last full sync and it later dropped out without being saved again (for example after hiding out-of-stock products or changing the product mapping).
- Fixed a permanently deleted post staying in search for good when the first attempt to remove it from the index failed. Full syncs now retry the removal until it succeeds.
- Fixed content staying in search for good when a full sync's attempt to remove it failed, for example after turning a content type off and then permanently deleting its posts. Later full syncs now keep retrying the removal until it succeeds.
- Tested up to WordPress 7.1.

= 1.0.4 =
- The AI assistant's answers now render properly instead of showing raw Markdown.
- The comparison table no longer shows internal indexing fields, duplicate rows or raw values, and reads better on a phone.
- Turning on the AI assistant no longer restyles the Search tab.

= 1.0.3 =

- Smaller download and a faster front end: removed ~2.4 MB of bundled developer tooling that was never used at runtime, and stopped scanning the plugins directory on front-end requests.
- Added a border-radius control for the AI assistant's message field.
- The AI assistant tab is now themeable in the block editor and Elementor; block-editor hover colours moved into Default/Hover tabs; long filter lists scroll instead of stretching the modal.
- Fixed the search modal and AI assistant showing English on translated sites.
- The AI assistant now shows an animated "Thinking" state, keeps the conversation next to the input, offers Try again when an answer fails, and has a properly centred send button.
- Removed leftover sync/onboarding options that nothing reads any more and that could be mistaken for live state.
- Search Config now also manages merchandising rules and the AI search, visual tagging and click-ranking switches.
- Fixed click-through tracking never recording anything: the analytics beacon was blocked by the browser before it was sent.
- Fixed a sync that could stop dead with no way back: a worker tick killed part-way through left the run on "Running" with nothing to advance it, which also blocked every later scheduled sync. Ticks now arm their successor up front, and the scheduled sync revives a run whose worker has died.
- Sync ticks are now time-boxed as well as batch-bounded, so a large clean-up against a slow index can no longer run past PHP's execution limit.
- Documents the index refuses to delete are counted and reported on the run instead of being dropped in silence.
- Incremental syncs now record why they failed instead of showing an unexplained failure (or none at all) in the sync history.
- Removed a leftover site-id option that nothing reads any more and that could go stale after reconnecting to a different site.
- Fixed sync history retention never deleting anything, so the runs table no longer grows without bound.

= 1.0.2 =

- Security: hardened the server-designed result card renderer so an indexed field value can no longer break out of an HTML attribute or inject a `javascript:`/`data:` link. Values are fully escaped and unsafe URL schemes are stripped before rendering.
- Security: the public domain-ownership verification endpoint now requires the token the Search Cloud ping always sends before returning the write key.
- Security: WordPress protected meta (keys starting with an underscore) is no longer indexed through a custom-field mapping by default, preventing accidental exposure of internal data in public search. A new filter lets you opt a specific key back in.

= 1.0.1 =

- Fixed a sync that could stay stuck on "Running" when its background worker stopped (WP-Cron disabled, no site traffic, or a tick killed mid-run). Pause, resume, and cancel now recover the run directly instead of waiting on a worker that will never respond, so a new sync can be started again.

= 1.0.0 =

Initial release.

- Connect WordPress/WooCommerce content to webhead Search Cloud, with configurable per-post-type field mapping and a resumable, batched sync engine (full, scheduled, and incremental).
- Full-screen search modal (Gutenberg block + Elementor widget) with search-as-you-type, autocomplete, faceted filtering, multi-type scope, recent/popular searches, and a highlights carousel.
- Server-designed card templates as an alternative to the plugin's built-in result cards.
- Search relevance configuration (searchable fields & weights, type boosts, facets, suggestions, synonyms) editable from the plugin's admin screen.
- Optional WPML/Polylang-aware language restriction for indexing and search.
- WP-CLI commands for running and monitoring syncs.
