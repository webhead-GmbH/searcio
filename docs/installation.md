# Installation & Setup

## Requirements

- WordPress 6.8 or later
- PHP 8.3 or later
- A [webhead Search Cloud](https://searcio.com) account — one is created for you when you connect, if your email does not have one yet
- WooCommerce 8.0 or later (optional, only needed to index and search products)
- WPML or Polylang (optional, only needed for multilingual search scoping — see [`multilingual.md`](multilingual.md))

## 1. Install the plugin

Install the package of a release, `webhead-search-cloud-<version>.zip`, with **Upload Plugin** on the screen where WordPress adds a plugin, or extract it into `wp-content/plugins/webhead-search-cloud`, then activate it.

## 2. Connect to Search Cloud

1. In WordPress, go to **Search Cloud**. A site that is not connected yet opens on the **Connection** tab.
2. Tick **I accept the Terms of Service and Privacy Policy** (required) and, if you want it, **I accept the Data Processing Agreement**.
3. Click **Connect to Search Cloud**.

The site connects with the email address of the site's admin, which the tab names before you click. **Not this email?** lets you enter another address, with your name and a company name; the company name becomes the name of the Search Cloud account. Connecting sends that email address and name, the site's name and address, and your two answers to the consent boxes to Search Cloud.

What happens next depends on the email address:

- **It has no Search Cloud account yet.** One is created, the site is connected at once and its keys are stored for you. The tab shows *Connected* with your document count and this month's usage.
- **It already has a Search Cloud account.** Nothing is created or changed. Search Cloud emails a confirmation link to that address; its owner clicks it and chooses which account the site belongs to. Then come back to the tab and paste the keys the dashboard shows under **Advanced: manual key entry**.

### Entering keys by hand

If the site already exists in your Search Cloud account, skip the button: open **Advanced: manual key entry** on the same tab, paste the **search key** (`sk_...`), **write key** (`wk_...`) and **write secret** from the site's page in the dashboard, and click **Save connection**. **Test connection** then checks the saved credentials and shows your site ID and document usage. A domain that is already connected is not connected a second time by the button; the tab says so and opens this section.

The write key and secret are encrypted at rest and are never sent back to the browser once saved — the field shows a masked placeholder. Leave a masked field blank to keep its current value, or type a new one to rotate it.

## 3. Choose what to index

Go to **Search Cloud → Indexing** and turn on each post type (and WooCommerce products, if active) you want to be searchable. For each enabled type you can:

- pick which built-in property, custom field, or taxonomy powers the title, body text, link, and thumbnail image
- add extra fields (a custom field, taxonomy, or built-in property) under a name of your choice
- include a short excerpt, and include private/password-protected content if needed

Sending a field here makes its data available to Search Cloud. To let visitors actually search *by* a field, also enable it (with a weight) on the **Search Config** tab — see [`configuration.md`](configuration.md).

## 4. Run the first sync

Go to **Search Cloud → Sync** and click **Start sync**. This sends your currently-enabled content to Search Cloud. The sync runs in the background in resumable batches; you can pause, resume, or cancel it, and watch live progress on the same screen.

After the first sync, a scheduled sync runs daily and an incremental sync pushes edits shortly after you save, trash, or delete content — you don't need to manually re-sync for day-to-day edits. See [`developers.md`](developers.md#wp-cli) if you're running WordPress on a real system cron and want to trigger syncs directly.

## 5. Add the search experience to your site

Add the **Search Cloud** block to any page or template in the block editor, or the **Search Cloud** widget if you use Elementor (both widgets are listed under *webhead Search Cloud* in Elementor's panel). Both offer the same options:

- **Trigger style** — an icon button or a full search box
- **Restrict to type** — scope this instance to one content type, or leave it open to all indexed types
- **Card source** — the plugin's own built-in result card, or a template you've designed in the Search Cloud dashboard
- Full color, spacing, radius, and typography controls for every part of the modal (trigger, input, buttons, facets, result cards, carousel)

Multiple instances can exist on the same site with different settings — for example, an icon in the header scoped to everything, and a search box on a landing page scoped to one content type.

## 6. Fine-tune search relevance (optional)

Go to **Search Cloud → Search Config** to control which fields are searched and how heavily, per-type ranking boosts, which fields become filters (facets) or autocomplete suggestions, and synonyms. This data lives on Search Cloud's side, so changes take effect on the very next search — see [`configuration.md`](configuration.md#search-config) for the full reference.
