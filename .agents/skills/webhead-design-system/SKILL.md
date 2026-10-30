---
name: webhead-design-system
description: "Use this skill before writing or changing any admin UI in Searcio - Fast AI Product Search for WooCommerce: which WordPress component to reach for, design tokens, cards, tabs, typography, elevation, radius, layout, loading and saving states, destructive confirmations, error messages, badges and tooltips."
license: MIT
metadata:
  author: webhead
---

# webhead Admin Design System

These are the WordPress Design System's rules, taken from its documentation and from the packages
pinned in this plugin's `package.json` — not from memory, which is unreliable for packages that
move this fast.

**Read this before the first line of a new screen, card, table or control.**

## Where the rest of it is

This file is the rules. The detail sits in `references/`, read only when the question needs it —
that is the point of the split, not tidiness: a rule competes for attention with everything else
loaded beside it.

| Read this | When |
| --- | --- |
| `references/component-status.md` | Choosing a component, or a prop that looks right does nothing |
| `references/tokens.md` | Constructing or checking a `--wpds-*` name; elevation; radius |
| `references/css-traps.md` | About to restyle anything the packages ship — Button, Card, wp-admin `h1` |
| `references/patterns.md` | Building tabs, a save flow, errors, a modal, a destructive action, loading states |
| `references/screens.md` | Putting a screen together: a new page, what goes into a card, a card header, a card grid, an empty state, a table |

## Check a fact instead of recalling it

The Gutenberg Storybook is React-rendered, so fetching its HTML returns an empty shell. Two ways in:

1. **Every component's status at once.** Open any docs page in a browser and ask the preview
   store — the same source the status badges render from:

   ```js
   const all = await window.__STORYBOOK_PREVIEW__.extract();   // ~30s
   Object.values( all )
     .filter( ( s ) => s.parameters?.componentStatus )
     .map( ( s ) => [ s.title, s.parameters.componentStatus.status, s.parameters.componentStatus.notes ] );
   ```

2. **One page's prose.** `https://wordpress.github.io/gutenberg/iframe.html?id=<story-id>&viewMode=docs`
   renders without the Storybook shell. The page index is plain JSON at
   `https://wordpress.github.io/gutenberg/index.json` and needs no browser.

For props, read the `.d.ts` under `node_modules/@wordpress/ui/build-types/`.

**The Storybook documents Gutenberg's trunk; this plugin runs the packages in its
`package.json`.** The two differ. Take the rule from the Storybook and the name of an export or a
prop from `node_modules`. When a `@wordpress/*` version moves, read the breaking changes in
`node_modules/@wordpress/<package>/CHANGELOG.md` for every release in between.

The design system recommends its "WordPress Design System MCP Server" to AI agents. When it is
connected, ask it for a component's status before opening a browser.

These files were written on 2026-10-29 against `@wordpress/components` 43, `@wordpress/ui` 0.25,
`@wordpress/theme` 3.0, `@wordpress/icons` 19 and `@wordpress/dataviews` 21.0.

## When the design system falls short, stop and ask

The design system's contributing page addresses AI agents directly, and it is a rule here: **when
you meet a shortcoming, stop and ask before working around it.** The signs that you have met one:

- overriding a component's styles through its internal class names or its markup,
- hard-coding a colour, a spacing, a radius or a font value,
- copying a component's source, or importing a private path,
- building a control of your own that resembles one the design system has.

Say which component, token or page it is and what is missing, say plainly that a workaround is
not recommended and drifts from the design system, and let the person decide. Offer to draft the
issue; **do not file issues or pull requests on Gutenberg yourself.** A workaround the person
chose gets a comment naming the gap.

## Which component to reach for

This is **not** "prefer `@wordpress/ui`". Upstream is mid-migration and the two packages disagree
in both directions: 39 `@wordpress/components` exports are not-recommended or deprecated, and
seventeen `@wordpress/ui` components are use-with-caution — nearly all of them because they are
*"not yet recommended for use alongside components from `@wordpress/components`"*.

So choose **per component, by its status**: take the one that is recommended, and where the
`@wordpress/ui` one is cautionary stay on `@wordpress/components`. That is why the settings screen
imports `Button` from `@wordpress/components` and `Notice`, `Card`, `Tabs`, `InputControl`,
`SwitchControl`, `Stack` and `Skeleton` from `@wordpress/ui`.

