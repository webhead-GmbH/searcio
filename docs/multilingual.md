# Multilingual Support (WPML / Polylang)

The plugin works with either **WPML** or **Polylang** to scope indexing and search by language. Both are entirely optional - with neither active, the plugin behaves as a single-language site and this entire section is a no-op.

## How it works

- Which languages are enabled for indexing/search is configured in the **Search Config** tab's **Languages** section, which reads from your Searcio account.
- During a sync, each post's language (resolved through WPML/Polylang) is tagged on its document. A post whose language isn't in your enabled set is skipped entirely - it's never sent to Searcio, so it never spends indexing quota and never appears in search.
- A post whose language can't be resolved (a multilingual plugin is active, but the post itself has no language assigned) is treated as unrestricted rather than excluded, since there's nothing concrete to exclude it for.
- On the front end, the search modal automatically scopes results to the visitor's current language, and asks for suggestions in it too (`filter[lang]`). So do the highlights, the product rows, the product finder (the quizzes in that language and those for every language), the popular searches, photo search, similar products and the AI shopping assistant. If the visitor's language isn't one of the enabled languages, the window shows none of Searcio's highlights, popular searches, suggestions or tabs, and a search goes to WordPress's native search in that language (`/en/?s=…`, the language's own front page) instead of returning empty or wrongly-scoped results.
- A merchandising rule on the Search Config tab can be kept to one language, so a German rule "jacke" does not fire on the English search "jacket". A quiz's language is set on the Product finder tab (or in the Searcio panel, which holds the same quizzes): one of the site's languages, or *Every language*. A quiz made before the site had a multilingual plugin is for every language until one is set, so a German quiz then shows on the English pages too. **Check the endings** counts a quiz's products in its language.
- Leaving the enabled-languages list empty means the site is unrestricted - every language is indexed, and each page still searches its own language, since every document carries its language either way.
- Saving the **Languages** section with a language ticked or unticked starts a sync, which sends the posts of a language that was added and takes out those of one that was removed. A post whose language is changed in the editor is synced when it is saved. Assigning a language to existing content in bulk (Polylang's setup wizard, or its "assign the default language to content without one" tool) saves no post, so start a sync on the Sync tab afterwards; the daily sync catches it up otherwise.

## WPML and Polylang together

If a site somehow has both plugins present, Polylang is treated as the active provider. This is deliberate: Polylang registers compatibility filters that make WPML-only detection code think WPML is active even when it isn't actually installed, so checking Polylang first avoids silently calling the wrong plugin's API.

## Compatibility notes

- Deactivating your multilingual plugin after having restricted languages does not silently break search - the plugin detects that no multilingual plugin is active and treats the search as unrestricted regardless of any previously-saved language list.
- No fatals or broken syncs occur in any combination of WPML active, Polylang active, or neither active.
