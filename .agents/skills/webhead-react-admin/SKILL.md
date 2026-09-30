---
name: webhead-react-admin
description: "Use this skill when changing React admin screens, WordPress DataViews tables, asset loading, block-editor sources, REST/UI contracts, JavaScript package manifests, or translations in webhead Search Cloud."
license: MIT
metadata:
  author: webhead
---

# webhead React Admin

This plugin includes a React admin surface. Treat the PHP asset loader, localized settings payload, REST integration, and JavaScript entrypoint as one connected contract.

## Source Paths

- `includes/Admin/Settings_Page.php` registers the admin screen, enqueues assets, and localizes runtime config.
- `includes/Settings/Plugin_Settings.php` defines the settings schema that the UI and REST layer reuse.
- `src/components/Default/index.js` and `src/components/Default/default.scss` define shared card variants and admin shell tokens.
- `src/components/Default/frontend-reset.scss` defines the scoped reset for frontend-only React surfaces that render WordPress components outside wp-admin.
- `src/admin/settings/index.js` boots the settings surface.
- `src/admin/settings/components/SettingsPanel.js` owns the settings shell.
- `src/admin/settings/components/tabs/SettingsGroupTab.js` owns settings field cards and second-level card styling.
- `src/settings/store/context.js` and `src/settings/store/provider.js` own the React settings data flow.

## Rules

Component choice, design tokens, cards, tabs, typography, elevation, radius, layout, saving,
errors, destructive actions and motion live in `webhead-design-system`. **Read it before writing
any admin UI.** What follows is only what is specific to this plugin's React surfaces.

- Treat PHP asset registration, localized config, REST endpoints, settings schema, and React consumers as one contract.

