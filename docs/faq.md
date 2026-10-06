# Frequently Asked Questions

### The search modal shows results, but typing a real query does nothing / redirects to WordPress's normal search results page

This is the plugin's deliberate fallback behavior: if Search Cloud can't be reached, the connection isn't configured, or the visitor's current language isn't one of the site's enabled search languages, the modal falls back to WordPress's native `?s=` search instead of showing a broken or empty state.

Things to check:

- **Connection** tab → is the connection configured and does "Test connection" succeed?
- **Search Config** tab → **Languages** — if you previously restricted languages and later deactivated WPML/Polylang without checking this tab again, the stored language list can go stale. Re-open and re-save the Languages section to refresh it (this is also handled automatically now — the plugin only applies a language restriction while a multilingual plugin is actually active).
- Browser console/network tab → look for a failed request to your Search Cloud endpoint.

### "Test connection" fails

Double-check the write key and write secret were copied correctly from your Search Cloud site page (not the search key). A masked field that's already saved doesn't need to be retyped unless you're rotating it — leave it blank to keep the existing value.

### Product indexing options are missing / grayed out

WooCommerce isn't active, or is below the minimum supported version (8.0). Product indexing is disabled until WooCommerce is updated; indexing for regular posts and pages still works normally.

### I changed the Indexing configuration but search results didn't change

Indexing configuration only takes effect on the next sync. Either wait for the next scheduled sync or start one manually from the **Sync** tab. Search Config changes (weights, facets, synonyms, languages), by contrast, apply immediately on the next search — no sync required.

### I don't see the language options on the Search Config tab

Language configuration only appears when Search Cloud's own service reports language support and a multilingual plugin (WPML or Polylang) is active on the site. With neither active, search is unrestricted by language and there's nothing to configure.

### A sync run shows "Failed" or content is being skipped

Open the sync history row for the failed run — the last error message is shown there. Common causes: the Search Cloud plan's document limit was reached (upgrade your plan or reduce what you index), or Search Cloud could not be reached for over an hour. A sync that cannot write stays *Running* and tries again by itself, waiting longer each time; only when the last of those tries fails does it end as *Failed*. Nothing has to be done then: changes made in the shop are sent as soon as Search Cloud answers again, and the next scheduled sync runs a full one.

### How do I stop the plugin from deleting my data if I uninstall it?

By default it won't — **Delete plugin data on uninstall** is off, so removing the plugin keeps its settings, sync tables, and per-post sync metadata untouched. Turning that setting on and then uninstalling removes that data from your WordPress site; it never deletes documents already sent to Search Cloud.
