# Configuration Reference

All settings live under **Search Cloud** in the WordPress admin menu, split across five tabs. Viewing the dashboard requires the `webhead-search-cloud_view` capability; changing connection credentials, indexing, or search configuration requires `webhead-search-cloud_manage_settings`; running or managing syncs requires `webhead-search-cloud_run_sync`. All three are granted to Administrators by default — see [`developers.md`](developers.md#capabilities) to grant them to other roles.

## Connection

- **Search key** — the public key (`sk_...`) used by the browser. Restricted by your Search Cloud domain allowlist.
- **Write key** / **Write secret** — server-side credentials (`wk_...` + secret) used to push content and manage configuration. Stored encrypted; masked once saved.
- **Test connection** — verifies the saved write credentials and shows your site ID and document usage (used / plan limit).

## Indexing

Per content type (WordPress post types, and WooCommerce products if active):

- **What to index** — turn a content type on or off.
- **What appears in results** — choose the source for the title, body text, result link, and thumbnail image (a built-in property, custom field, or taxonomy).
- **Extra fields** — send additional data under a name you choose, from a custom field, taxonomy, or built-in property. A taxonomy sends the names of the terms the item is assigned, exactly those.
- **Options** — include a short excerpt; also index private/password-protected items.
- For WooCommerce products specifically: price, regular/sale price, SKU, variation SKUs, stock status, categories, tags, average rating, review count, and any selected product attributes (sent as `attr_{name}`).
  - **Categories** are sent as names under `categories`, and each product carries every parent of its categories too: a product filed under *Shoes › Sneakers* is sent as `["Sneakers", "Shoes"]`. So `filter[categories]=Shoes`, a quiz answer or a merchandising rule naming *Shoes* matches everything under it, as WooCommerce's own category archive does.
  - Category, tag and attribute names are sent as typed. WordPress stores `&`, `<` and `>` in a term name as HTML entities; they are decoded first, so a filter value is the name a shopper sees (`Vergaser & Ansaugung`, not `Vergaser &amp; Ansaugung`).
- **Only index published, visible products** (WooCommerce, on by default) — index a product only when WooCommerce's own search would list it: catalog visibility "Shop and search results" or "Search results only". "Shop only" and "Hidden" products are left out, and so are out-of-stock products when WooCommerce is set to hide them from the catalog. Private products follow the private option above.

Changes here take effect on the next sync, not retroactively — run a sync (or wait for the next scheduled one) after changing indexing configuration.

Renaming, moving or deleting a category (or any other term) needs no sync of its own: the items filed under it or under any of its children are queued automatically, as if each had been edited. Changing only a term's description or slug queues nothing, since neither is indexed.

## Search Config

Controls how Search Cloud itself ranks and filters your content. Most of this data lives on Search Cloud's side; the plugin is a thin editor for it, so changes apply on the very next search, no sync required.

- **Searchable fields & weights** — which fields full-text search matches, and how much each counts (1–100). A higher weight on `title` makes title matches outrank body-text matches, for example.
- **Type boosts** — a ranking multiplier (0.1–100) per content type currently enabled in Indexing. Above 1 ranks that type higher overall; below 1 ranks it lower.
- **Facet fields** — fields returned as facets on search results and allowed as filters (`filter[field]=value`). Feeds the dynamic filter chips in the search modal. The field pickers on this tab offer exactly the fields your documents are indexed with under the saved Indexing mapping - note that WooCommerce tags are indexed as `product_tags` and categories as `categories`. A facet or suggest field that no document from this site has is flagged, since a facet on it would always be empty.
- **Suggest fields** — fields queried for search-as-you-type autocomplete suggestions. Defaults to `title` when left empty.
- **Synonyms** — one comma-separated group of interchangeable words per line (e.g. `sneaker, trainer`). A search for either word also matches results that only contain the other — useful for regional spelling or naming differences.
- **Languages** — see [`multilingual.md`](multilingual.md).
- **Popular searches** — a fallback list of queries shown as suggestions before a visitor types anything. Search Cloud's own live popular-searches data is used whenever available; this list only takes over when that request is empty or fails. Leave it empty to always prefer live data.
- **AI & ranking** — site-level switches: **AI search** (hybrid keyword + semantic results; turning it on starts a background re-index, turning it off is instant and keeps keyword search working), **AI visual tagging** (a vision model describes each product image and adds the tags to the document, applied as you sync), **Search by photo** (see below), and **Rank results by what visitors click**. A switch your plan does not include is shown but disabled, with the reason.
- **Merchandising rules** — curate the results of chosen searches: pin document ids to the top, keep ids out, and show a banner. Leave the trigger empty to apply a rule to every search, which is how you keep a product out of search site-wide. A rule can also carry a **filter field + value** (e.g. `category` / `shoes`), which makes it fire on that listing page rather than on a typed term — set both halves or neither, since one alone cannot trigger anything.
- **Search redirects** — send a search straight to a page instead of showing results, for terms where a results list is the wrong answer (a campaign term, a support page). The term must match **exactly**; capitalisation and surrounding spaces are ignored, but `black friday` does not fire on `black friday deals`. The destination is a full URL or a path on this site starting with `/`.

## Storefront modes

What the search modal offers is decided by Search Cloud's `/storefront-config`, not by a plugin setting — each mode appears only when the site's plan and setup allow it, so an upgrade turns it on with no change here and a shopper is never shown a control that would only fail.

- **AI Assistant** — a chat tab that answers in prose and returns the products it is talking about, with a Compare table across their attributes.
- **Search by photo** — a camera button in the search box. The shopper uploads (or, on a phone, takes) a photo; a vision model describes it as tags and those tags run as an ordinary search. The tags are shown above the results, so an unexpected result set reads as a misread photo rather than as broken search. Turn it on under *AI & ranking* above.
- **Find your match** — a guided quiz tab: a few questions that narrow the catalogue down for a shopper who knows what they want but not what it is called. The questions are built in the Search Cloud panel; the tab appears once at least one quiz is published. Answers accumulate into filters and run as a single search at the end.

Every mode is themeable from the same place as the rest of the widget — the block editor's Styles sidebar or Elementor's Style tab.

### Styling the Elementor widget

The modal is closed until a visitor opens it, so turn on **Content → Modal → Keep open while editing** before working through the Style tab: the modal then opens in the editor preview and every change shows as you make it. **Preview search** runs a search there too, so result cards, filters and prices are on screen to style; leave it empty to style the empty state (recent and popular searches, highlights). Visitors never see the modal open by itself, whatever is saved.

The Style tab follows the modal from the outside in: the trigger, the modal (colours, overlay, one font family for everything, corner radius, spacing, content width, section titles), the mode tabs, the search field, the primary buttons (Search, Load more and the price filter's Apply), suggestions, recent and popular searches, filters (including each group's name), result cards (image ratio and fit, sale badge, title and price), the carousel (card width per device, arrows, dots), the banner, the assistant and the quiz. Anything left empty keeps the plugin's default.

### Product rows

Besides the search modal, the plugin ships a **Search Cloud Products** block (and the matching Elementor widget) for placing a row of products anywhere on the storefront. Two sources:

- **Similar products** — "you may also like", matched by the product's own meaning rather than by shared tags. Needs AI search on your plan; without it the row stays hidden rather than showing an empty box.
- **Category listing** — a listing filtered to one facet value. This is what makes a merchandising rule's *category trigger* apply: a rule fires on a request that carries `filter[field]=value`, so a listing rendered from WordPress's own database can never trigger one. Pinned products come back first, hidden ones are already gone, and the rule's banner is rendered above the row. Resolved from the page, the value is the category's name, so on a parent category the row also lists the products filed under its children.

Leave the product or category empty and the row resolves it from the page it is on, so you place the block once on a product or category template rather than on every product and every category. A row with nothing to show removes itself, and so does a row whose request failed.

Rows use the same product cards as the search modal, in the plugin's default styling: neither the block nor the Elementor widget has style controls of its own.

## Sync

- **Start sync** / **Re-sync everything** — start a normal incremental-aware sync, or force a full re-send that ignores what's already indexed (uses more of your document quota; use this after a mapping change you want retroactively applied, or if you suspect the index has drifted).
- **Pause / Resume / Cancel** — control over the currently active run.
- **Sync history** — a sortable, filterable table of past runs (status, trigger, processed/pushed/deleted counts, timestamps), with per-row delete and a bulk "clear finished" action.

## General

- **Keep history for (days)** — how long finished sync runs are kept before being pruned automatically. `0` keeps them forever.
- **Delete plugin data on uninstall** — off by default. When enabled, deleting the plugin also removes its settings, sync tables, and per-post sync metadata from this site. It never deletes documents already sent to Search Cloud.
- **Cache** — a "Clear cache" button that resets this plugin's own cached data and PHP's opcode cache, so a just-changed setting or template shows up immediately.