The full lists and the `@wordpress/ui` export shapes are in `references/component-status.md`. Two
rules that never need looking up:

- **A `not-recommended` component is not an option**, whatever a neighbouring file still does.
- **No `@wordpress/ui` form control takes `onChange`.** Text, select and radio controls take
  `onValueChange`; `CheckboxControl` and `SwitchControl` take `checked` and `onCheckedChange`. The
  wrong one is not an error; it is a control that silently never updates.

## Design tokens, in four rules

`@wordpress/theme` publishes the `--wpds-*` custom properties in `prebuilt/css/design-tokens.css`.
**That file is the authority.** The whole grammar is in `references/tokens.md`.

- **Build the name from the grammar, never from memory** —
  `--wpds-color-<property>-<target>-<tone>[-<emphasis>][-<state>]`. There is no `text`, no `border`,
  and no bare `content-*`.
- **A token that does not exist stops the build, in a stylesheet.** `webpack.config.js` runs
  `@wordpress/theme`'s `postcss-ds-token-fallbacks`, which fails with `Unknown design token` on a
  name the package does not have. In a `style` prop or a JavaScript string the same mistake is
  still silent: the declaration is dropped, which looks exactly like a rule nobody wrote.
- **Write the token bare, and never set one.** The build writes the fallback; a `--wpds-*: …`
  declaration of your own is the sign of a gap to ask about, not an override to add.
- **Elevation is not a `--wpds-*` property** — it lives in `@wordpress/base-styles` as
  `$elevation-x-small` and friends. Radius *is* a token, and its whole scale is switchable, so
  write the token and never the number.

## Every admin screen uses the same shell

`src/components/AdminPage.js` owns the page chrome — the dark header, the title
and description, the actions slot, the surface radius, the page padding, the
width and the rhythm between whatever the page puts inside it. The generated
settings screen is drawn by it. **Use it for every page you register**, so a
second screen cannot look like a different plugin:

```jsx
<AdminPage
    title={ __( 'Reports', 'searcio' ) }
    description={ __( 'What this screen is for.', 'searcio' ) }
    icon={ ChartIcon }
    actions={ [
        { label: __( 'Refresh', 'searcio' ), icon: UpdateIcon, onClick: refresh },
        { label: __( 'Add new', 'searcio' ), onClick: create },
        { label: __( 'Export', 'searcio' ), onClick: exportAll },
    ] }
>
    …cards…
</AdminPage>
```

This is the fix for a real defect: a second admin page was written without it and
came out with no header at all, matching nothing else in the plugin. Anything the
shell owns — page padding, the gap between cards, the gap between a tab strip and
its panel — is defined once there rather than per screen, which is why the tab
panel used to sit flush against its tabs on any screen that was not the settings
one.

What follows from the shell drawing every screen:

- **Never give a screen a frame of its own.** No wrapper with a `max-width`, its
  own padding, or a header beside the shell's. The shell is as wide as the window
  lets it be and inset the same on every side; a screen that wants a narrower
  measure narrows what it puts *inside*. A frame of its own is how a second page
  ended up 1440px wide beside a settings screen of 2340px, and 20px to its left.
- **`tabbed`** when the content opens with a tab strip: the strip then sits
  directly under the header, as it does on the settings screen, and the shell
  draws it the way the design system asks for tabs that top a panel — as wide as
  the surface, with a light line under it, each label as wide as its text. Do not
  style the strip yourself.
- **The page title is the `h1`.** Cards directly under it take
  `Card.Title render={ <h2/> }`.
- **The accent colours, the card variants and the badges arrive with the shell.**
  It imports `src/components/Default` and carries the `panel-container` class
  that stylesheet is scoped to, so they apply on every screen and not only on
  the one whose root element the stylesheet names. A page needs no
  `get_default_asset_entry()` for them.
- **Do not edit `AdminPage.js` or `admin-page.scss`.** They are framework-owned
  and `composer framework:update` refreshes them. Change the look in
  `src/components/Default/default.scss`, which is yours.

