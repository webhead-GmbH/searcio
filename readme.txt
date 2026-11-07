=== Searcio - Fast AI Product Search for WooCommerce ===
Contributors: webheadgmbh, mohammad425
Tags: search, woocommerce search, product search, ajax search, ai search
Requires at least: 6.8
Tested up to: 7.1
Requires PHP: 8.3
Stable tag: 1.4.0
License: GPL-3.0-or-later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Fast, AI-powered search for WordPress and WooCommerce: suggestions as you type, smart filters, an AI shopping assistant and photo search.

== Description ==

**Fast search. Smart answers.**

Searcio gives your WordPress site and WooCommerce store a full-screen search that finds the right product while your visitors are still typing. Results come with images, prices, sale badges and stock status, and the search itself runs on Searcio's cloud, not on your server. Your store stays fast, even when everyone is searching at once.

Shoppers who know exactly what they want find it in a keystroke. Shoppers who don't can answer a few questions in the product finder, ask the AI shopping assistant, or simply upload a photo.

**Free to start.** The core search is free forever, with no payment details needed. Add AI when your shop is ready for it.

= Lightning-fast, by design =

* **Instant results** - suggestions appear as visitors type, and they can pick one with the arrow keys. Results come when they press Enter, or as they type if you turn that on.
* **Forgives typos** - a misspelled search still finds the right product.
* **Light on your server** - every search goes from the visitor's browser straight to Searcio. Your WordPress database is not queried for a single search, so checkout and the rest of your site keep all the server they need.
* **Loads only where it is used** - the search code is added only to pages that show a search box, a search icon or a product row. It goes on every page only when you turn on a way that needs it there: your theme's own search icon, the keyboard shortcut or the floating button.
* **Always up to date** - a background sync sends only what changed, in small batches, picks up edits shortly after you save them, and tries again by itself when the service cannot be reached.

= Built for WooCommerce =

* **Product cards that sell** - images, prices as your shop shows them (with or without tax), sale badges, stock status and price ranges for variable and grouped products.
* **Smart filters** - one bar under the search field narrows results by content type, category (all categories, the main ones, or a tree to the depth you choose), tags, attributes such as color or size, and a price range. Colors, images and labels come from your swatches plugin or theme.
* **Product finder** - a short guided quiz that turns a few answers into a list of matching products. Make and edit the quizzes right in WordPress, on the Product finder tab, with a check of every way through a quiz before it goes live.
* **Merchandising** - pin products to the top of a search or a category page, keep products out, and show a promotional banner.
* **Search redirects** - send searches like "shipping" or "returns" straight to the right page.
* **Relevance you control** - field weights, per-type boosts, synonyms and suggestion fields, all from your WordPress admin. Results that visitors click most can rise for everyone, without cookies.

= Smarter answers with AI =

* **AI search** - hybrid keyword and semantic results that understand what a search means, not just the words in it.
* **AI shopping assistant** - shoppers describe what they need in their own words. The assistant answers and shows the products it means, with a table to compare them.
* **Search by photo** - shoppers upload a photo instead of typing and find products that look like it.
* **Similar products** - a "you may also like" row on product pages, matched by meaning rather than by shared tags.

