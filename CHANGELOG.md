# Changelog

## 1.0.2

- Security: hardened the server-designed result card renderer so a value from an indexed document can no longer break out of an HTML attribute or smuggle a `javascript:`/`data:` URL into a link. Field values are now fully escaped (quotes included) and script-bearing URL schemes are stripped before the card markup reaches the page.

## 1.0.1

- Fixed a sync that could stay stuck on "Running" when its background worker stopped (WP-Cron disabled, no site traffic, or a tick killed mid-run). Pause, resume, and cancel now detect a dead worker and act on the run directly instead of parking a control signal no live tick will ever read; cancelling also clears any stray scheduled tick and frees the active slot so a new sync can start.
- Added a wp-env integration test suite (activation, the sync REST endpoint, and the full start/tick/complete and dead-worker recovery workflows) alongside the existing unit tests.

## 1.0.0

Initial release.

- Connect WordPress/WooCommerce content to webhead Search Cloud, with configurable per-post-type field mapping and a resumable, batched sync engine (full, scheduled, and incremental).
- Full-screen search modal (Gutenberg block + Elementor widget) with search-as-you-type, autocomplete, faceted filtering, multi-type scope, recent/popular searches, and a highlights carousel.
- Server-designed card templates as an alternative to the plugin's built-in result cards.
- Search relevance configuration (searchable fields & weights, type boosts, facets, suggestions, synonyms) editable from the plugin's admin screen.
- Optional WPML/Polylang-aware language restriction for indexing and search.
- WP-CLI commands for running and monitoring syncs.
