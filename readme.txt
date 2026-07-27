=== webhead Search Cloud ===
Contributors: webheadgmbh, mohammad425
Tags: search, woocommerce
Requires at least: 6.0
Tested up to: 7.0
Requires PHP: 8.3
Stable tag: 1.0.4
License: GPL-3.0-or-later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Instant full-screen search for your posts, pages and products, powered by the hosted webhead Search Cloud service.

== Description ==

Connect WordPress and WooCommerce to `webhead Search Cloud` - a fast, hosted search service - and give visitors an instant, full-screen search experience for your posts, pages, and products.

The plugin indexes your content into Search Cloud, keeps it in sync as content changes, and renders a client-side search modal (via a Gutenberg block or an Elementor widget) that searches, filters, and displays results without a page reload.

### Key Features:
- **Full-screen search modal** - a fast, keyboard-friendly overlay with search-as-you-type, autocomplete suggestions,
  recent and popular searches, and an empty-state highlights carousel.
- **Faceted filtering** - filter results by content type and by any field you've configured as a facet (category, price,
  tags, and so on).
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
- **Multilingual (WPML / Polylang)** - optionally restrict indexing and search to specific languages; visitors only see
  results in their current language.
- **Background sync** - a resumable, batched sync engine keeps your index up to date automatically, plus an incremental
  drain that pushes edits shortly after they happen. Full sync history, pause/resume/cancel controls, and retention
  settings are all available from the dashboard.
- **WP-CLI support** - run and monitor syncs from the command line for real system-cron setups.

== Installation ==

1. Install and activate the plugin like any other WordPress plugin.
2. Go to **Search Cloud** in the WordPress admin menu and open the **Connection** tab.
3. Enter the search key, write key, and write secret from your Search Cloud site page, then save.
4. Open the **Indexing** tab and choose which content should be searchable.
5. Open the **Sync** tab and start your first sync.
6. Add the **Search Cloud** block to a page (or the **Search Cloud** widget in Elementor) to place the search trigger
   anywhere on your site.

== External services ==

This plugin sends data to webhead Search Cloud, the hosted service that powers the search. Search does not work without it.

* **When you sync:** the content you chose to index - for example a post's title, text and link.
* **When a visitor searches:** the search term, and which result they open. Their browser contacts the service directly, so their IP address is visible to it.
* **When a visitor uses the AI Assistant** (off unless you turn it on): the message they type.

Nothing else is sent, and no visitor accounts are created.

Service: https://search.webhead.dev - Privacy policy: https://search.webhead.dev/datenschutz

== Changelog ==

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
