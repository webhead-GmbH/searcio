<p align="center">
    <img alt="Icon" src="icon.png" width="128" height="128">
</p>

<h1 align="center">webhead Search Cloud</h1>

<p align="center">
	Connect WordPress and WooCommerce to **webhead Search Cloud** - a fast, hosted search service — and give visitors an instant, full-screen search experience for your posts, pages, and products.
</p>

<p align="center">
	The plugin indexes your content into Search Cloud, keeps it in sync as content changes, and renders a client-side search modal (via a Gutenberg block or an Elementor widget) that searches, filters, and displays results without a page reload.
</p>

<p align="center">
    <img alt="Plugin version" src="https://img.shields.io/badge/plugin-v1.0.1-blue?style=for-the-badge">
    <img alt="Required PHP version" src="https://img.shields.io/badge/php-%3E%3D8.3-blue?style=for-the-badge&logo=php&logoColor=white">
    <img alt="WordPress tested up version" src="https://img.shields.io/badge/wordpress-v7.0.0_tested-green?style=for-the-badge&logo=wordpress&logoColor=white">
</p>

## Features

- **Full-screen search modal** - a fast, keyboard-friendly overlay with search-as-you-type, autocomplete suggestions,
  recent and popular searches, and an empty-state highlights carousel.
- **Faceted filtering** - filter results by content type and by any field you've configured as a facet (category, price,
  tags, and so on).
- **WooCommerce support** - indexes products with price, stock status, categories, tags, ratings, and variations; result
  cards show formatted prices, sale badges, and stock status.
- **Gutenberg block and Elementor widget** - the same search experience, fully themeable (colors, radius, typography,
  spacing) from either editor, with no code required.
- **Server-designed result cards** - optionally use card templates designed in the Search Cloud dashboard instead of the
  plugin's built-in card layout.
- **Configurable indexing** - choose which post types and WooCommerce products to index, and map custom fields,
  taxonomies, and built-in properties to searchable data.
- **Search relevance control** - tune searchable fields and weights, per-type ranking boosts, facet and suggestion
  fields, and synonyms - all from Search Cloud's own configuration, editable from the plugin's admin screen.
- **Multilingual (WPML / Polylang)** - optionally restrict indexing and search to specific languages; visitors only see
  results in their current language.
- **Background sync** - a resumable, batched sync engine keeps your index up to date automatically, plus an incremental
  drain that pushes edits shortly after they happen. Full sync history, pause/resume/cancel controls, and retention
  settings are all available from the dashboard.
- **WP-CLI support** - run and monitor syncs from the command line for real system-cron setups.

## Requirements

- WordPress 6.0 or later
- PHP 8.3 or later
- A [webhead Search Cloud](https://webhead.at) account with a site connected, to get your search key and write
  credentials
- WooCommerce 8.0+ (optional - only needed to index and search products)
- WPML or Polylang (optional - only needed for multilingual search scoping)

## Installation

1. Install and activate the plugin like any other WordPress plugin.
2. Go to **Search Cloud** in the WordPress admin menu and open the **Connection** tab.
3. Enter the search key, write key, and write secret from your Search Cloud site page, then save.
4. Open the **Indexing** tab and choose which content should be searchable.
5. Open the **Sync** tab and start your first sync.
6. Add the **Search Cloud** block to a page (or the **Search Cloud** widget in Elementor) to place the search trigger
   anywhere on your site.

See [`docs/installation.md`](docs/installation.md) for a more detailed walkthrough.

## Documentation

- [Installation & setup](docs/installation.md)
- [Configuration reference](docs/configuration.md) - every setting, tab by tab
- [Multilingual support](docs/multilingual.md) - WPML / Polylang behavior
- [Frequently asked questions](docs/faq.md)
- [Developer guide](docs/developers.md) - architecture, REST API, WP-CLI, database tables, testing, translations, and
  contributing

## License

GPL-3.0-or-later
