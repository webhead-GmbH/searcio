---
name: webhead-react-admin
description: "Use this skill when changing React admin screens, WordPress DataViews tables, asset loading, block-editor sources, REST/UI contracts, JavaScript package manifests, or translations in Searcio - Fast AI Product Search for WooCommerce."
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
- Draw every admin screen with `src/components/AdminPage.js`. The settings screen is drawn by it (`SettingsPanel.js` returns `<AdminPage tabbed>`), so a page that uses it starts where the settings screen starts and is as wide. Do not wrap a screen in a frame of its own, and follow "Adding a page" in `webhead-design-system` (`references/screens.md`) for the PHP class, the registration, the webpack entry and the test a new page needs.

Settings tabs and field order come from PHP, not from the React. `SettingsGroupTab` renders whatever the schema sends and never names a setting, so the only way to place a field is `section:` on `#[Setting]` plus a `sections()` map on the settings provider for the translated tab titles. Do not hard-code setting names in the generated React to reorder or group them: that file is written once and `composer framework:update` will not refresh it.
- Use WordPress packages for React primitives, components, API access, and DataViews.
- More than one element inside a `Card.Content`, a tab panel or a fragment is held by a `Stack` from `@wordpress/ui` with a `gap` token. Nothing else spaces them, and `leaves a gap between everything it stacks` in `tests/e2e/specs/settings-page.spec.js` is the test to copy for a new page.
- Loading states are `Skeleton` from `@wordpress/ui` inside one region marked `role="status"` and `aria-busy`, as `SettingsSkeleton.js` does. Notices are the compound `Notice` from `@wordpress/ui` (`Notice.Root intent="error"`), not the `@wordpress/components` one.
- `webpack.config.js` runs `@wordpress/theme`'s token plugin over every stylesheet: write `var(--wpds-…)` bare, and expect the build to stop with `Unknown design token` on a name the package does not have.
- Wrap every React admin root in `ThemeProvider` from `@wordpress/theme` with `isRoot` and the brand's black (`color={ { primary: '#101010' } }`, the colour `--wh-primary` has in `default.scss`), and import `@wordpress/theme/design-tokens.css` from the shared default entry. The webpack config must bundle `@wordpress/theme` and its subpaths rather than externalizing them, and keep CSS/SCSS side-effectful, or the tokens become an unregistered style handle and every `--wpds-*` silently resolves to nothing.
- Use `@wordpress/dataviews` for admin tables and list-style datasets instead of custom table markup.
- Import the table from `src/components/DataViews`, never from `@wordpress/dataviews`: `import { DataViews } from '../../components/DataViews';`. The module brings the package's stylesheet and the house rules with it. Imported from the package, a table still renders, as wide as its content, with centred headers and nothing to say that a stylesheet is missing; the settings screen used to be the only one that had it.
- Do not use the WordPress `Grid` component in generated admin surfaces. Use `src/components/Layout/Grid` for responsive grid layouts. Prefer the simple props first: `auto` for responsive auto-fit columns, `columns` or `templateColumns` for explicit templates, `gap`/`rowGap`/`columnGap` for spacing, `align`/`justify` for alignment, `areas` for named areas, and `Grid.Item` for item placement.
- Use `src/components/Layout/Flex` for responsive flex layouts. Prefer `Flex.Block` for growing content regions, `Flex.Item` for fixed or explicitly sized items, and simple props such as `direction`, `wrap`/`noWrap`, `gap`, `align`, `justify`, `center`, and `expanded` before writing layout CSS.
- Add optional framework-owned React components with `wh-plugin components:add grid`, `wh-plugin components:add flex`, `wh-plugin components:add layout`, `wh-plugin components:add modal`, or `wh-plugin components:add page` instead of copying component files by hand. `page` also writes `src/utils/animation.js` when the plugin has none, and for `page` and `modal` the command prints the `npm install` line for any package `package.json` lacks; run it before building. Document every future framework-owned component with the same shape: purpose, install command, import path, props, composition, accessibility, design-system tokens, examples, and tests.
- Keep DataViews search, filters, sorting, and pagination server-driven. Map the view state to REST/server query parameters and return paginated results.
- Give every column but the first a width, and clamp a long value through the field's `render`. `styles` lives on `view.layout`, not on the field, and is `Record<fieldId, { width, minWidth, maxWidth }>`; a percentage `width` with a `minWidth` in pixels holds at every screen size. The primary column (`titleField`) takes no style and gets the width the others leave, so a style keyed by it is ignored without a word. A long value goes in `<span className="webhead-search-cloud-cell-clamp">` from the field's `render`: two lines and an ellipsis. Clamping the cell's own wrapper does not work, because DataViews makes it a row that does not wrap through a selector more specific than a class of yours. Then check that `document.documentElement.scrollWidth` does not exceed `clientWidth` — the table may scroll inside its own frame, the page may not.
- When a DataViews table exposes item actions, include and verify at least one `supportsBulk: true` action for the dataset if bulk operations make sense. Bulk callbacks receive the selected items array and must route real writes through server endpoints with capability checks.
- Render icons in selected DataViews field headers with the field `header` property when the icon clarifies a column such as status, owner, date, or media. Keep item title fields textual, visible, and searchable unless the item type itself requires an inline title affordance.
- Persist each DataViews `view` object in browser storage with a plugin/screen/table-scoped key so Appearance, layout, visible fields, density, per-page, sort, filters, and search survive reloads for that browser. Merge stored state with the current default view instead of replacing defaults wholesale, and take `layout.styles` from the code every time: a column width is not a preference, and one stored with the view would keep a later change to it from ever reaching someone who had opened the table before.
- Always define DataViews `defaultLayouts` explicitly for every supported layout you expose, including `table`, `grid`, `list`, and `activity` when the dataset needs layout testing. For datasets without media, set `showMedia: false` in both the default view and every non-table layout config, omit `mediaField`, and put `webhead-search-cloud-dataviews--no-media` on an element around the table: DataViews still draws an empty media box above every grid card, and that class hides it and keeps the title clear of the selection checkbox and the actions button. Do not write that CSS yourself. For datasets with media, define a real `mediaField`, set `showMedia: true`, and verify the image/icon renders before metadata in grid/list/activity layouts.
- Use header shortcut/copy affordances for generated shortcode-like tokens: place the shortcode in the trailing area of `Card.Header` with an adjacent copy `Button` wired through `useCopyToClipboard`; do not replace that pattern with an unrelated refresh/action button.
- Do not write browser-only JavaScript filters for server datasets.
- Do not resize or restyle the DataViews search field with product CSS. `src/components/Default/dataviews.css` is a copy of the package's stylesheet that `composer framework:update` refreshes together with the `@wordpress/dataviews` version; do not edit it.
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
