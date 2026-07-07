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

- Treat PHP asset registration, localized config, REST endpoints, settings schema, and React consumers as one contract.
- Use WordPress packages for React primitives, components, API access, and DataViews.
- Use `@wordpress/dataviews` for admin tables and list-style datasets instead of custom table markup.
- Do not use the WordPress `Grid` component in generated admin surfaces. Use `src/components/Layout/Grid` for responsive grid layouts. Prefer the simple props first: `auto` for responsive auto-fit columns, `columns` or `templateColumns` for explicit templates, `gap`/`rowGap`/`columnGap` for spacing, `align`/`justify` for alignment, `areas` for named areas, and `Grid.Item` for item placement.
- Use `src/components/Layout/Flex` for responsive flex layouts. Prefer `Flex.Block` for growing content regions, `Flex.Item` for fixed or explicitly sized items, and simple props such as `direction`, `wrap`/`noWrap`, `gap`, `align`, `justify`, `center`, and `expanded` before writing layout CSS.
- Add optional framework-owned React components with `wh-plugin components:add grid`, `wh-plugin components:add flex`, or `wh-plugin components:add layout` instead of copying component files by hand. Document every future framework-owned component with the same shape: purpose, install command, import path, props, composition, accessibility, design-system tokens, examples, and tests.
- Keep DataViews search, filters, sorting, and pagination server-driven. Map the view state to REST/server query parameters and return paginated results.
- When a DataViews table exposes item actions, include and verify at least one `supportsBulk: true` action for the dataset if bulk operations make sense. Bulk callbacks receive the selected items array and must route real writes through server endpoints with capability checks.
- Render icons in selected DataViews field headers with the field `header` property when the icon clarifies a column such as status, owner, date, or media. Keep item title fields textual, visible, and searchable unless the item type itself requires an inline title affordance.
- Persist each DataViews `view` object in browser storage with a plugin/screen/table-scoped key so Appearance, layout, visible fields, density, per-page, sort, filters, and search survive reloads for that browser. Merge stored state with the current default view instead of replacing defaults wholesale.
- Always define DataViews `defaultLayouts` explicitly for every supported layout you expose, including `table`, `grid`, `list`, and `activity` when the dataset needs layout testing. For datasets without media, set `showMedia: false` in both the default view and every non-table layout config and omit `mediaField`; if the current DataViews grid still emits `.dataviews-view-grid__media--placeholder`, hide only that empty media wrapper inside a no-media wrapper class, do not hide `.dataviews-view-grid__media-actions`, and reserve title inline space so selection checkboxes and actions cannot overlap titles. For datasets with media, define a real `mediaField`, set `showMedia: true`, and verify the image/icon renders before metadata in grid/list/activity layouts.
- Use header shortcut/copy affordances for generated shortcode-like tokens: place the shortcode in the trailing area of `Card.Header` with an adjacent copy `Button` wired through `useCopyToClipboard`; do not replace that pattern with an unrelated refresh/action button.
- Wrap generated roots in `ThemeProvider isRoot color={ { primary: '#319b80' } }` so WordPress Design System interactive tokens, DataViews filters, and portalled controls use the webhead green primary instead of Gutenberg's default blue.
- Do not write browser-only JavaScript filters for server datasets.
- Do not resize or restyle the DataViews search field with product CSS. Keep the extracted `dataviews.css` stub in sync with the installed `@wordpress/dataviews/build-style/style.css` output whenever the package version changes.
- Set `filterBy: false` for fields that only render links, badges, navigation, or decorative content.
- Use `react-content-loader` for known loading layouts instead of spinner-only loading states.
- For WordPress 7+ component migrations, check the Gutenberg Storybook `componentStatus` before choosing a component. Avoid `not-recommended` `@wordpress/components` exports such as `Heading`, `Card`, and `TabPanel`; use `Text`, `Card`, and `Tabs` from `@wordpress/ui` instead. Do not counter wp-admin typography changes by hard-coding admin font sizes in generated CSS.
- Use `Card.Title` inside every `Card.Header`. Set the `render` prop on `Card.Title` for the semantic heading level instead of nesting arbitrary heading markup in the header.
- Use `Text` from `@wordpress/ui` for headings and body copy, with design-system variants such as `heading-xl`, `heading-lg`, `heading-md`, `body-md`, and `body-sm`. Do not introduce custom CSS font sizes for admin typography unless an upstream component contract requires it. For a top-level card title that needs to be larger than nested `Card.Title` text, keep `Card.Title` in `Card.Header` and render a nested `Text variant="heading-xl"` span instead of writing CSS font-size rules.
- Follow WordPress Design System radius and elevation guidance. Use `--wpds-border-radius-xl` for app/page shell cards, `--wpds-border-radius-lg` for content cards and notices, `--wpds-border-radius-md` for popovers/menus/small overlays, and `--wpds-border-radius-sm` for compact controls such as tabs, badges, buttons, and inputs. Cards and grouped content should use `--wpds-elevation-xs`; reserve medium/large elevation for menus, command palettes, dialogs, and modals.
- Use shared webhead card variants by nesting depth: `*-card--dotted` for second-level cards inside another card, `*-card--secondary` for third-level cards inside dotted cards, and `*-card--grid` only for an intentionally distinct alternate card surface.
- Treat WordPress Design System docs as the admin UI contract: prefer token-driven `@wordpress/ui` components, semantic markup, keyboard-accessible controls, and compositional packages such as `@wordpress/dataviews` instead of bespoke markup.
- Use design tokens by purpose: color tokens for semantic foreground/background/stroke states, typography tokens or `Text` variants for text, radius tokens by container size, elevation tokens by layer purpose, spacing tokens for gaps/padding/margins, and motion tokens for duration/easing. Do not set or redefine `--wpds-*` custom properties in plugin CSS, do not use fallback values for `--wpds-*` tokens, and do not invent token names.
- Wrap each generated React admin root in `ThemeProvider` from `@wordpress/theme` with `isRoot` before using `--wpds-*` tokens, and import `@wordpress/theme/design-tokens.css` from the shared default entry. The generated webpack config must bundle `@wordpress/theme` and its subpaths instead of externalizing them, and keep CSS/SCSS rules side-effectful so package metadata cannot tree-shake design-token CSS. WordPress 7 registers the `wp-theme` handle without a public `ThemeProvider` export, and CSS package imports can otherwise become unregistered style handles.
- Standardize vertical rhythm with token gaps instead of ad hoc margins: use `--wpds-dimension-gap-xs` between a card title and its description, `--wpds-dimension-gap-lg` between tabs and tab panels or between related cards, and `--wpds-dimension-gap-xl` between major page sections. `Card.Header` and `Card.Content` padding should use design-system padding tokens and should not collapse adjacent content into each other.
- For motion, map micro-interactions to `--wpds-motion-duration-sm`/subtle easing, menu or popover transitions to duration `md`, and spatial enter/exit transitions to expressive easing. Respect reduced-motion behavior when writing CSS animations.
- For destructive actions, choose the confirmation pattern by risk: no destructive styling for reversible non-visible changes, `ConfirmDialog` for visible but undoable changes with a follow-up undo affordance, and a non-dismissible `Modal` with an `isDestructive` primary button for irreversible actions.
- For save and submit flows, show a busy/loading state while saving, disable the save button when there are no unsaved changes, reveal a "No unsaved changes" tooltip on hover/focus, confirm successful saves with a snackbar/toast pattern, and show validation errors at the first invalid field or a `ConfirmDialog` for failed saves.
- Use `Badge` intent sparingly. Prefer `none` or plain text for normal states, `stable` only when the positive state matters, `draft` for unfinished states, `informational` for context-only states, and `low`/`medium`/`high` only when user attention or action priority truly increases.
- Use higher-level controls or `DataForm` before reaching for low-level form primitives. Only use form primitives for special cases after checking that a `*Control` component or `DataForm` cannot satisfy the UI, and then preserve labels, descriptions, validation, and accessibility manually.
- Use `Tabs.Root`, `Tabs.List`, `Tabs.Tab`, and `Tabs.Panel` for tabbed content, not lists of links. For panel/sidebar tabs, keep the list full-bleed with a light bottom border and labels sized to their text.
- Keep large tab sets responsive with a horizontally scrollable `Tabs.List`, token spacing, visible focus, and desktop/mobile browser checks. Tab strips must not create page-level horizontal overflow, clipped labels, or unscrollable mobile panels.
- Use tooltips only as visual labels for icon-only or dense controls. The trigger must have an accessible name such as `aria-label`; do not hide critical descriptions, status messages, or infotips in tooltips. Use inline help, `Popover`, or `Notice` instead.
- Do not use deprecated `ClipboardButton`; use `useCopyToClipboard` from `@wordpress/compose` with a regular `Button` instead.

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
