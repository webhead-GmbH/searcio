# Codex Instructions

This repository was scaffolded with the webhead WordPress Plugin Framework. Use `AGENTS.md` as the top-level guide, then read the framework-specific context before making changes.

## Required Context

- Read the relevant skill files in `.agents/skills/` at the start of each task.
- Start with `.agents/skills/webhead-plugin-architecture/SKILL.md` when the task touches PHP runtime structure.
- Use `.agents/skills/webhead-plugin-testing/SKILL.md` for every behavior change.
- Use `.agents/skills/webhead-frontend/SKILL.md` before changing frontend React UI, frontend reset CSS, conditional frontend asset loading, responsive behavior, or accessibility.
- Use `.agents/skills/webhead-elementor-widgets/SKILL.md` before changing Elementor widget controls, live preview templates, style tabs, responsive controls, or widget asset loading.
- Use the existing plugin structure and sibling files as the source of truth for naming and placement.
- Write the company/brand name as `webhead` in lowercase in prose, UI copy, documentation, and generated guidance. Preserve existing case only for code identifiers, PHP namespaces/classes, Composer package names, constants, and third-party proper nouns.

## Quality Gates

- Every behavior change needs an automated test change in the same task.
- Scaffold or generated-code changes need scaffold-output assertions.
- Use DTO/value objects or enums when a reusable data contract, mode, state, or policy appears.
- Do not hard-code browser-only filters for `@wordpress/dataviews`; keep filtering, sorting, and pagination server-side.
