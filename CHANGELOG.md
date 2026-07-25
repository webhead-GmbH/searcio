# Changelog

## 1.0.3

- Updated the webhead plugin framework to 1.2.0. The distributed package no longer carries development tooling: `symfony/console` (~1.7 MB) and the framework's scaffolding CLI (~590 KB across 61 template files) were bundled but never loaded at runtime. The prefixed dependency bundle drops from 3.7 MB to 1.3 MB.
- Front-end requests no longer scan the plugins directory. The framework resolved declared plugin dependencies on every request to build admin notices and a Site Health field, which outside wp-admin means globbing the plugins directory once per dependency; notices are now built only in wp-admin and the diagnostics field is deferred.
- Fixed the bundled WP-CLI commands (`cache`, `capabilities`, `jobs`, `upgrades`) declaring `--yes` as a required flag, which made WP-CLI reject the very flag it told you to re-run with — leaving those commands impossible to run.
- The AI assistant's message field now has its own border-radius control, in both the block editor and Elementor.
- The AI Assistant tab and its conversation can now be styled like every other part of the widget, in both the block editor and Elementor: tab colours (text, active, underline, divider), the assistant accent and reply text, and your-message bubble colours. 
- The frontend filter list is capped in height and scrolls instead of stretching the modal when a field has many values; the cap is themeable per placement (default 132px).
- Fixed the storefront search and AI assistant showing English on a translated site. Every source file has to be listed in the script translation map for its strings to reach the browser, and the files added by recent features never were — so the whole assistant surface stayed English no matter how complete the translation was. All six missing files are mapped, the German translation is filled in for all 36 storefront strings, and a test now fails if a file with translatable strings is left out of the map.
- Reworked the assistant's waiting state. A bare spinner said only "something is loading"; it now says **Thinking**, with a shine travelling through the word and three dots rising in turn, so a wait of several seconds looks alive. Both stop for visitors who prefer reduced motion.
- The send button's arrow was sitting high and right of centre, and when disabled it was filled the same colour as the composer, so it vanished and left a grey arrow floating in the field. The glyph is redrawn centred and the disabled state is now a visible button.
- The conversation is anchored to the bottom of the pane, like every messenger, instead of clinging to the top with a large empty gap above the input.
- A failed answer now appears as a message from the assistant — same avatar, in a tinted bubble — with a **Try again** action that re-sends the question instead of making you retype it.
- The Search Config tab now covers the whole of Search Cloud's search configuration. Merchandising rules (pin products to the top of a search, keep products out, show a banner) and the three site-level switches — AI search with its index status, AI visual tagging, and ranking by what visitors click — were only editable in the Search Cloud panel; the API exposes them now, so they are editable here too. A switch your plan does not include is shown but disabled, with the reason.
- Fixed click-through tracking never recording anything. The beacon sent a JSON body, which is not a CORS-safelisted content type, so the browser had to preflight it — and the API answers preflight requests without any CORS headers, so every click was blocked before it left the page. The beacon is now form-encoded, which needs no preflight and which the API reads identically.
- Fixed a sync that could stop dead with no way back: the follow-up worker tick was only scheduled at the very end of a tick, so a tick killed part-way through (a slow API against PHP's `max_execution_time`, an out-of-memory, a restarted worker) left the run on "Running" with nothing left to advance it — and because a run in that state holds the single active slot, every later scheduled sync silently did nothing. A tick now arms its successor before it starts working, and the scheduled sync revives a run whose worker has died instead of skipping it.
- Ticks are now time-boxed (20 seconds by default, filterable with `webhead_search_cloud/sync/tick_budget`) rather than bounded only by a batch count. Removing stale documents costs one request each, so a large clean-up could previously run hundreds of blocking requests in a single tick and be killed part-way through.
- Documents the index refuses to delete are now counted and reported on the sync run instead of being dropped from the queue in silence — a failing delete endpoint used to look exactly like a healthy clean-up, with "deleted 0" and no explanation.
- Incremental syncs now say why they failed. A failed incremental run was written to the history with no reason at all, and a rejected push that wasn't a plan-limit recorded nothing whatsoever, so the dashboard showed either an unexplained failure or no sign of a problem at all.
- Removed the leftover `webhead_search_cloud_site_id` option on upgrade. Nothing has read it since the connection moved to key-relative endpoints — the connection screen reads the id straight from the API — so all it did was go quietly stale and mislead anyone inspecting the options table (one site still held `5` while the API reported `4`).
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
