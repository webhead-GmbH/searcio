---
name: webhead-plugin-quality
description: "Use this skill when checking WordPress plugin quality in webhead Search Cloud: security, escaping, capabilities, translations, Site Health, diagnostics, release packaging, plugin-check, and operational safety."
license: MIT
metadata:
  author: webhead
---

# webhead Plugin Quality

Use this before finalizing changes that affect WordPress runtime behavior, release output, translations, security, support diagnostics, or operational safety.

## WordPress Quality Rules

- Escape every dynamic output for its final HTML, attribute, URL, JavaScript, or text context.
- Sanitize and validate input at the boundary.
- Use plugin capability constants instead of scattering raw `manage_options`.
- Keep public REST routes intentional and explicit.
- Keep diagnostics and command execution support-only, allowlisted, timeout-limited, and output-limited.
- Keep plugin-owned database cleanup behind `Database_Manager`, registered `Table` classes, `Uninstall_Manager::register_database_tables_cleanup()`, and `Uninstall_Manager::register_metadata_cleanup()` instead of raw `$wpdb` cleanup SQL in plugin bootstrap files.
- Keep plugin-owned filesystem writes under approved roots and handle failure results.
- Keep cache keys scoped and grouped through the framework cache facade.
- Keep Site Health tests and diagnostics aligned with runtime behavior.

## Translations

- Keep the text domain `webhead-search-cloud` consistent.
- Update `languages/script-translation-map.json` when JavaScript source paths move.
- Exclude AI skill folders, tests, docs, dependencies, and generated assets from POT generation.

## Release Checks

- Release packages should ship `includes/Dependencies`, not `vendor/webhead/wp-plugin-framework`.
- Do not ship `node_modules`, tests, local agent guidance folders, or generated development caches.
- Run Plugin Check before release when scaffolded plugin code or runtime behavior changed.
