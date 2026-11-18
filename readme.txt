=== Searcio - Fast AI Product Search for WooCommerce ===
Contributors: webheadgmbh, mohammad425
Tags: search, woocommerce search, product search, ajax search, ai search
Requires at least: 6.8
Tested up to: 7.1
Requires PHP: 8.3
Stable tag: 1.4.1
License: GPL-3.0-or-later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Fast, AI-powered search for WordPress and WooCommerce: suggestions as you type, smart filters, an AI shopping assistant and photo search.

== Description ==

**Fast search. Smart answers.**

Searcio gives your WordPress site and WooCommerce store a full-screen search that finds the right product while your visitors are still typing. Results come with images, prices, sale badges and stock status, and the search itself runs on Searcio's cloud, not on your server. Your store stays fast, even when everyone is searching at once.

Shoppers who know exactly what they want find it in a keystroke. Shoppers who don't can answer a few questions in the product finder, ask the AI shopping assistant, or simply upload a photo.

**Free to start.** The core search is free forever, with no payment details needed. Add AI when your shop is ready for it.

**See it live.** Search the [demo shop](https://wordpress.demo.searcio.com/en/) in English or German, then look behind it in the [admin demo](https://wordpress.demo.searcio.com/?searcio-demo-admin=en): every setting of the plugin, and nothing you change is saved.

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

AI search and similar products come with every paid plan, and the AI shopping assistant and photo search with the Pro and Business plans. [Compare the plans](https://searcio.com/en/plans-pricing).

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

📖 Read the [documentation](https://searcio.com/en/docs/wordpress/introduction) to set up, configure and place the search.

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

When you want AI search, the AI shopping assistant, photo search, more languages or higher limits, upgrade to a paid plan whenever you like. [See the plans and pricing](https://searcio.com/en/plans-pricing).

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
* **When you sync:** the content you chose to index - for example a post's title, text and link - and, if you turn on the purchase price on the Indexing tab, what each product costs your shop, which Searcio uses to rank and never shows or returns.
* **When you make or change a quiz on the Product finder tab:** the quiz - its name, language, questions, answers and the conditions each answer filters by - which Searcio stores and shows in the product finder. Opening the tab asks Searcio for the site's quizzes and for the values of its filters, and checking a quiz's endings sends its questions to count the products at the end of each way through it. These requests carry the site's keys.
* **When you save the Search Config tab:** the search configuration you set there - weights, filters, synonyms, the searches never offered as popular searches, merchandising rules and redirects - and the shop's currency, which Searcio stores and applies.
* **While you are connected:** the Connection and Search Config tabs, Site Health and the daily sync ask Searcio for the site's status, its search configuration and what your plan has used this month. These requests carry the site's keys and nothing else, except that the daily sync also sends the shop's currency, which the AI shopping assistant writes prices in.
* **When you disconnect:** a request to remove the site, after which Searcio deletes its search index.
* **On the pages that show the search:** the visitor's browser opens its connection to Searcio as the page loads, and as the pointer reaches the search, or the search takes focus, it asks Searcio for the search window's settings, the popular searches and the products the window opens on, so the window is ready when it opens. No search term is sent, but their IP address is visible to Searcio.
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

= 1.4.1 =
- Security: password-protected posts and pages are no longer indexed unless "Also index private & password-protected items" is on, and the update takes the ones already indexed out.
- Profit ranking: send your products' purchase price (Indexing tab, from WooCommerce's Cost of goods or a plugin's field, entered without tax) and set "Profitable products first" on the Search Config tab, which checks its numbers and warns when nothing can be lifted yet. A change to a variation's price, stock or purchase price now reaches the search index.
- Category filter: categories of the same name under different parents are told apart and listed in WooCommerce's order, by name or by number of products (add "category_paths" to the facet fields after the next sync). WooCommerce brands can be indexed and filtered.
- Your own number fields can be filtered as a range, colour and size filters can match one variation in stock, every merchandising rule that matches applies, and a redirect can be kept to one language.
- In the search window: "20 of about 173 results" and counts on the type buttons for a search by meaning, highlights that show the newest products when the featured ones cannot be asked for, and a comparison of up to four products.
- On a multilingual site each page searches its own language, card templates can be made per language, and a new quiz starts in the language you work in.
- Saving the Indexing tab sends only what the change altered. The Sync tab says when WP-Cron does not run a sync and offers to run its next step, Site Health lists overdue tasks, and the Connection tab warns when the index is empty.
- Pages with a search button load about 1.2 MB less JavaScript, so they are ready sooner on phones.
- The Search Config tab lists its sections down the side instead of on one long page, and its repeated rows are easier to read and delete on a phone.
- WooCommerce's cart, checkout, account and shop pages are no longer indexed. Tested up to WooCommerce 11.3.
- Many smaller fixes to phones and tablets, error messages, the product finder, product rows and the German texts: see CHANGELOG.md.

= 1.4.0 =
- German in every version WordPress has, and French, Spanish, Italian and Polish for their regional variants.
- New Product finder tab: make, edit and publish quizzes in WordPress, with answers that ask for words or a price range.
- The AI shopping assistant types its reply as it arrives and writes prices in your shop's currency. On a multilingual shop the product finder, popular searches, photo search and similar products keep to the page's language.
- Searches, the opening of the search window and the settings tabs are faster.
- Security: the address Searcio calls to confirm the site is yours answers only to the one-time code of the connect.
- The settings page is at admin.php?page=searcio, and the blocks, widgets, hooks and everything the plugin stores are named "searcio".

= 1.3.1 =
- After updating from 1.3.0, activate the plugin again under Plugins: its main file is now searcio.php.
- The plugin calls itself Searcio everywhere, and a post's excerpt on a result ends at a whole word.

The changelog of every release is CHANGELOG.md in the plugin's repository: https://github.com/webhead-GmbH/searcio/blob/master/CHANGELOG.md
