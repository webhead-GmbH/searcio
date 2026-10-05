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

**What the Card does not do is space its content.** `Card.Content` is a block with padding and no
`gap`. Leaving the padding alone is half of it; the other half is that two children of one
`Card.Content` touch unless a `Stack direction="column"` with a `gap` token holds them. The fix is
never a margin on the child and never a `gap` written onto `Card.Content` (that is restating the
component again): it is the `Stack`.

`Card.FullBleed` is the supported way to let one child reach the card's edges — a table, an
image. Do not cancel the padding with a negative margin of your own.

## Icons are drawn with strokes now

`@wordpress/icons` 16 and 17 redrew some 270 icons as strokes. They are no longer filled shapes,
and the old way of colouring an icon does nothing to them:

```scss
.thing svg { fill: white; }    // a stroke icon ignores it — it carries `fill: none` inline
.thing     { color: white; }   // this colours it: the stroke is `currentColor`
```

- **Colour an icon with `color`** on the icon or on what holds it. Keep a `fill` rule beside it
  only for the icons that are still filled, and expect it to do nothing for the rest.
- **The inline `fill: none` beats any stylesheet rule**, so a `fill` you add cannot turn a stroke
  icon into a blob — and cannot recolour it either.
- **Strokes do not scale with the box.** An icon rendered larger keeps its line weight, so a 48px
  icon looks lighter than a 24px one. Size icons through the component's `size`.

## An accent is two colours

`src/components/Default/default.scss` makes the accent of a `@wordpress/components` control black
through `--wp-components-color-accent`. What is written **on** an accent — a primary button's
label, the tick of a checked box — is a second property, `--wp-components-color-accent-inverted`,
and `ThemeProvider` sets it from its own ramp: the foreground that reads on the primary colour it
was given, which was the house green then.

`@wordpress/theme` 2.0 answered `#fff`. 2.2 answers `#0e100f`, which is right on that green and
unreadable on black: every primary button was `#0e100f` on `#101010`, with no change in the
plugin. `default.scss` sets both colours now, and the shell repeats the label.

- **Whoever sets an accent sets its label.** If you change `--wh-primary`, check what is written
  on it.
- **Measure a button enabled.** A disabled button has a colour of its own, so a Save button that
  is disabled until something changes hides this until someone edits a field.

## Where a colour has to be set to arrive

Black is the brand and green is for focus and for links, and `default.scss` says so in a few
rules. Each of them is where it is for a reason that cannot be seen by reading it:

- **A theme provider writes its values inline, on `<html>` (`isRoot`) and on its own element.**
  A custom property set on the root of a screen never arrives: the provider's element is below
  it. Set it on `.panel-container`, which is inside the provider, and on `body` for what is drawn
  outside the screen.
- **WordPress sets `--wp-admin-theme-color` on `body.admin-color-*`**, and its own buttons and
  links read it. Do not set it on `body`. It is set on the shell and on overlays.
- **An overlay is not inside the shell.** The overlays of `@wordpress/ui` are drawn in
  `[data-wp-compat-overlay-slot]`, a popover of `@wordpress/components` is `.components-popover`
  and is not always a dialog, and its menus are `[data-dialog]`. A list that names only
  `[role='dialog']` leaves the view options of a table with WordPress's blue for its rings.
- **For a black brand the provider's darkest fill is `#2d2d2d`,** whatever black it is given, and
  that is also the fill of a neutral button. So the fill tokens of both tones are set to
  `--wh-primary`, with what is written on them.
- **`@wordpress/components` draws four of its rings in the accent,** which is the brand: the
  border of an input in focus (its backdrop), the ring of a switch (its track), a modal that
  scrolls and the halo of a slider (round its thumb). The first takes the focus colour as its
  own accent; the next two are the package's rules with the colour changed. A slider is a field
  nobody sees, over a track, and what the package marks its focus with is the accent at 0.4
  round a thumb the accent fills: grey on black. The halo is taken off, and the ring every other
  control has is drawn round the thumb, the element beside the field, while the field is
  `:focus-visible`. The frontend reset has the same two rules.
- **Read it back.** `getComputedStyle( control ).backgroundColor` on a checked box, a switch and
  a button, and the ring with the control in focus from the keyboard. A ring is not in a
  screenshot of a page at rest.
- **A control no screen has held has not been read.** The slider kept its halo in the admin after
  the frontend had lost it, because no admin screen that was measured held one. Before a screen
  uses a control of this package for the first time, walk to it with the keyboard and read its
  ring, and what is drawn `::before` and `::after` its parts. If it is not the green, say what
  you saw and let the person decide: a fifth rule is not written in passing.

## The components stylesheet is WordPress's own

`@wordpress/components` is not bundled. Its script and its stylesheet are the `wp-components`
handle of the WordPress the site runs, so they are as old as that WordPress, whatever
`package.json` pins. Two releases do not draw a button the same way:

| | WordPress 7.1 | WordPress 7.0 and before |
| --- | --- | --- |
| a button's border | `1px solid transparent` | `0` |
| the ring of a secondary button | `border-color` | an inset `box-shadow` |
| focus | an `outline` in `--wpds-color-stroke-focus` | a `box-shadow` in the accent |

A rule written against one of them and checked on that one alone is half a rule. The header's
buttons set `border-color` and `box-shadow: none`, which is right on 7.1 and left them with no
ring at all on 7.0. So:

- **State the whole of what you restyle.** `border-style` and `border-width` beside
  `border-color`; `box-shadow: none` beside an `outline` for focus. The shell does this for every
  header button.
- **On a release before 7.1 a button in the content draws its focus in the accent, which is the
  brand's black.** It can be seen, on white, and it is not green. Nothing in the generated
  stylesheet changes that: doing it for every variant is a copy of the newer stylesheet. It is a
  known difference, kept until the plugin's minimum WordPress is 7.1; do not patch it per
  component.
- **Run the end-to-end suite on the oldest WordPress the plugin supports.** The generated
  `settings-page.spec.js` measures the header ring on whatever the test site runs, which is how
  this was found.

## The tab strip belongs to the shell

`Tabs.List` is `overflow-x: auto`, as wide as its tabs, with no line under it, and each tab is
`flex: 1 0 auto`. The shell turns the strip of a `tabbed` page into the full-bleed one the design
system asks for, with a negative inline margin equal to the page padding, and tells the tabs not
to grow: in a list as wide as the surface, two growing tabs take half of it each. The shell's rule
reaches the strip that opens the content and no tab list further in, so tabs inside a card keep
the component's own shape. Three things that go wrong when a screen styles its own:

- `max-width: 100%` on the list pins it to the padded width, and the line stops short of the
  surface's edges.
- A rule nested under a class that is not on an ancestor of the strip never applies, and nothing
  reports a rule that matches no element.
- A margin between the strip and its panel that is written for the loaded state also moves the
  loading one. Scope it to the state it belongs to.
