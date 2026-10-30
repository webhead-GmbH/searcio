---
name: webhead-elementor-widgets
description: "Use this skill when changing Elementor widget registration, widget controls, live preview templates, widget style controls, responsive controls, or Elementor-specific asset loading in Searcio - Fast AI Product Search for WooCommerce."
license: MIT
metadata:
  author: webhead
---

# webhead Elementor Widgets

Elementor widgets need matching frontend output, editor preview behavior, scoped assets, and complete style controls.

## How Widgets Are Registered

- Name each widget in `register_elementor()` in `includes/Plugin.php`: `$elementor_manager->register_widget( My_Widget::class )`. Name it by class and never build it: a widget extends an Elementor class and cannot be loaded on a site without Elementor.
- Widgets live in `includes/Elementor/Widgets/` and extend `Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Elementor\Widget`, which extends Elementor's `Widget_Base`. The file may use Elementor classes freely; nothing else in the plugin refers to it except by `::class`.
- Elementor builds widget objects itself, so a widget takes no constructor arguments. Inside it use `$this->service( Some_Service::class )` for a service from the plugin's container, `$this->plugin()` for the plugin, and `$this->is_editing()` for "the editor or its preview".
- Widgets are listed under a panel category of the plugin's own. `register_elementor()` runs while the plugin boots, before translations are loaded, so give a translated title as a closure: `$elementor_manager->set_category( static fn (): string => __( 'My Plugin', 'searcio' ), 'eicon-plug' )`.
- Name a widget's assets as webpack entries in `style_entries()` (stylesheet only) or `asset_entries()` (script with its stylesheet). Elementor then loads them on the pages that use the widget and nowhere else. Do not enqueue from `render()`. If a shared renderer also serves a shortcode or a block, let it enqueue for those and tell it not to for the widget.
- `includes/Elementor/Widgets/Example_Widget.php` is a reference scaffold. Its registration is commented out until it is replaced with a real widget and tests.

## Rules

- Register widgets only after Elementor is loaded, and keep registration behind the framework hook layer, which `register_elementor()` is.
- Implement `render()` for frontend output. Implement `content_template()` as well when the editor can rebuild the same markup from the control values alone, so the preview reacts immediately when a control value changes. Leave `content_template()` out when `render()` shows something the editor's JavaScript cannot know, such as rows from the database: Elementor then asks the server to render the widget again whenever a control changes.
- `render()` escapes with `esc_html()`, `esc_attr()` and `esc_url()`. `content_template()` prints with `{{ }}`, which escapes; `{{{ }}}` does not and is only for markup the widget built itself.
- Keep controls organized in logical Content and Style sections. Separate style controls by widget part so users can style headings, body copy, media, buttons, wrappers, and states independently.
- Use Elementor style control tabs for stateful styling: at minimum Normal and Hover for interactive colors, and Active when the widget has a selected/current state.
- Use responsive Elementor controls for padding, margin, width, gap, alignment, typography, and sizing whenever the value affects layout at different breakpoints.
- Use `selectors` with `{{WRAPPER}}` for style controls so the editor preview updates without custom JavaScript when Elementor can handle it. Do not also print the same value as an inline style: an inline style wins over Elementor's stylesheet at every breakpoint, so the tablet and mobile values stop applying.
- Escape and sanitize all PHP-rendered values, translate labels/descriptions, and keep widget settings compatible with multisite and optional plugin dependencies.
- Enqueue widget frontend assets only when the widget is present. Enqueue editor-only assets only in Elementor editor/preview contexts.
- When an Elementor widget renders WordPress React components on the frontend, import WordPress package CSS before the generated frontend reset and verify Elementor/Hello styles do not alter WordPress buttons, tabs, DataViews search inputs, filter controls, checkboxes, radios, text inputs, textareas, selects, focus rings, or component radii.
- Verify portalled WordPress UI from the widget too: DataViews Appearance panels, layout menus, dropdowns, combobox lists, popovers, and action menus must keep WordPress styling even though they render outside the widget root.
- Verify the widget in the Elementor editor and on the frontend after changes. Check responsive breakpoints, live preview updates, keyboard navigation, contrast, accessible names, and normal/hover/active/pressed/selected/disabled/focus-visible states for every rendered WordPress component.

## Testing

- `tests/Integration/Elementor/Example_Widget_Test.php` shows the pattern: create the widget through `\Elementor\Plugin::$instance->elements_manager->create_element_instance()`, call `print_element()` inside an output buffer, and assert on the markup, escaping first.
- The integration suite installs its database from scratch, so no plugin is active in it. `tests/Integration/bootstrap-extra.php` loads Elementor; without that every Elementor test skips.
- For an end-to-end spec, open `post.php?post=<id>&action=elementor`, wait for `window.elementor.loaded`, change a control with `$e.run( 'document/elements/settings', { container, settings } )`, and assert on the preview iframe.

## Verification

- Run affected PHPUnit tests and lint changed PHP widget files.
- Build frontend/editor assets after JavaScript or style changes.
- Open the Elementor editor, change each important control, and confirm the preview updates immediately.
- Check the frontend page where the widget is used, including mobile and tablet widths.