AI search and similar products come with every paid plan, and the AI shopping assistant and photo search with the Pro and Business plans. [Compare the plans](https://searcio.com/preise).

= Fits your site =

* **Gutenberg blocks and Elementor widgets** - put a search box or a search icon anywhere, for example in your header, and a row of products on any page.
* **Any theme, any builder** - Searcio can take over your theme's own search, open from its search icon, sit in a floating button, or go anywhere as the `[searcio]` shortcode, a classic widget or a menu item.
* **Your look, no code** - style colors, corners, spacing and every part of the search window from the block editor or Elementor. For the shortcode, the classic widgets, a search form Searcio takes over and the floating button, the look editor on the Placement tab does the same, fonts included, set apart for desktops, tablets and phones. Until you pick others, the search follows your site's font and text color.
* **Not just products** - posts, pages and custom post types, with custom fields and taxonomies.
* **Multilingual** - works with WPML and Polylang, so visitors only see results in their language. How many languages are searched depends on your plan.
* **In your language** - translated into German (Germany with "du" or "Sie", Austria, and Switzerland with "Sie" or "du"), French, Spanish, Italian and Polish. A site in another variant of these languages, such as Canadian French or Mexican Spanish, gets the plugin in that language too.
* **Accessible** - full keyboard support, screen-reader labels and right-to-left languages.
* **WP-CLI** - run and watch syncs from the command line or a real system cron.

= Works with =

* **Swatches plugins** - Variation Swatches for WooCommerce by GetWooPlugins (and its Pro), by RadiusTheme, by CartFlows and by Woosuite; WCBoost - Variation Swatches; WPC Variation Swatches; Variation Swatches and Photos; Kadence Shop Kit; Choosly; Product Variation Swatches by ThemeHigh; and the free YITH WooCommerce Color, Image & Label Variation Swatches. Their colors, two-color values, images and labels show in the search window's filters.
* **Themes** - Flatsome, Porto and WoodMart, whose own swatches show in the filters, and Miniture.

= Get started in minutes =

1. Install the plugin and open **Searcio** in your WordPress admin.
2. Accept the terms and click **Connect to Searcio**. Your free Searcio account is set up for you in one click. If your email already has one, Searcio emails you a link to confirm it instead.
3. Choose what should be searchable on the **Indexing** tab.
4. Start your first sync on the **Sync** tab.
5. Add the **Searcio Search** block or Elementor widget where your visitors look for search, or, with any other theme or builder, turn on a way on the **Placement** tab.

= Support Searcio =

If you would like to support Searcio, you can show a small Searcio logo, linked to searcio.com, at the bottom of the search window. It is off unless you turn it on under Searcio > General, on every plan.

👉 Rate us on [WordPress](https://wordpress.org/support/plugin/searcio/reviews/#new-post)

💻 Contribute or report issues on [GitHub](https://github.com/webhead-GmbH/searcio). The full source code is there, including the JavaScript and CSS before they are built: the files in the plugin's `public/` folder are built from its `src/` folder with `npm install` and `npm run build`.

== Installation ==

1. In your WordPress admin, go to **Plugins > Add New Plugin**, search for **Searcio**, then install and activate it. Or upload the plugin zip under **Plugins > Add New Plugin > Upload Plugin**.
2. Go to **Searcio** in the WordPress admin menu. A site that is not connected yet opens on the **Connection** tab.
3. Accept the terms and click **Connect to Searcio**. Your free Searcio account is set up with your site's admin email address, or another one you enter under **Not this email?**. If that email already has a Searcio account, Searcio emails it a confirmation link: finish connecting on the Searcio dashboard, then paste the keys under **Advanced: manual key entry**. Keys you already have for this site go there too.
4. Open the **Indexing** tab and choose which content should be searchable.
5. Open the **Sync** tab and start your first sync.
6. Add the **Searcio Search** block to a page or template part (or the **Searcio Search** widget in Elementor) to place the search box or icon anywhere on your site. With any other theme or builder, open the **Placement** tab: let Searcio take over your theme's search, add a floating search button, or use the `[searcio]` shortcode.

== Frequently Asked Questions ==

= Is it free? =

Yes. The core search is free forever on Searcio's Free plan, and no payment details are needed: instant results, typo tolerance, autocomplete, filters, merchandising, search redirects, the product finder and search statistics, with a monthly allowance of searches and indexed documents made for small shops and blogs.

When you want AI search, the AI shopping assistant, photo search, more languages or higher limits, upgrade to a paid plan whenever you like. [See the plans and pricing](https://searcio.com/preise).

= Do I have to sign up somewhere? =

You need a free Searcio account, but there is no sign-up form. The search runs on Searcio, a hosted service, and connecting from the plugin sets up your account in one click with your admin email address. If that email already has an account, Searcio emails a confirmation link, and you paste the keys it gives you on the Connection tab.

= Will it slow down my site? =

No. Searches go from the visitor's browser straight to Searcio, so your WordPress server and database are not involved in a single search. The search code loads only on pages that show a search box, icon or product row, and on every page only when you turn on your theme's search icon, the keyboard shortcut or the floating button on the Placement tab. The sync runs in the background in small batches.

= Do I need WooCommerce? =

No. It searches posts, pages and custom post types on any WordPress site. With WooCommerce active, products are searchable too, with prices, stock, filters and the shopping features.

= What happens when my plan's searches run out? =

Your visitors can still search: a search they send with Enter opens WordPress's own search results until your allowance renews or you upgrade. Searcio emails you before you reach a limit, and the Connection tab shows what your plan has used this month.

= Does it work with my theme and page builder? =

Yes. Use the Searcio Search block in the block editor or the Site Editor, or the Searcio Search widget in Elementor; with any other theme or builder, use the Placement tab (see the next question). The search window keeps its own layout on any theme while following your site's font, text size and text color.

= My theme has no block or Elementor support. Can I still use it? =

Yes. Under Searcio > Placement, let Searcio take over your theme's search forms or open from your theme's own search icon (the tab suggests the selector for many popular themes), add a floating search button, or turn on the keyboard shortcut (Ctrl+K, Cmd+K on a Mac, or / outside a field). You can also place `[searcio]` in any page builder that runs shortcodes, use the classic widgets or add a search item to a menu. Every option is off until you turn it on.

= Can I change how it looks? =

Yes. The block and the Elementor widget let you style the search box, the window, the filters, the result cards, the AI assistant and more. For the shortcode, the classic widgets, a search form Searcio takes over and the floating button, open the look editor on the Placement tab: it has the Elementor widget's style settings, fonts included, for desktops, tablets and phones, with a large preview. Developers can also theme it with `--whsc-*` CSS custom properties.

= Does it support multilingual sites? =

Yes. With WPML or Polylang, each post is indexed with its language and visitors only see results in the language they are browsing. You choose which languages are indexed, as many as your plan allows.

= When do changes in my shop show up in the search? =

An edit is sent shortly after you save it, and a scheduled sync runs every day. Changes on the Indexing tab take effect with the next sync; changes on the Search Config tab apply to the very next search.

= Can I run the sync from the command line? =

Yes: `wp searcio sync run` runs a sync and waits for it, and `status`, `start`, `pause`, `resume` and `cancel` manage it.

= Where is the data hosted? Is it GDPR compliant? =

Your search data is hosted in the EU. Visitors' IP addresses are never stored in plain text, a [Data Processing Agreement](https://searcio.com/data-processing-agreement) is available, and when you ask for your data to be deleted, the search index goes with it. Only when you turn on AI features does the AI provider named in the agreement process content and searches. See **External services** below for everything the plugin sends.

= What happens if I uninstall the plugin? =

By default your settings and sync history stay in WordPress. Turn on **Delete plugin data on uninstall** under Searcio > General to remove them when you delete the plugin. Uninstalling never deletes documents already sent to Searcio; disconnecting does.

== Screenshots ==

1. Before a search: recent searches, popular searches and current highlights.
2. A merchandising rule at work: a banner and two pinned jackets for the search "jacket", with filters for type, category, brand, price, color and material.
3. The rule behind it, on the Search Config tab: the search it fires on, the language it keeps to, the products it pins and the banner.
4. The color filter shows your swatches and how many products have each color.
5. The AI shopping assistant answers in words and shows the products it means.
6. The product finder asks shoppers a few questions, here with a picture, and then shows the products that fit their answers.
7. The same quiz, made in WordPress: each answer narrows the products by your filters, and the question's picture comes from the Media Library.
8. Search by photo: upload a picture and find products that look like it.
9. Similar products on a product page, matched by meaning.
10. On a phone, the search window fills the screen.
11. The look editor: colors, fonts, sizes and spacing of every part of the search, for desktops, tablets and phones, with a live preview.
12. Search Config: AI search, visual tagging, search by photo, click ranking and the weight of each field.
13. Indexing: choose which content and which WooCommerce details are searchable.
14. Sync: start a sync and see the history of past ones.

== External services ==

This plugin sends data to Searcio, the hosted service that powers the search. Search does not work without it.

* **Before you connect:** opening the Connection tab asks Searcio for the current addresses of its terms of use, privacy policy and data processing agreement, to link them beside the consent boxes. Nothing about your site is sent.
* **When you connect:** the site's name and address, whether it runs WooCommerce, the site's admin email address (or the one you enter under "Not this email?"), the name of the admin who connects, which agreements you accepted, and an address on your site with a one-time code. Searcio uses them to create your account, or to find the one you have, and calls that address once to confirm that the site is yours.
* **When you sync:** the content you chose to index - for example a post's title, text and link.
* **When you make or change a quiz on the Product finder tab:** the quiz - its name, language, questions, answers and the conditions each answer filters by - which Searcio stores and shows in the product finder. Opening the tab asks Searcio for the site's quizzes and for the values of its filters, and checking a quiz's endings sends its questions to count the products at the end of each way through it. These requests carry the site's keys.
* **When you save the Search Config tab:** the search configuration you set there - weights, filters, synonyms, merchandising rules and redirects - and the shop's currency, which Searcio stores and applies.
* **While you are connected:** the Connection and Search Config tabs, Site Health and the daily sync ask Searcio for the site's status, its search configuration and what your plan has used this month. These requests carry the site's keys and nothing else, except that the daily sync also sends the shop's currency, which the AI shopping assistant writes prices in.
* **When you disconnect:** a request to remove the site, after which Searcio deletes its search index.
* **When a visitor searches:** the search term, the filters they pick or the answers they give in the product finder, the language of the page, how the search was started and where its results are shown, and which result they open. A product row asks for the products similar to the product on the page. Their browser contacts the service directly, so their IP address is visible to it. The list of a visitor's recent searches stays in their own browser.
* **When a visitor uses the AI shopping assistant** (off unless you turn it on): the message they type, and the language of the page.
* **When a visitor searches by photo** (off unless you turn it on): the photo they upload, and the language of the page.
* **When a visitor searches by voice** (off unless you turn it on): the visitor's browser turns what they say into the search term with its own speech recognition, which some browsers, Chrome among them, run on their maker's servers. The plugin receives only the text, and searches it as above.
* **When you pick a Google font in the look editor on the Placement tab** (off unless you pick one, and never for a font your site already has): every visitor's browser loads that font from Google Fonts (https://fonts.googleapis.com) on the pages that show the search, so their IP address is visible to Google. Google's privacy policy: https://policies.google.com/privacy

Nothing else is sent, and no visitor accounts are created.

Service: https://searcio.com
Terms of use: https://searcio.com/en/terms-of-use
Privacy policy: https://searcio.com/datenschutz
Data Processing Agreement: https://searcio.com/data-processing-agreement
Legal notice: https://searcio.com/impressum

== Changelog ==

= 1.4.0 =
- Sites set to "Deutsch (Sie)", to Swiss German either way, or to a regional variant of French, Spanish, Italian or Polish (Canadian French, Mexican Spanish and the like) showed the plugin in English. German now comes in every version WordPress has, each speaking to shoppers and shop owners as WordPress does there ("Sie" in "Deutsch (Sie)" and Swiss German, "du" in "Deutsch (Schweiz, Du)"), and the other variants get the plugin in their language.
- New Product finder tab: make, edit, publish and delete the product finder's quizzes in WordPress instead of the Searcio panel. A question's picture comes from the Media Library, answers offer the values your filters really have, and before a quiz is published every way through it is checked for how many products it shows.
- The product finder follows quiz answers that ask for words the products must contain, or for a price range, so a quiz can tell a door lock from a padlock in the same category, or keep to a budget.
- For a logged-in user, the search window opens under WordPress's toolbar instead of behind it, also where a theme draws the toolbar above everything else.
- The AI shopping assistant shows its reply as it is written, and the products as soon as it has found them, and writes prices in your shop's currency.
- On a multilingual shop, the product finder offers the quizzes in the language of the page, popular searches are those searched in it, and photo search, similar products and the products the AI shopping assistant shows keep to it. A merchandising rule can be kept to one language.
- A filter value with a comma in it, such as a category named "Jackets, Coats & Knitwear", finds its products; it found none.
- Search as you type answers sooner after a pause in typing.
- Ctrl+K and Cmd+K open the search with a keyboard layout that has no Latin letters, such as Persian or Russian, where they opened the browser's own search.
- The AI shopping assistant numbers the products it suggests 1, 2, 3, where a reply with a blank line between them showed "1." for each.
- Text in neighbouring paragraphs, headings and list items is indexed as separate words: a list of "Wool" and "Silk" was found only as "WoolSilk". The daily sync updates content that is already indexed.
- Updated the webhead plugin framework to 1.10.0, which is licensed under the GPL like the plugin.
- Messages on the settings screen, such as "Placement saved.", appear as WordPress's own notices at the bottom of the window.
- The previews on the Placement tab and in the look editor show a placeholder while their page loads, instead of an empty white frame, and caching plugins are told never to keep a preview, so a visitor never gets one with settings you have not saved.
- When your Searcio account has no active plan, has an overdue payment or is suspended, the Connection tab and Site Health say so, with a link to choose a plan, to pay on the billing page or to contact support. Syncing stops at once instead of trying again for an hour, and picks up again once your account is active. Meanwhile a search your shoppers submit goes to WordPress's own search.
- Support Searcio, the small logo in the search window, is off unless you turn it on, on every plan. If you had turned it on, it stays on.
- Security: when you connect, the address Searcio calls to confirm that the site is yours answers only to the one-time code that connect sent, and only once.
- The styles of the search block, the shortcode, the widgets, the floating button and the look editor are added through WordPress's stylesheet queue instead of being printed into the page.
- Updated the webhead plugin framework to 1.8.0.
- The plugin's settings page, blocks, widgets and everything it stores are named "searcio" now; the settings page is at `admin.php?page=searcio`. Your settings, sync history and connection move by themselves on the first page load after the update, and nothing has to be set up again. A theme or a snippet that uses the plugin's hooks, REST routes or CSS classes under the old name "webhead-search-cloud" should switch to "searcio": the old hooks still work for now, with a notice for developers.
- New: a Search statistics button in the settings header, and a link on the Connection tab, open your search statistics on the Searcio dashboard.
- New Placement tab: Searcio works with any theme and any builder. Let it take over your theme's search forms, open it from your theme's own search icon (with suggested selectors for popular themes), add a floating search button or the keyboard shortcut, or place it with the `[searcio]` and `[searcio_products]` shortcodes, the classic widgets, a menu item or a link to #searcio. Every way is off until you turn it on.
- The search window's filters are one bar under the search field: each filter opens its values in a popover, or in a sheet on a phone, and "All filters" shows them all. Picks apply at once.
- Search Config: a filter can show products that have every value picked (AND) instead of any of them (OR).
- On a multilingual site the search suggestions are in the language of the page, as the results are.
- Names with an "&" (post types, attributes, custom fields, price separators, popular searches) show as typed instead of as "&amp;".
- New on the Placement tab: a look editor for the shortcode, the classic widgets, a search form Searcio takes over and the floating button, with every style setting of the Elementor widget (colours, sizes, spacing, borders and fonts, Google Fonts included) for each part of the search, set apart for desktops, tablets and phones, with a large preview that shows each change as you make it.
- On phones the search window fills the screen and its results scroll down in a grid; recent and popular searches take one row each, so products are in sight at once.
- No Search button beside the search field any more: Enter searches, and the phone keyboard shows a Search key.
- On phones the AI assistant fills the screen with its message field at the bottom, and the tabs no longer jump in as the window opens.
- A theme that styles WooCommerce's block buttons no longer turns the search window's icons white: the colours set in the widget or the block now reach them, with no custom CSS.
- New on the Search Config tab: the category filter can show all categories, the main categories only, or the main categories with their subcategories under them, to the number of levels you choose.
- The filters show what your swatches plugin or theme set up: images, two-colour pills and short labels as well as colours, from Variation Swatches by GetWooPlugins (and its Pro), RadiusTheme, CartFlows and Woosuite, WCBoost, WPC, Variation Swatches and Photos, Kadence Shop Kit, Choosly, ThemeHigh, the free YITH Color, Image & Label Variation Swatches, Flatsome, Porto and WoodMart. A value you have not given a swatch yet no longer turns the filter into a plain list.
- Filters whose values are numbers are easier to read: the count is smaller and in brackets, and a value like "256 GB" is no longer cut.
- Popular searches have a trending arrow.
- The microphone, the assistant's icon and the words of the filter buttons stand in the middle of their buttons.

= 1.3.1 =
- **After updating from 1.3.0, activate the plugin again** under Plugins. Its main file is now `searcio.php`, the name wordpress.org gives it, and WordPress finds a plugin by its main file, so it switches the plugin off once. The settings, the sync history and the connection stay; nothing has to be synced again.
- The plugin calls itself Searcio everywhere: the admin menu, the settings screen, "Connect to Searcio", the "Searcio Search" and "Searcio Products" blocks and Elementor widgets, Site Health and all seven translations.
- The plugin's link in the plugin list goes to its page on wordpress.org.
- A post's excerpt on a search result ends at a whole word, with "…" when it was shortened, instead of stopping in the middle of a word.
- The product finder counts only the questions on the visitor's own path, so a quiz with branches no longer says "Question 1 of 3" when two questions are all there is.
- In the block editor, the size sliders of the search block's Styles tab have space between them; on the Search Config tab, the AI search index status lines up with its description, and each type boost is named by its content type.
- The camera button for search by photo lines up with the icons beside it.

= 1.3.0 =
- **The plugin is now "searcio - Fast AI Product Search for WooCommerce"**, and its slug and text domain are `searcio`, its name on wordpress.org. The release is `searcio-1.3.0.zip` and installs in a `searcio/` folder. **A site that installed an earlier release** has the plugin in `webhead-search-cloud/`, which WordPress takes for another plugin: check that "Delete plugin data on uninstall" under Search Cloud > General is off, deactivate and delete the old copy, then install and activate this one. The settings, the sync history and the connection stay; nothing has to be synced again.
- New: Support Searcio. A small searcio logo, linked to searcio.com, ends the search window, faded until it is pointed at. It is always shown on the Free plan; on a paid plan it can be turned off under Search Cloud > General.
- New: French, Spanish, Italian and Polish translations, and the German one is complete. German also ships for Austria and Switzerland, whose sites WordPress did not give the German of Germany.
- The General tab of the settings screen is named in the language of the screen.
- The admin menu and the settings header show the searcio mark.
- The compare table marks a missing value with "-", and the price filter separates its two fields with "-".
- The readme describes the plugin for its page on wordpress.org.

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
