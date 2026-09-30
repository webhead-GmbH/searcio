# Tokens, elevation and radius

Loaded from `webhead-design-system` when a token name has to be constructed or checked.

## Design tokens

`@wordpress/theme` publishes 167 `--wpds-*` custom properties in
`node_modules/@wordpress/theme/prebuilt/css/design-tokens.css`. **That file is the authority.**
A name that does not exist fails in the quietest way CSS has: the declaration is dropped and
nothing says so.

Colour tokens read
`--wpds-color-<property>-<target>-<tone>[-<emphasis>][-<state>]`, where property is
`background | foreground | stroke`, target is `surface` (containers — never clickable parts),
`interactive` (buttons, inputs, links, toggles), `content` (static text and icons), or
`track`/`thumb`; tone is `neutral | brand | success | info | caution | warning | error`; emphasis
is `strong | weak`; state is `active | disabled`.

**There is no `text`, no `border`, and no bare `content-*`.** The names people reach for:

| you will want to write | it is actually |
|---|---|
| `--wpds-color-text-secondary` | `--wpds-color-foreground-content-neutral-weak` |
| `--wpds-color-border-neutral-weak` | `--wpds-color-stroke-surface-neutral` |
| `--wpds-color-background-neutral-strong` | `--wpds-color-background-surface-neutral-strong` |

- **Never redefine a `--wpds-*` property** in plugin CSS, and never invent a name.
- **Never give a token a fallback.** If the name is right the fallback is dead code; if it is
  wrong the fallback is what stops anyone noticing, while pinning a value that no longer follows
  the theme.

Typography: `--wpds-typography-font-size-{xs…2xl}` with the matching `line-height`, and exactly
two weights — `--wpds-typography-font-weight-default` and `-emphasis`. **Do not write a pixel
font size**; use `Text` variants (`heading-2xl` … `heading-md`, `body-md`, `body-sm`).

Motion: easing `subtle` for hover and colour, `balanced` for on-screen movement, `expressive` for
enter/exit. Duration `xs` micro-delays, `sm` micro-interactions, `md` menus and popovers, `lg`
deliberate reveals, `xl` multi-step. **Honour `prefers-reduced-motion`** — Motion reads it only
through `useReducedMotion`, so an animation that does not ask runs for everyone.

## Elevation — it exists, just not as a `--wpds-*` token

`@wordpress/theme` removed every `--wpds-elevation-*` property, so
`box-shadow: var( --wpds-elevation-xs )` applies **nothing**. The values live in
`@wordpress/base-styles`:

```scss
@use "@wordpress/base-styles/variables" as wp-base;

.webhead-search-cloud-card { box-shadow: wp-base.$elevation-x-small; }
```

`$elevation-x-small` for cards and grouped content, `$elevation-small` for tooltips and snackbars,
`$elevation-medium` for menus, `$elevation-large` for modals. A shadow is not decoration, and it is
not how you separate two things that are merely too close — that is spacing's job.

## Radius scales with the box, and never repeats

`--wpds-border-radius-xs` for elements inside controls, `sm` for standalone buttons and inputs,
`md` for menus and popovers, `lg` for cards and notices, `xl` for the page shell.

- **Never nest a larger radius inside a smaller one.**
- **Never give a container and its immediate child the same radius.** The page shell is a surface
  (`xl`); the cards inside it are cards (`lg`).
