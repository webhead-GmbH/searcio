# Installation & Setup

## Requirements

- WordPress 6.8 or later
- PHP 8.3 or later
- A [Searcio](https://searcio.com) account - one is created for you when you connect, if your email does not have one yet
- WooCommerce 8.0 or later (optional, only needed to index and search products)
- WPML or Polylang (optional, only needed for multilingual search scoping - see [`multilingual.md`](multilingual.md))

## 1. Install the plugin

Install the package of a release, `searcio-<version>.zip`, with **Upload Plugin** on the screen where WordPress adds a plugin, or extract it into `wp-content/plugins/webhead-search-cloud`, then activate it.

## 2. Connect to Searcio

1. In WordPress, go to **Searcio**. A site that is not connected yet opens on the **Connection** tab.
2. Tick **I accept the Terms of Service and Privacy Policy** (required) and, if you want it, **I accept the Data Processing Agreement**.
3. Click **Connect to Searcio**.

The site connects with the email address of the site's admin, which the tab names before you click. **Not this email?** lets you enter another address, with your name and a company name; the company name becomes the name of the Searcio account. Connecting sends that email address and name, the site's name and address, and your two answers to the consent boxes to Searcio.

What happens next depends on the email address:

- **It has no Searcio account yet.** One is created, the site is connected at once and its keys are stored for you. The tab shows *Connected* with your document count and this month's usage.
- **It already has a Searcio account.** Nothing is created or changed. Searcio emails a confirmation link to that address; its owner clicks it and chooses which account the site belongs to. Then come back to the tab and paste the keys the dashboard shows under **Advanced: manual key entry**.

### Entering keys by hand

If the site already exists in your Searcio account, skip the button: open **Advanced: manual key entry** on the same tab, paste the **search key** (`sk_...`), **write key** (`wk_...`) and **write secret** from the site's page in the dashboard, and click **Save connection**. **Test connection** then checks the saved credentials and shows your site ID and document usage. A domain that is already connected is not connected a second time by the button; the tab says so and opens this section.

The write key and secret are encrypted at rest and are never sent back to the browser once saved - the field shows a masked placeholder. Leave a masked field blank to keep its current value, or type a new one to rotate it.

## 3. Choose what to index

Go to **Searcio → Indexing** and turn on each post type (and WooCommerce products, if active) you want to be searchable. For each enabled type you can:

- pick which built-in property, custom field, or taxonomy powers the title, body text, link, and thumbnail image
- add extra fields (a custom field, taxonomy, or built-in property) under a name of your choice
- include a short excerpt, and include private/password-protected content if needed

Sending a field here makes its data available to Searcio. To let visitors actually search *by* a field, also enable it (with a weight) on the **Search Config** tab - see [`configuration.md`](configuration.md).

## 4. Run the first sync

Go to **Searcio → Sync** and click **Start sync**. This sends your currently-enabled content to Searcio. The sync runs in the background in resumable batches; you can pause, resume, or cancel it, and watch live progress on the same screen.

After the first sync, a scheduled sync runs daily and an incremental sync pushes edits shortly after you save, trash, or delete content - you don't need to manually re-sync for day-to-day edits. See [`developers.md`](developers.md#wp-cli) if you're running WordPress on a real system cron and want to trigger syncs directly.

## 5. Add the search experience to your site

Add the **Searcio Search** block to any page or template in the block editor, or the **Searcio Search** widget if you use Elementor (both widgets are listed under *Searcio* in Elementor's panel). Both offer the same options:

- **Trigger style** - an icon button or a full search box
- **Restrict to type** - scope this instance to one content type, or leave it open to all indexed types
- **Card source** - the plugin's own built-in result card, or a template you've designed in the Searcio dashboard
- Full color, spacing, radius, and typography controls for every part of the modal (trigger, input, buttons, facets, result cards, carousel)

Multiple instances can exist on the same site with different settings - for example, an icon in the header scoped to everything, and a search box on a landing page scoped to one content type.

### Without a block or an Elementor widget

A theme with a header of its own (Enfold, Divi, Avada, Flatsome and most classic themes) or a page builder other than Elementor can still use Searcio. Go to **Searcio → Placement**. Every way on that tab is off until you turn it on, and saving shows the result on the site straight away.

- **Use Searcio for the site's search forms** - the theme's search form (`get_search_form()`), WooCommerce's product search and the Search and Product Search blocks become a Searcio search field. Without JavaScript they still search WordPress with `?s=`.
- **Open Searcio from the theme's own search** - a click on an element a CSS selector names opens Searcio, and the theme's own dropdown or overlay stays closed; a search field opens it with what was typed. The tab names your theme and suggests its selectors for Enfold, Flatsome, Astra, Kadence, Blocksy, GeneratePress, OceanWP, Storefront, Divi, Woodmart, Avada, The7 and Salient, and for Elementor Pro's search form. For another theme, right-click its search icon, choose *Inspect*, and copy a class or an id it has (Enfold's is `#menu-item-search > a`).
- **Keyboard shortcut** - Ctrl+K (Cmd+K on a Mac) and `/` outside a field open the search.
- **Floating search button** - a button in a bottom corner of every page, on phones only or on every screen, for a theme that hides its search on a phone. Lift it above a cookie notice or a cart bar with *Distance from the bottom*.

The other ways, which the tab also lists:

- **Shortcodes** - `[searcio]` draws the search and `[searcio_products]` a row of products, in Avia's code block, WPBakery's shortcode element, Divi's code module, a classic Text widget or any other place that runs shortcodes. An attribute left out takes the look set on the Placement tab, so `[searcio]` alone is enough; the tab's shortcode builder writes one with only what differs, for example `[searcio mode="box" placeholder="Search the shop" width="320" align="center"]`.

  | `[searcio]` attribute | Values |
  | --- | --- |
  | `mode` | `icon` (a magnifier) or `box` (a search field) |
  | `placeholder` | the field's hint |
  | `type` | a content type to search alone, for example `product` |
  | `width`, `align` | the field's width in px (0 fills), and `start`, `center` or `end` |
  | `voice`, `count` | `yes` or `no`: voice input, and the number of results on each filter |
  | `trigger` | `submit` (search on Enter) or `type` (search as the visitor types) |
  | `highlights` | `newest` or `featured`: what the window shows before a search |
  | `filters` | 0 to 8 filter buttons in the bar |
  | `animation` | `none`, `fade`, `slide-down`, `slide-up` or `zoom` |
  | `cards` | `plugin` or `server` (a template designed in Searcio) |
  | `accent`, `background`, `text`, `icon_color`, `radius` | the window's colours and corner radius |
  | `class` | more classes for the trigger |

  | `[searcio_products]` attribute | Values |
  | --- | --- |
  | `source` | `similar` (to the product on the page) or `category` (the category on the page) |
  | `id`, `field`, `value` | a product's document id, or a category's field and value, for a row placed elsewhere |
  | `layout`, `limit` | `carousel` or `grid`, and 1 to 24 products |
  | `heading`, `banner` | the row's title, and `yes` or `no` for a merchandising banner |
  | `cards`, `class` | as above |

- **Classic widgets** - *Searcio Search* and *Searcio Products* under **Appearance → Widgets**, for a theme with classic widget areas. In a block widget area, use the blocks.
- **Menu item** - under **Appearance → Menus**, the *Searcio* box adds a search item to a classic menu. In a Navigation block, add a custom link to `#searcio`.
- **A link or an element** - a link to `#searcio`, or any element with the class `searcio-open`, opens the search: a page builder's button, a theme option's link, an icon. A page whose content, menu or widgets hold one loads the search by itself.
- **PHP in a child theme** - `<?php echo do_shortcode( '[searcio]' ); ?>` in a template such as `header.php`.

The placeholder and the product row's heading set on the Placement tab are translatable: with Polylang under **Languages → Translations** in the *Searcio* group, with WPML under **WPML → String Translation** in the *Searcio* domain.

## 6. Fine-tune search relevance (optional)

Go to **Searcio → Search Config** to control which fields are searched and how heavily, per-type ranking boosts, which fields become filters (facets) or autocomplete suggestions, and synonyms. This data lives on Searcio's side, so changes take effect on the very next search - see [`configuration.md`](configuration.md#search-config) for the full reference.
