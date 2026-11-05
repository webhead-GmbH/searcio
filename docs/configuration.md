# Configuration Reference

All settings live under **Searcio** in the WordPress admin menu, split across six tabs: **Sync**, **Indexing**, **Search Config**, **Placement**, **Connection** and **General**. They are described here in the order you set a site up in. Viewing the dashboard requires the `searcio_view` capability; changing connection credentials, indexing, or search configuration requires `searcio_manage_settings`; running or managing syncs requires `searcio_run_sync`. All three are granted to Administrators by default - see [`developers.md`](developers.md#capabilities) to grant them to other roles. A user without `manage_settings` sees the Sync tab only.

## Connection

- **Connect to Searcio** - connects the site in one step, once the Terms of Service and Privacy Policy are accepted (the Data Processing Agreement is optional). It uses the site admin's email address, or the one entered under **Not this email?**. An address with no Searcio account gets one and the site is connected at once; an address that already has an account is sent a confirmation link instead, and the keys are then pasted under *Advanced: manual key entry*. **How connecting works** explains this on the tab itself. See [`installation.md`](installation.md#2-connect-to-searcio).
- **Searcio connection** - shown once the site is connected: the number of documents in the index against your plan's limit, and what the plan allows this month and how much of it is used (searches, indexed documents, AI assistant messages, photo searches, AI image tagging). An allowance that is close to its limit or spent is marked. *See what visitors searched for* under it opens your search statistics on the Searcio dashboard, as **Search statistics** in the header of every tab does.
- **Disconnect** - asks first. It removes the site from Searcio: the service deletes the site and its index, the keys stop working, and the saved credentials are cleared here. The domain can be connected again afterwards, to a new, empty index, which a sync fills.
- **Advanced: manual key entry** (*/ rotate keys* once connected) - the three keys, for a site that already exists in your Searcio account and for replacing a key:
  - **Search key** - the public key (`sk_...`) used by the browser. Restricted by your Searcio domain allowlist.
  - **Write key** / **Write secret** - server-side credentials (`wk_...` + secret) used to push content and manage configuration. Stored encrypted; masked once saved.
  - **Test connection** - verifies the saved write credentials and shows your site ID and document usage (used / plan limit). It tests what is saved, so save first.

## Indexing

Per content type (WordPress post types, and WooCommerce products if active):

- **What to index** - turn a content type on or off.
- **What appears in results** - choose the source for the title, body text, result link, and thumbnail image (a built-in property, custom field, or taxonomy).
- **Extra fields** (under *Show advanced options*) - send additional data under a name you choose, from a custom field, taxonomy, or built-in property. A taxonomy sends the names of the terms the item is assigned, exactly those. Beside them, **Type label** sets the type this content is grouped and filtered by in search; most sites leave the default.
- The built-in title, body text, excerpt and author are sent as plain text, as they were typed: without markup and without HTML entities, so a result card reads `Women's "Storm" Jacket - Salt & Pepper`, not `Women&#8217;s &#8220;Storm&#8221; Jacket &#8211; Salt &#038; Pepper`. The title is the item's own, not the one the theme displays: WordPress's curly quotes and dashes are not added, and a private item's title is sent without "Private:". A custom field is decoded the same way; numbers and lists keep their type.
- **Options** - include a short excerpt; also index private/password-protected items.
- For WooCommerce products specifically, each turned on under **Product details**: price, regular/sale price, SKU, variation SKUs, stock status, categories, tags, featured, average rating, review count, and any selected product attributes (sent as `attr_{name}`).
  - **Categories** are sent as names under `categories`, and each product carries every parent of its categories too: a product filed under *Shoes › Sneakers* is sent as `["Sneakers", "Shoes"]`. So `filter[categories]=Shoes`, a quiz answer or a merchandising rule naming *Shoes* matches everything under it, as WooCommerce's own category archive does.
  - Category, tag and attribute names are sent as typed. WordPress stores `&`, `<` and `>` in a term name as HTML entities; they are decoded first, so a filter value is the name a shopper sees (`Vergaser & Ansaugung`, not `Vergaser &amp; Ansaugung`).
  - **Swatches** an attribute has in a swatches plugin or a theme (colours, two-colour values, images and short labels) are drawn in the search window's filters. Searcio works with Variation Swatches for WooCommerce by GetWooPlugins (and its Pro), by RadiusTheme, by CartFlows and by Woosuite; WCBoost - Variation Swatches; WPC Variation Swatches; Variation Swatches and Photos; Kadence Shop Kit; Choosly; Product Variation Swatches by ThemeHigh; the free YITH WooCommerce Color, Image & Label Variation Swatches; and the themes Flatsome, Porto and WoodMart.
  - **Prices** are sent as the shop displays them: with tax when **WooCommerce → Settings → Tax → Display prices in the shop** says *Including tax*, without when it says *Excluding tax*, whichever way they were entered, and rounded to the shop's decimals. A simple product, a variable product's range and a grouped product's range (from its children, each with its own tax class) are on that same basis, so the price filter compares like with like. The tax is worked out for no shopper, whoever runs the sync: for the shop's base location in WooCommerce's default settings, and whenever prices are entered with tax. A shop that enters prices without tax, calculates tax on the customer's address and sets the default customer location to *Geolocate* or *No location by default* has no location to work it out for, and its prices are sent without tax. The index is the same for every shopper, so a price that depends on who is looking (a VAT-exempt customer, a role price) is not in it. A change to the tax settings or rates reaches search at the next full sync.
- **Only index published, visible products** (WooCommerce, on by default) - index a product only when WooCommerce's own search would list it: catalog visibility "Shop and search results" or "Search results only". "Shop only" and "Hidden" products are left out, and so are out-of-stock products when WooCommerce is set to hide them from the catalog. Private products follow the private option above.

Changes here take effect on the next sync, not retroactively - run a sync (or wait for the next scheduled one) after changing indexing configuration.

Renaming, moving or deleting a category (or any other term) needs no sync of its own: the items filed under it or under any of its children are queued automatically, as if each had been edited. Changing only a term's description or slug queues nothing, since neither is indexed.

## Search Config

Controls how Searcio itself ranks and filters your content. Most of this data lives on Searcio's side; the plugin is a thin editor for it, so changes apply on the very next search, no sync required.

- **Searchable fields & weights** - which fields full-text search matches, and how much each counts (1-100). A higher weight on `title` makes title matches outrank body-text matches, for example.
- **Type boosts** - a ranking multiplier (0.1-100) per content type currently enabled in Indexing. Above 1 ranks that type higher overall; below 1 ranks it lower.
- **Facet fields** - fields returned as facets on search results and allowed as filters (`filter[field]=value`). They are the filters of the search window, in the order listed here: the first five that fit get a button under the search field (the *Filter buttons in the bar* of the search block, the Elementor widget and the Placement tab's Look section sets how many), and every one is under *All filters*. A group that few results of a search carry moves behind the others. The field pickers on this tab offer exactly the fields your documents are indexed with under the saved Indexing mapping - note that WooCommerce tags are indexed as `product_tags` and categories as `categories`. A facet or suggest field that no document from this site has is flagged, since a facet on it would always be empty.
  - Once Searcio reports the setting, each facet field also gets **Any (OR)** or **All (AND)** under *When a shopper picks several values of one filter*. With *All*, picking two values shows only items that have both, for a field an item holds several values of, such as features or tags. Until then the choice is not shown, and values of one field match any of them.
- **Category filter** - how the search window lists categories in its filter: *All categories, in one list* (the default), *Main categories only*, or *Main categories with their subcategories under them*, with *Levels to show* (2-10, 2 by default; the main categories are the first level). Picking a main category finds the products in its subcategories too. It is kept in WordPress and saved with the tab's Save button.
- **Suggest fields** - fields queried for search-as-you-type autocomplete suggestions. Defaults to `title` when left empty.
- **Synonyms** - one comma-separated group of interchangeable words per line (e.g. `sneaker, trainer`). A search for either word also matches results that only contain the other - useful for regional spelling or naming differences.
- **Languages** - see [`multilingual.md`](multilingual.md).
- **Popular searches** - a fallback list of queries shown as suggestions before a visitor types anything. Searcio's own live popular-searches data is used whenever available; this list only takes over when that request is empty or fails. Leave it empty to always prefer live data.
- **AI & ranking** - site-level switches: **AI search** (hybrid keyword + semantic results; turning it on starts a background re-index, turning it off is instant and keeps keyword search working), **AI visual tagging** (a vision model describes each product image and adds the tags to the document, applied as you sync), **Search by photo** (see below), and **Rank results by what visitors click**. A switch your plan does not include is shown but disabled; AI search, AI visual tagging and Search by photo also say why.
- **Merchandising rules** - curate the results of chosen searches: pin document ids to the top, keep ids out, and show a banner. Leave the trigger empty to apply a rule to every search, which is how you keep a product out of search site-wide. A rule can also carry a **filter field + value** (e.g. `category` / `shoes`), which makes it fire on that listing page rather than on a typed term - set both halves or neither, since one alone cannot trigger anything.
- **Search redirects** - send a search straight to a page instead of showing results, for terms where a results list is the wrong answer (a campaign term, a support page). The term must match **exactly**; capitalisation and surrounding spaces are ignored, but `black friday` does not fire on `black friday deals`. The destination is a full URL or a path on this site starting with `/`.

## Storefront modes

What the search modal offers is decided by Searcio's `/storefront-config`, not by a plugin setting - each mode appears only when the site's plan and setup allow it, so an upgrade turns it on with no change here and a shopper is never shown a control that would only fail.

- **AI Assistant** - a chat tab that answers in prose and returns the products it is talking about, with a Compare table across their attributes.
- **Search by photo** - a camera button in the search box. The shopper uploads (or, on a phone, takes) a photo; a vision model describes it as tags and those tags run as an ordinary search. The tags are shown above the results, so an unexpected result set reads as a misread photo rather than as broken search. Turn it on under *AI & ranking* above.
- **Product finder** - a guided quiz tab: a few questions that narrow the catalogue down for a shopper who knows what they want but not what it is called. The questions are built in the Searcio panel; the tab appears once at least one quiz is published. Answers accumulate into filters, required words (`keywords[]`) and ranges (`range[field]`), and run as a single search at the end.

Every mode is themeable from the same place as the rest of the widget - the block editor's Styles sidebar, Elementor's Style tab, or, for the shortcode, the classic widget, a form Searcio takes over and the floating button, the Placement tab's look editor.

### Styling the Elementor widget

The modal is closed until a visitor opens it, so turn on **Content → Modal → Keep open while editing** before working through the Style tab: the modal then opens in the editor preview and every change shows as you make it. **Preview search** runs a search there too, so result cards, filters and prices are on screen to style; leave it empty to style the empty state (recent and popular searches, highlights). Visitors never see the modal open by itself, whatever is saved.

The Style tab follows the modal from the outside in: the trigger, the modal (colours, overlay, one font family for everything, corner radius, spacing, content width, section titles), the mode tabs, the search field, the primary buttons (Load more and the price filter's Apply; there is no Search button, Enter searches), suggestions, recent and popular searches, filters (including each group's name), result cards (image ratio and fit, sale badge, title and price), the carousel (card width per device, arrows, dots), the banner, the assistant and the quiz. Anything left empty keeps the plugin's default. For a floating dialog rather than a full-width sheet docked to the top, set **Modal width** and **Distance from top** (per device, so a phone can keep the full-width sheet) and turn on **Round the top corners too**.

### Product rows

Besides the search modal, the plugin ships a **Searcio Products** block (and the matching Elementor widget) for placing a row of products anywhere on the storefront. Two sources:

- **Similar products** - "you may also like", matched by the product's own meaning rather than by shared tags. Needs AI search on your plan; without it the row stays hidden rather than showing an empty box.
- **Category listing** - a listing filtered to one facet value. This is what makes a merchandising rule's *category trigger* apply: a rule fires on a request that carries `filter[field]=value`, so a listing rendered from WordPress's own database can never trigger one. Pinned products come back first, hidden ones are already gone, and the rule's banner is rendered above the row. Resolved from the page, the value is the category's name, so on a parent category the row also lists the products filed under its children.

Leave the product or category empty and the row resolves it from the page it is on, so you place the block once on a product or category template rather than on every product and every category. A row with nothing to show removes itself, and so does a row whose request failed.

Rows use the same product cards as the search modal, in the plugin's default styling: neither the block nor the Elementor widget has style controls of its own.

## Placement

Where the search goes when a block or an Elementor widget cannot, and how it looks there. The sections are listed down the side, each with a line of its state. Every way is off until it is turned on, and **Save placement** saves the whole tab.

- **Search forms** - *Use Searcio for the site's search forms*: the theme's search form, WooCommerce's product search and the Search and Product Search blocks are drawn as a Searcio search field. The form they replace stays until the search is drawn, so a visitor without JavaScript still searches WordPress.
- **The theme's search** - *Open Searcio from the theme's own search*: the elements the **CSS selectors** name open Searcio, and the theme's own dropdown or overlay stays closed. The tab names the active theme and suggests its selectors for many popular themes and for Elementor Pro's search form; a suggestion is added only when you add it.
- **Keyboard shortcut** - Ctrl+K, Cmd+K on a Mac, and "/" outside a field open the search.
- **Floating search button** - a button fixed to a bottom corner of every page: the corner, on phones only (screens narrower than 782px) or on every screen, the magnifier or the word "Search", and its distance from the bottom, with a preview.
- **Look** - how `[searcio]`, the *Searcio Search* classic widget, a form Searcio takes over and the floating button look and behave, unless one of them says otherwise; the block and the Elementor widget keep their own settings. The section holds the search's settings (shown as a magnifier or a search field, the placeholder, the content to search, the field's width and alignment, when a search starts, what the window shows before a search, the filter buttons in the bar, the opening animation, the result cards, voice search and the result counts on filters) and a preview of the page, closed or with the window open.
  - **Open the look editor** opens a full-screen editor with the Elementor widget's style settings, part by part: the trigger, the window, the mode tabs, the search field, the buttons, the suggestions, recent and popular searches, the filters, the result cards, the carousel, the AI assistant, the banner and the product finder, each in its Normal, Hover, Active and Focus states where it has them. Its *Content* tab holds the search's settings above.
  - Sizes, spacing and type sizes are set for desktops, tablets and phones apart, at Elementor's breakpoints (1024px and 767px). A smaller screen takes the larger one's value until it is given its own.
  - Beside the settings, a page of the site is drawn at the chosen device's width, in the theme's own styles, and shows each change as it is made. Save from the editor or from the tab.
  - A font can be one of the site's own or a Google font. A Google font is loaded from Google's servers by each visitor's browser on the pages that show the search, unless the site has a font of that name; the editor says so beside it.
  - Colours and a corner radius saved before the editor existed move into it.
- **Shortcodes** - builds a `[searcio]` or `[searcio_products]` shortcode with only what differs from the Look section and the product row defaults, with a copy button.
- **Product rows** - what `[searcio_products]` and the *Searcio Products* classic widget show unless they say otherwise: similar products or a category listing, as a carousel or a grid, how many, the heading, and a category's banner.
- **Other ways to place it** - the blocks, the Elementor widgets, the classic widgets, a menu item, a link to `#searcio` or any element with the class `searcio-open`, and `do_shortcode()` in a child theme.

The placeholder and the product row heading are strings of Polylang (*Languages > Translations*) and WPML (*String Translation*), in the *Searcio* group.

## Sync

- **Start sync** / **Re-sync everything** - start a normal incremental-aware sync, or force a full re-send that ignores what's already indexed (uses more of your document quota; use this after a mapping change you want retroactively applied, or if you suspect the index has drifted).
- **Pause / Resume / Cancel** - control over the currently active run. While a sync is paused, changes made in the shop are not sent to Searcio either: they wait for it to finish. A pause therefore lasts until the next scheduled sync at the latest, which continues the paused run.
- **When Searcio does not answer** - the run stays *Running*, says when it tries again, and sends the same batch after 1, 2, 5, 10, 15 and 30 minutes. After that it ends as *Failed*; changes made in the shop are sent again from then on, and the next scheduled sync starts over. To have it tried at once, pause the run and resume it.
- **Sync history** - a sortable, filterable table of past runs (status, trigger, processed/pushed/deleted counts, timestamps), with per-row delete and a bulk "clear finished" action.

## General

- **Keep history for (days)** - how long finished sync runs are kept before being pruned automatically. `0` keeps them forever.
- **Delete plugin data on uninstall** - off by default. When enabled, deleting the plugin also removes its settings, sync tables, and per-post sync metadata from this site. It never deletes documents already sent to Searcio.
- **Support Searcio** - off by default. Shows the Searcio logo, small in the bottom corner of the search window, linked to searcio.com, once you turn it on. It is your choice on every plan, the Free plan included.
- **Cache** - a **Clear cache** button that resets this plugin's own cached data and PHP's opcode cache, so a just-changed setting or template shows up immediately.