Settings tabs and field order come from PHP, not from the React. `SettingsGroupTab` renders whatever the schema sends and never names a setting, so the only way to place a field is `section:` on `#[Setting]` plus a `sections()` map on the settings provider for the translated tab titles. Do not hard-code setting names in the generated React to reorder or group them: that file is written once and `composer framework:update` will not refresh it.
- Use WordPress packages for React primitives, components, API access, and DataViews.
- Wrap every React admin root in `ThemeProvider` from `@wordpress/theme` with `isRoot` and the webhead primary, and import `@wordpress/theme/design-tokens.css` from the shared default entry. The webpack config must bundle `@wordpress/theme` and its subpaths rather than externalizing them, and keep CSS/SCSS side-effectful, or the tokens become an unregistered style handle and every `--wpds-*` silently resolves to nothing.
- Use `@wordpress/dataviews` for admin tables and list-style datasets instead of custom table markup.
- Do not use the WordPress `Grid` component in generated admin surfaces. Use `src/components/Layout/Grid` for responsive grid layouts. Prefer the simple props first: `auto` for responsive auto-fit columns, `columns` or `templateColumns` for explicit templates, `gap`/`rowGap`/`columnGap` for spacing, `align`/`justify` for alignment, `areas` for named areas, and `Grid.Item` for item placement.
- Use `src/components/Layout/Flex` for responsive flex layouts. Prefer `Flex.Block` for growing content regions, `Flex.Item` for fixed or explicitly sized items, and simple props such as `direction`, `wrap`/`noWrap`, `gap`, `align`, `justify`, `center`, and `expanded` before writing layout CSS.
- Add optional framework-owned React components with `wh-plugin components:add grid`, `wh-plugin components:add flex`, `wh-plugin components:add layout`, `wh-plugin components:add modal`, or `wh-plugin components:add page` instead of copying component files by hand. Document every future framework-owned component with the same shape: purpose, install command, import path, props, composition, accessibility, design-system tokens, examples, and tests.
- Keep DataViews search, filters, sorting, and pagination server-driven. Map the view state to REST/server query parameters and return paginated results.
- Declare column widths **and** clamp the cell content — two separate steps, and doing only the first looks worse than doing neither. `styles` lives on `view.layout`, not on the field, and is `Record<fieldId, { width, minWidth, maxWidth }>`. With no `styles`, the column holding the longest string swallows the table: measured at 585px for a description column, with the table running 327px past its container. Adding `maxWidth` caps the column but not the text, which then renders across the neighbouring columns; clamp `.dataviews-view-table__cell-content-wrapper` with `overflow: hidden`, `overflow-wrap: anywhere` and a line clamp. Then check that `document.documentElement.scrollWidth` does not exceed `clientWidth` — the table may scroll inside its own frame, the page may not.
- When a DataViews table exposes item actions, include and verify at least one `supportsBulk: true` action for the dataset if bulk operations make sense. Bulk callbacks receive the selected items array and must route real writes through server endpoints with capability checks.
- Render icons in selected DataViews field headers with the field `header` property when the icon clarifies a column such as status, owner, date, or media. Keep item title fields textual, visible, and searchable unless the item type itself requires an inline title affordance.
- Persist each DataViews `view` object in browser storage with a plugin/screen/table-scoped key so Appearance, layout, visible fields, density, per-page, sort, filters, and search survive reloads for that browser. Merge stored state with the current default view instead of replacing defaults wholesale.
- Always define DataViews `defaultLayouts` explicitly for every supported layout you expose, including `table`, `grid`, `list`, and `activity` when the dataset needs layout testing. For datasets without media, set `showMedia: false` in both the default view and every non-table layout config and omit `mediaField`; if the current DataViews grid still emits `.dataviews-view-grid__media--placeholder`, hide only that empty media wrapper inside a no-media wrapper class, do not hide `.dataviews-view-grid__media-actions`, and reserve title inline space so selection checkboxes and actions cannot overlap titles. For datasets with media, define a real `mediaField`, set `showMedia: true`, and verify the image/icon renders before metadata in grid/list/activity layouts.
- Use header shortcut/copy affordances for generated shortcode-like tokens: place the shortcode in the trailing area of `Card.Header` with an adjacent copy `Button` wired through `useCopyToClipboard`; do not replace that pattern with an unrelated refresh/action button.
- Do not write browser-only JavaScript filters for server datasets.
- Do not resize or restyle the DataViews search field with product CSS. Keep the extracted `dataviews.css` stub in sync with the installed `@wordpress/dataviews/build-style/style.css` output whenever the package version changes.
- Set `filterBy: false` for fields that only render links, badges, navigation, or decorative content.
- Wrap each generated React admin root in `ThemeProvider` from `@wordpress/theme` with `isRoot` before using `--wpds-*` tokens, and import `@wordpress/theme/design-tokens.css` from the shared default entry. The generated webpack config must bundle `@wordpress/theme` and its subpaths instead of externalizing them, and keep CSS/SCSS rules side-effectful so package metadata cannot tree-shake design-token CSS. WordPress 7 registers the `wp-theme` handle without a public `ThemeProvider` export, and CSS package imports can otherwise become unregistered style handles.

## Delivery

1. Update the PHP side first: menu registration, asset enqueueing, localized config object, and permissions.
2. Update the settings schema second: `includes/Settings/Plugin_Settings.php` and related manager usage.
3. Update the React side third: keep the shell in `SettingsPanel.js` and split each tab or major section into its own file.
4. Use `@wordpress/ui` recommended primitives; every `Card.Header` title must use `Card.Title` with the correct semantic `render` heading.
5. Use `@wordpress/dataviews` for admin tables, map search/filter/sort/pagination to REST or server query parameters, and mark decorative fields with `filterBy: false`.
6. Apply the shared card variants by nesting depth: default for top-level cards, dotted for second-level cards, secondary for third-level cards, and grid only for intentional alternate surfaces.
7. Use documented save/submit, destructive-action, Badge, Tabs, Tooltip, form-control, and motion-token patterns instead of local ad-hoc UI behavior.
8. For frontend React surfaces, import `src/components/Default/frontend-reset.scss` only from the frontend entrypoint, mount inside `[data-webhead-frontend-root]`, and enqueue assets only where the UI exists.
9. Run `npm run build`, run the browser smoke check when available, and manually open the changed admin or frontend screen after the change.
