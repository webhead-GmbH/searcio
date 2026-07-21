# Changelog

## 1.0.3

- Fixed a sync that could stop dead with no way back: the follow-up worker tick was only scheduled at the very end of a tick, so a tick killed part-way through (a slow API against PHP's `max_execution_time`, an out-of-memory, a restarted worker) left the run on "Running" with nothing left to advance it — and because a run in that state holds the single active slot, every later scheduled sync silently did nothing. A tick now arms its successor before it starts working, and the scheduled sync revives a run whose worker has died instead of skipping it.
- Ticks are now time-boxed (20 seconds by default, filterable with `webhead_search_cloud/sync/tick_budget`) rather than bounded only by a batch count. Removing stale documents costs one request each, so a large clean-up could previously run hundreds of blocking requests in a single tick and be killed part-way through.
- Documents the index refuses to delete are now counted and reported on the sync run instead of being dropped from the queue in silence — a failing delete endpoint used to look exactly like a healthy clean-up, with "deleted 0" and no explanation.
- Fixed sync history retention never deleting anything: the purge built a comparison query the database layer then rejected, so the runs table grew without bound however the retention setting was configured.

## 1.0.2

- Security: hardened the server-designed result card renderer so a value from an indexed document can no longer break out of an HTML attribute or smuggle a `javascript:`/`data:` URL into a link. Field values are now fully escaped (quotes included) and script-bearing URL schemes are stripped before the card markup reaches the page.
- Security: the public domain-ownership `verify` endpoint now requires the verification token the Search Cloud ping always sends, so a tokenless request can no longer read the write key.
- Security: WordPress protected meta (keys starting with `_`) is no longer pushed to Search Cloud through a `meta:` field mapping by default, so an over-broad mapping can't leak internal data into public search. Opt a specific key back in with the new `webhead_search_cloud/index/allow_protected_meta` filter.

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
