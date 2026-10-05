# Tokens, elevation and radius

Loaded from `webhead-design-system` when a token name has to be constructed or checked.

## Design tokens

`@wordpress/theme` publishes some 170 `--wpds-*` custom properties in
`node_modules/@wordpress/theme/prebuilt/css/design-tokens.css`. **That file is the authority.**

A name that does not exist **stops the build**, in a stylesheet: `webpack.config.js` runs
`@wordpress/theme`'s `postcss-ds-token-fallbacks` over every stylesheet, which gives each bare
`var(--wpds-*)` the fallback the package generated for it and fails with `Unknown design token`
on a name the package does not have. Outside a stylesheet — a `style` prop, a string in
JavaScript — the same mistake still fails in the quietest way CSS has: the declaration is dropped
and nothing says so.

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
- **Never give a token a fallback.** The build writes the right one. A hand-written one is dead
  code when the name is right, and when it is wrong it is what stops the build from telling you,
  while pinning a value that no longer follows the theme.

`@wordpress/theme` ships a Stylelint rule for each of those three: `plugin-wpds/no-unknown-ds-tokens`,
`plugin-wpds/no-setting-wpds-custom-properties` and `plugin-wpds/no-token-fallback-values`.

The stylesheets this plugin was generated with set a short list of `--wpds-*` properties, each on
purpose. The focus ring on the black page header (`src/components/admin-page.scss`). In
`src/components/Default/default.scss`, what makes black the brand and green the colour of focus
and of links: the fills of a brand and a neutral control with what is written on them, and the
ring and label of an outlined one, because the theme provider's darkest black is a shade lighter
than the accent; the focus ring; and the link colour, on anchors alone. And the same list on the frontend root
(`src/components/Default/frontend-reset.scss`), with the two tints of a selected row. They are
the framework's recorded exceptions. **Do not add another**: needing one is the sign of a gap in
the design system, and that is a question for the person you are working for, not an override.

Beyond colour: `--wpds-dimension-padding-{xs…3xl}` and `--wpds-dimension-gap-{xs…3xl}`;
`--wpds-dimension-size-{5xs…lg}` (4px to 40px) for the size of a control, an icon or a
placeholder; `--wpds-dimension-surface-width-{xs…2xl}` (240px to 960px) for the maximum width of
a layout surface, which is the token for a screen that wants a narrower measure inside the shell;
`--wpds-border-width-{xs,sm,md,lg,focus}`; and `--wpds-cursor-control` for the cursor of a
control that is not a link.

Typography: `--wpds-typography-font-size-{xs…2xl}` with the matching `line-height`, and exactly
two weights — `--wpds-typography-font-weight-default` and `-emphasis`. **Do not write a pixel
font size**; use `Text` variants (`heading-2xl` … `heading-md`, `body-md`, `body-sm`).

Motion: easing `subtle` for hover and colour, `balanced` for on-screen movement, `expressive` for
enter/exit. Duration `xs` micro-delays, `sm` micro-interactions, `md` menus and popovers, `lg`
deliberate reveals, `xl` multi-step. **Honour `prefers-reduced-motion`** — Motion reads it only
through `useReducedMotion`, so an animation that does not ask runs for everyone.

## Elevation — it exists, just not as a `--wpds-*` token

`@wordpress/theme` removed every `--wpds-elevation-*` property, so
`box-shadow: var( --wpds-elevation-xs )` applies **nothing**, and the build now stops on it. The
values live in `@wordpress/base-styles`:

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
