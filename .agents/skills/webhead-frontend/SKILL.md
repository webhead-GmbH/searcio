---
name: webhead-frontend
description: "Use this skill when changing frontend React surfaces, frontend asset loading, frontend component reset styles, shortcodes/blocks that mount React UI, responsive behavior, or frontend accessibility in webhead Search Cloud."
license: MIT
metadata:
  author: webhead
---

# webhead Frontend

Frontend UI can run inside aggressive theme, page-builder, and Elementor CSS. Treat frontend rendering, scoped reset CSS, asset loading, responsiveness, and accessibility as one contract.

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

- Build frontend UI with WordPress React and WordPress component packages. PHP should render only the mounting container, data attributes, and fallback content when needed; do not hand-build the interactive UI as raw static HTML.
- Wrap frontend React roots in `ThemeProvider` from `@wordpress/theme`, import `@wordpress/theme/design-tokens.css`, import WordPress package styles such as `@wordpress/components/build-style/style.css` and `@wordpress/dataviews/build-style/style.css` before the scoped reset, and import `src/components/Default/frontend-reset.scss` from the frontend entrypoint that owns the UI.
- Keep webpack configured so package CSS imports are bundled, not emitted as script dependencies such as `wp-components/build-style/style.css` in `bundle.*.asset.php`.
- Mount frontend apps inside a scoped root such as `<div data-webhead-frontend-root>` so reset rules cannot leak into the theme or other plugins.
- Keep `frontend-reset.scss` unlayered. Do not wrap it in `@layer`; Elementor, themes, and page builders usually emit unlayered CSS that would outrank layered reset rules.
- Use scoped, non-zero-specificity reset selectors under `[data-webhead-frontend-root]` for WordPress component primitives that themes commonly override: `.components-button`, `[role='tab']`, `.components-search-control input[type='search']`, `.dataviews-search input[type='search']`, DataViews filter combobox inputs, component text/select/textarea/range/number controls, checkbox controls, radio controls, and DataViews filter selection controls. Do not use global selectors or `!important`.
- WordPress popovers, dropdowns, menus, and DataViews Appearance panels can render through portals outside the frontend root. Scope their reset with `body:has([data-webhead-frontend-root])` and target only WordPress component overlays such as `.components-popover__content` and `[role='menu'][data-open='true']`; do not add unscoped body-wide resets.
- Do not add generic frontend rules such as `svg { display: block; }` inside the reset. WordPress UI components may render decorative SVGs that are intentionally hidden by package CSS, such as `Tabs.Tab` chevrons.
- The reset may neutralize hostile theme/page-builder borders, radii, shadows, text transforms, and button appearance, but it must not resize DataViews search fields or replace WordPress component styling with bespoke product CSS.
- Enqueue frontend JavaScript and CSS only on pages where the design exists: block render callback, shortcode callback, widget render path, or a similarly precise detector. Do not enqueue frontend bundles globally.
- Recheck frontend screens in a real browser after every UI change because themes, Elementor, WooCommerce, and caching plugins can override component CSS. Verify normal, hover, active/pressed, selected, disabled, and focus-visible states for buttons, tabs, DataViews controls, search/filter controls, checkboxes, radios, text inputs, textareas, selects, range/number controls, notices, and layout components.
- Verify responsive behavior at desktop, tablet, and mobile widths. The page must not introduce horizontal overflow, clipped controls, overlapping text, broken focus outlines, or unscrollable panels.
- Accessibility must be treated as a release gate: keyboard navigation, visible focus, semantic labels, control descriptions, color contrast, reduced-motion behavior, and screen-reader names should reach a 100% automated audit where the project has an a11y runner.
- Keep data-backed frontend lists server-driven. JavaScript may map view state to REST query parameters, but search, filtering, sorting, and pagination should not be performed only in the browser for server datasets.
- Use plugin-specific REST namespaces, nonces, capability checks, escaping, sanitization, and translation functions exactly as in admin surfaces.

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

## Verification

- Run the affected PHP and JavaScript tests.
- Run `npm run build` after frontend asset changes.
- Open the exact frontend page that contains the design in a browser, not just wp-admin.
- Capture or inspect desktop and mobile screenshots when changing layout, reset CSS, or component composition.
- Run an accessibility audit when available and fix failures instead of documenting them as known issues.
