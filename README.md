<p align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset=".github/assets/searcio-dark.svg">
        <img alt="Searcio" src=".github/assets/searcio-light.svg" width="300">
    </picture>
</p>

<h1 align="center">Searcio - Fast AI Product Search for WooCommerce</h1>

<p align="center">
	Connect WordPress and WooCommerce to <strong>Searcio</strong> - a fast, hosted search service - and give visitors an instant, full-screen search experience for your posts, pages, and products.
</p>

<p align="center">
	The plugin indexes your content into Searcio, keeps it in sync as content changes, and renders a client-side search modal (via a Gutenberg block or an Elementor widget) that searches, filters, and displays results without a page reload.
</p>

<p align="center">
    <a href="https://github.com/webhead-GmbH/searcio/releases/latest"><img alt="Plugin version" src="https://img.shields.io/badge/plugin-v1.3.1-blue?style=for-the-badge"></a>
    <img alt="Required WordPress version" src="https://img.shields.io/badge/wordpress-%3E%3D6.8-blue?style=for-the-badge&logo=wordpress&logoColor=white">
    <img alt="Tested up to WordPress version" src="https://img.shields.io/badge/tested_up_to-wordpress_7.1-green?style=for-the-badge&logo=wordpress&logoColor=white">
    <img alt="Required PHP version" src="https://img.shields.io/badge/php-%3E%3D8.3-blue?style=for-the-badge&logo=php&logoColor=white">
</p>

## Features

- **Full-screen search modal** - a fast, keyboard-friendly overlay with search-as-you-type, autocomplete suggestions,
  recent and popular searches, and an empty-state highlights carousel.
- **Faceted filtering** - filter results by content type and by any field you've configured as a facet (category, tags,
  and so on), with a minimum/maximum for numeric fields such as price or rating. The filters sit in one bar under the
  search field and apply as they are picked, in a popover, a side drawer or, on a phone, a sheet.
- **WooCommerce support** - indexes products with price, stock status, categories, tags, ratings, and variations; result
  cards show formatted prices, sale badges, and stock status.
- **Gutenberg block and Elementor widget** - the same search experience, fully themeable (colors, radius, typography,
  spacing) from either editor, with no code required.
- **Server-designed result cards** - optionally use card templates designed in the Searcio dashboard instead of the
  plugin's built-in card layout.
- **Configurable indexing** - choose which post types and WooCommerce products to index, and map custom fields,
  taxonomies, and built-in properties to searchable data.
- **Search relevance control** - tune searchable fields and weights, per-type ranking boosts, facet and suggestion
  fields, and synonyms - all from Searcio's own configuration, editable from the plugin's admin screen.
- **AI Assistant** - a chat tab that answers in prose and shows the products it is talking about, with a table to
  compare them.
- **Search by photo** - shoppers upload a photo instead of typing; a vision model describes it and searches for that.
- **Guided quiz** - a few questions that narrow the catalogue down for shoppers who know what they want but not what it
  is called.
- **Search redirects** - send well-known terms straight to a page instead of showing results.
- **Similar products** - a "you may also like" row on product pages, matched by meaning rather than by shared tags.
- **Category merchandising** - curate a category listing: pin products to the top, keep products out, show a banner.
- **Multilingual (WPML / Polylang)** - optionally restrict indexing and search to specific languages; visitors only see
  results in their current language.
- **Background sync** - a resumable, batched sync engine keeps your index up to date automatically, plus an incremental
  sync that pushes edits shortly after they happen. A sync that cannot reach Searcio tries again by itself. Full
  sync history, pause/resume/cancel controls, and retention settings are all available from the dashboard.
- **WP-CLI support** - run and monitor syncs from the command line for real system-cron setups.

The AI Assistant, search by photo and the quiz appear when your Searcio plan and setup include them.

## Requirements

- WordPress 6.8 or later
- PHP 8.3 or later
- A [Searcio](https://searcio.com) account - one is created for you when you connect, if your email does
  not have one yet
- WooCommerce 8.0+ (optional - only needed to index and search products)
- WPML or Polylang (optional - only needed for multilingual search scoping)

## Installation

1. Install and activate the plugin like any other WordPress plugin. The package is the
   `searcio-<version>.zip` attached to each
   [release](https://github.com/webhead-GmbH/searcio/releases).
2. Go to **Searcio** in the WordPress admin menu. A site that is not connected yet opens on the **Connection**
   tab.
3. Accept the terms and click **Connect to Searcio**. If you already have keys for this site, enter them under
   **Advanced: manual key entry** instead.
4. Open the **Indexing** tab and choose which content should be searchable.
5. Open the **Sync** tab and start your first sync.
6. Add the **Searcio Search** block to a page (or the **Searcio Search** widget in Elementor) to place the search trigger
   anywhere on your site.

See [`docs/installation.md`](docs/installation.md) for a more detailed walkthrough.

## Documentation

- [Installation & setup](docs/installation.md)
- [Configuration reference](docs/configuration.md) - every setting, tab by tab
- [Multilingual support](docs/multilingual.md) - WPML / Polylang behavior
- [Frequently asked questions](docs/faq.md)
- [Developer guide](docs/developers.md) - architecture, REST API, WP-CLI, database tables, testing, translations,
  releasing, and contributing
- [Changelog](CHANGELOG.md)

## License

GPL-3.0-or-later