**Adding a page takes four things**: a class that extends `Admin\Page`, its registration, a
webpack entry, and the file that mounts the screen. `references/screens.md` has the recipe and
the two tests to copy for the new page.

The shell is a **surface** (`xl` radius); the cards inside it are cards (`lg`).

### What the header guarantees

- **Every header carries an icon.** `icon` is not optional in effect: a page that
  passes none still gets a neutral default, because a header without one reads as
  a different plugin. Pass the icon that matches the screen.
- **The header content animates in**, through the same `useFadeInUpProps` and
  `animateText` helpers the rest of the plugin uses, so it collapses to the
  finished state under `prefers-reduced-motion`. Do not hand-roll an entrance.
- **`actions` is a list of descriptors** — `{ label, onClick, icon?, disabled?,
  isBusy?, isDestructive? }` — not raw elements. The shell decides how each one
  looks, which is the only way two screens can agree.
- **At most two buttons sit in the header.** The first is outlined in white, the
  second is filled with white and written in black, keyed to *position* rather than to what
  the button does, so one header never shows two competing primaries. The third
  descriptor onwards collapses into a single `moreVertical` toggle backed by a
  Popover menu. Do not add a third button; add a third descriptor.
- **The overflow toggle is not a third button.** It is `size="compact"`,
  `variant="tertiary"`, borderless and 32px square, so it reads as the way in to
  the rest rather than as another action. Bordered and full height it crowded the
  header, which is the thing the overflow menu exists to prevent.
- **Hover lifts; it does not invert.** The outlined button takes a translucent
  white wash and keeps its white text — filling it solid white made the secondary
  action louder than the primary beside it. The filled one dims to
  `--wh-secondary-dark`. Transition everything the hover touches — the package
  transitions `border-color` alone, so a background swap snaps — and drop the
  transition under `prefers-reduced-motion`.

### Before you restyle any of it

The header's buttons, the Card and the page title are all things the packages already style, and
overriding them has a repeatable failure shape: pick the property the package does not use, or
cover only the resting state, and it looks right in the source and wrong on the screen.
**Read `references/css-traps.md` before writing the first override.**

## Layout, cards and rhythm

An admin page is a **content frame** holding cards as siblings on a rhythm. The frame owns the
page padding, and **a card never supplies the gap that separates it from the next one** — the
container does, so the gap cannot change depending on which card is above. Two cards touching is
the signature of a card that was expected to space itself; a tab panel returning a bare fragment
has no `gap`, which is the usual cause.

Vertical rhythm by token: `gap-xs` between a card title and its description, `gap-lg` between a
tab strip and its panel and between related cards, `gap-xl` between major sections.

### Three things a card does not do

- **`Card.Content` pads itself and does not space its children.** More than one child of a
  `Card.Content`, a tab panel or a fragment goes in a `Stack direction="column"` with a `gap`
  token. Buttons go in a row `Stack` of their own, and the column never takes `align="start"`:
  that shrinks every child, and it left a notice 26px wide.
- **`Card.Header` does not lay out a title and a control.** They stack and touch unless one row
  `Stack` with `justify="space-between"` holds both.
- **Cards do not arrange themselves.** Small cards go beside each other in the plugin's
  `Grid auto`, not in a hand-written `auto-fill` grid, which leaves empty columns on a wide
  screen.

`references/screens.md` has each with its sample and what it looked like the other way. Read it
before putting a second element into anything.

**A card separates one section from another. One section needs no card.** A screen, a tab, or a
section beside a `SectionList` that holds a single region puts it straight on the panel: a lone
table with no wrapper, a lone form with no card. A box around the only thing there says a second
section is coming that never does. Reach for cards when there are several regions and the reader
needs to tell them apart, and count the regions when the tab can change: a History tab whose
second card shows only once there are repairs is a one-region tab until then. The generated
settings screen does this for a tab that holds one setting.

**Let the Card be a Card.** `Card.Root` already draws its border, radius and surface;
`Card.Header` and `Card.Content` already pad themselves, and there is no separator line under a
header anywhere in the design system. Restating any of it — even with the identical token — breaks
the component's own spacing, because `@wordpress/ui` ships inside `@layer wp-ui` and an unlayered
rule beats a layered one however specific either is. `references/css-traps.md` has the anatomy.

