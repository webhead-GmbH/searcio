---
name: webhead-elementor-widgets
description: "Use this skill when changing Elementor widget registration, widget controls, live preview templates, widget style controls, responsive controls, or Elementor-specific asset loading in webhead Search Cloud."
license: MIT
metadata:
  author: webhead
---

# webhead Elementor Widgets

Elementor widgets need matching frontend output, editor preview behavior, scoped assets, and complete style controls.

## Rules

- Register widgets only after Elementor is loaded, and keep registration behind the framework hook layer.
- Implement both `render()` for frontend output and `content_template()` for Elementor editor preview. The editor preview must render the widget and react immediately when a control value changes.
- Keep controls organized in logical Content and Style sections. Separate style controls by widget part so users can style headings, body copy, media, buttons, wrappers, and states independently.
- Use Elementor style control tabs for stateful styling: at minimum Normal and Hover for interactive colors, and Active when the widget has a selected/current state.
- Use responsive Elementor controls for padding, margin, width, gap, alignment, typography, and sizing whenever the value affects layout at different breakpoints.
- Use `selectors` with `{{WRAPPER}}` for style controls so the editor preview updates without custom JavaScript when Elementor can handle it.
- Escape and sanitize all PHP-rendered values, translate labels/descriptions, and keep widget settings compatible with multisite and optional plugin dependencies.
- Enqueue widget frontend assets only when the widget is present. Enqueue editor-only assets only in Elementor editor/preview contexts.
- When an Elementor widget renders WordPress React components on the frontend, import WordPress package CSS before the generated frontend reset and verify Elementor/Hello styles do not alter WordPress buttons, tabs, DataViews search inputs, filter controls, checkboxes, radios, text inputs, textareas, selects, focus rings, or component radii.
- Verify portalled WordPress UI from the widget too: DataViews Appearance panels, layout menus, dropdowns, combobox lists, popovers, and action menus must keep WordPress styling even though they render outside the widget root.
- Verify the widget in the Elementor editor and on the frontend after changes. Check responsive breakpoints, live preview updates, keyboard navigation, contrast, accessible names, and normal/hover/active/pressed/selected/disabled/focus-visible states for every rendered WordPress component.

## Verification

- Run affected PHPUnit tests and lint changed PHP widget files.
- Build frontend/editor assets after JavaScript or style changes.
- Open the Elementor editor, change each important control, and confirm the preview updates immediately.
- Check the frontend page where the widget is used, including mobile and tablet widths.
