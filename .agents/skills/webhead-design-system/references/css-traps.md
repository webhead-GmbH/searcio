# Restyling a WordPress component without breaking it

Loaded from `webhead-design-system` before overriding the appearance of anything the packages
ship. Every trap below was hit for real, and each looked correct in the source and wrong on the
screen.

**The rule they all come from:** find the property the *package* uses, override that one, and
cover every state the package styles — not just the resting one.

## Restyling a `Button` — the three traps, all of which were hit

**1. The ring is a `border`, not a shadow.** `.components-button` ships
`border: 1px solid transparent` and `.is-secondary` colours it with the admin
accent. An `inset` box-shadow does not replace that border — it draws a *second*
ring inside it. The header buttons carried a white shadow ring sitting inside the
package's green border, and the green was plainly visible. Set `border-color`.

**2. One state is never enough.** The package sets that colour again in five
separate rules:

```css
.components-button.is-secondary                          { border-color: <accent>; }
.components-button.is-secondary:hover:not(…)             { border-color: <accent-darker-20>; }
.components-button.is-secondary:focus:not(:active)       { border-color: <accent>; }
.components-button.is-secondary:active:not(:disabled)    { border-color: transparent; }
.components-button.is-secondary:disabled:not(:focus)     { border-color: <disabled grey>; }
```

Each of those beats a base-only override, so the accent reappears the moment the
pointer arrives. The same is true of `color`: `.is-secondary:hover` sets it to
the accent, which is how the filled button ended up with dark green text on a
dark green background. **Restate `color` and `border-color` in every state you
own** — hover, `focus:not(:active)`, and active at minimum.

**Disabled and busy are states too, and they are the ones that get forgotten.** The package styles
both for a *light* surface, so on a dark header they are actively wrong:

```css
.components-button:disabled                       { color: #949494; }
.components-button.is-secondary:disabled:not(:focus) { border-color: #dbdbdb; }   /* (0,4,0) */
.components-button.is-busy                        { background-image: linear-gradient(-45deg, #fafafa …, #e0e0e0 …); }
```

The `border-color` rule outranks a three-class base rule while the `color` rule only ties it, so
half the disabled styling lands and half does not: a disabled action kept a bold white label inside
a light grey ring — reading as a rendering fault rather than as disabled. And `isBusy` scrolled
near-white diagonal stripes across a black header, because `.is-busy` animates a `background-image`
that a `background` shorthand elsewhere had already erased. Own both states explicitly, matching the
package's specificity (`:disabled:not(:focus)`, `[aria-disabled="true"]:hover:not(:focus)`), and
restate `background-image`/`background-size` rather than the shorthand.

**3. Focus is an `outline`, and its colour variable depends on which build is
running.** `box-shadow: none` does not touch it. But there are two builds of this
package on a WordPress site, and they read different variables:

```css
/* node_modules/@wordpress/components — what package.json pins */
outline: … solid var(--focus-color, var(--wpds-color-stroke-focus, …));
/* the `wp-components` handle WordPress core enqueues — what actually renders */
outline: … solid var(--wpds-color-stroke-focus, …);
```

**Core's build is the one on the page.** Setting only `--focus-color` — which is
what the pinned package's source says to set — changed nothing on screen. Set
both variables on the container. And note the failure shape: the pinned package
is the right place to check a *prop or export*, but for CSS that core also ships,
check what the browser actually applied.

## The wp-admin `h1` trap

The header's `h1` lives inside `.wrap`, and wp-admin styles it directly:

```css
.wrap h1 { font: 23px/1.3 …; padding: 9px 0 4px; }
```

A single class loses that specificity battle, so the rule has to be scoped
through the header (two classes), **and the padding has to be zeroed explicitly**.
Declaring only `margin: 0` leaves wp-admin's `9px 0 4px` in place — which is
exactly what happened, and the title sat 13px lower than everything beside it.
The same applies to the description `p`. When something in an admin screen
renders at a size or spacing nothing in your stylesheet asked for, look for the
wp-admin rule on the bare element before adding a token.

## Let the Card be a Card

`Card.Root` already draws its own border, radius and surface, and `Card.Header` and `Card.Content`
already pad themselves. **Do not restate any of it.** Everything below was written over the top of
the component and every line of it was wrong:

```scss
.card        { border: 1px solid …; background: …; }  // Card.Root draws both already
.card__header { padding: …; border-bottom: 1px solid …; }  // it pads itself; there is no separator
.card__content { padding: …; }                             // it pads itself
```

The padding one is the trap, because it looks harmless — the same token, the same value. Here is
what the component actually does:

```css
.header, .content     { padding: var(--wp-ui-card-padding); }   /* = --wpds-dimension-padding-2xl */
.header + .content    { padding-block-start: 0; margin-block-start: calc(gap-xl - padding); }
```

The second rule is the card's vertical rhythm: the content's *top* padding is deliberately removed
where it meets a header. Restating `padding` as a shorthand puts it back, and every card carries a
block of dead space between its header and its content. Measured on the settings screen: **24px with
the rule, 0px without it.**

And it wins that easily for a reason worth remembering: **`@wordpress/ui` ships inside
`@layer wp-ui`, so an unlayered rule beats a layered one no matter how specific either is.** There is
no specificity battle to lose. Any property you name on a `@wordpress/ui` element overrides the
component outright, so name only what you are genuinely changing.

**`Card.Header` has no rule under it.** The line separating a header from its content is not part of
the design system — check the [Card docs](https://wordpress.github.io/gutenberg/?path=/docs/design-system-components-card--docs)
before adding chrome the component does not ship.