```jsx
<Card.Root className="webhead-search-cloud-card webhead-search-cloud-card--dotted">
    <Card.Header className="webhead-search-cloud-card__header">
        <Card.Title render={ <h2 /> }>{ __( 'Title', 'searcio' ) }</Card.Title>
    </Card.Header>
    <Card.Content className="webhead-search-cloud-card__content">…</Card.Content>
</Card.Root>
```

- **Every part carries a class of yours.** The component emits hashed CSS-module names
  (`_02872bf2__root`, `bbccc92e__header`) that change with the build, so nothing here can target
  them. Style `webhead-search-cloud-card`, `__header`, `__content`.
- **There is no `Card.Footer`.** A footer is content at the bottom — use `Card.Content`.
- **There is no `variant` or `elevation` prop.** The variants are the surface classes in
  `src/components/Default/default.scss`, and they go **by nesting depth**: `--dotted` for a card
  inside a card, `--secondary` for one inside a dotted card, and `--grid` only for a surface meant
  to look deliberately different. A second-level card that keeps the default surface disappears
  into its parent.
- `Card.Title` takes `render={ <h2 /> }` for the semantic level. Do not nest heading markup in the
  header.
- **One heading level per card row.** Cards in one region share a `Card.Title` level, so they
  share a size. A different size means a different rank.
- **Say each label once.** If the card header names the field, the control inside carries an
  accessible label only. A switch is the answer to the question its title asks, so it belongs on
  the title row rather than stranded below a description.

`CollapsibleCard` is the answer to a crowded card, opened by rule rather than habit:
`defaultOpen={ items.length > 0 }`. One card left open among closed ones reads as the important
one.

**A tab with more than about five sections lists them down the side** and shows one at a time:
`SectionList` from `src/components/SectionList.js`. Each entry carries its name and its state, a
line per fact; the section is in the address; the design system marks the selected entry. Do not
stack the sections down the page, fold them into collapsible cards, or build a vertical tab list
of your own. The rules are under Tabs in `references/patterns.md`.

## Verify by measuring, not by looking

```js
// A token that resolves to nothing looks like a rule you forgot to write.
getComputedStyle( document.documentElement ).getPropertyValue( '--wpds-typography-font-weight-emphasis' );

// Does any card supply its own separating margin?
[ ...document.querySelectorAll( '[class*="card"]' ) ].map( ( c ) => getComputedStyle( c ).marginBottom );

// Heading levels across a row — a different size means a different rank.
[ ...document.querySelectorAll( '[class*="card"] h2, [class*="card"] h3' ) ].map( ( h ) => h.tagName );

// At a narrow viewport: the strip scrolls, the page does not.
const list = document.querySelector( '[role="tablist"]' );
list.scrollWidth > list.clientWidth && document.documentElement.scrollWidth <= document.documentElement.clientWidth;

// Where a screen starts and how wide it is. Run it on two screens of the plugin
// and compare the two results; they must be the same.
( ( s ) => [ s.getBoundingClientRect().x, s.getBoundingClientRect().width ] )(
    document.querySelector( '.webhead-search-cloud-admin-page__surface' ) );

// What a card's content stacks: the top and the bottom of each child. A bottom
// equal to the next top means the two touch.
[ ...document.querySelector( '.webhead-search-cloud-card__content' ).children ]
    .map( ( c ) => c.getBoundingClientRect() ).map( ( r ) => [ Math.round( r.top ), Math.round( r.bottom ) ] );

// The tab strip under the header: as wide as the surface, with a line under it.
( ( l ) => [ l.getBoundingClientRect().width, getComputedStyle( l ).borderBottomWidth ] )(
    document.querySelector( '[role="tablist"]' ) );
```

**Measure at more than one width, and one of them wider than any laptop.** A frame
that stops growing at some maximum looks right on every screen narrower than that
maximum. In a browser you cannot resize, `document.documentElement.style.zoom = '0.66'`
makes the layout one and a half times as wide.

**Measure every state, not the screen at rest.** Click each action, open each overlay, make a
field wrong, empty the list, then narrow the window and switch to a right-to-left language.
`webhead-verify-before-you-write` has the list, and the reason: a notice that was 26px wide only
existed after a click. The zoom above misplaces popovers, so open those at zoom 1.
