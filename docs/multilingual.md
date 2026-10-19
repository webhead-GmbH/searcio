# Multilingual Support (WPML / Polylang)

The plugin works with either **WPML** or **Polylang** to scope indexing and search by language. Both are entirely optional - with neither active, the plugin behaves as a single-language site and this entire section is a no-op.

## How it works

- Which languages are enabled for indexing/search is configured in the **Search Config** tab's **Languages** section, which reads from your Searcio account.
- During a sync, each post's language (resolved through WPML/Polylang) is tagged on its document. A post whose language isn't in your enabled set is skipped entirely - it's never sent to Searcio, so it never spends indexing quota and never appears in search.
- A post whose language can't be resolved (a multilingual plugin is active, but the post itself has no language assigned) is treated as unrestricted rather than excluded, since there's nothing concrete to exclude it for.
- On the front end, the search modal automatically scopes results to the visitor's current language. If the visitor's language isn't one of the enabled languages, search falls back to WordPress's native search instead of returning empty or wrongly-scoped results.
- Leaving the enabled-languages list empty means the site is unrestricted - every language is searchable, matching the default single-language behavior.

## WPML and Polylang together

If a site somehow has both plugins present, Polylang is treated as the active provider. This is deliberate: Polylang registers compatibility filters that make WPML-only detection code think WPML is active even when it isn't actually installed, so checking Polylang first avoids silently calling the wrong plugin's API.

## Compatibility notes

- Deactivating your multilingual plugin after having restricted languages does not silently break search - the plugin detects that no multilingual plugin is active and treats the search as unrestricted regardless of any previously-saved language list.
- No fatals or broken syncs occur in any combination of WPML active, Polylang active, or neither active.
