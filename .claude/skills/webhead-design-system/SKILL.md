---
name: webhead-design-system
description: "Use this skill before writing or changing any admin UI in webhead Search Cloud: which WordPress component to reach for, design tokens, cards, tabs, typography, elevation, radius, layout, loading and saving states, destructive confirmations, error messages, badges and tooltips."
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

## Which component to reach for

This is **not** "prefer `@wordpress/ui`". Upstream is mid-migration and the two packages disagree
in both directions: 30 `@wordpress/components` exports are not-recommended, and 18
`@wordpress/ui` components are use-with-caution — nearly all of them because they are *"not yet
recommended for use alongside components from `@wordpress/components`"*. This plugin's admin
screens are built from `@wordpress/components` controls, so that caveat applies to them.

The full lists and the `@wordpress/ui` export shapes are in `references/component-status.md`. Two
rules that never need looking up:

- **A `not-recommended` component is not an option**, whatever a neighbouring file still does.
- **`@wordpress/ui` form controls take `onValueChange`, not `onChange`.** The wrong one is not an
  error; it is a control that silently never updates.

## Design tokens, in three rules

`@wordpress/theme` publishes the `--wpds-*` custom properties in `prebuilt/css/design-tokens.css`.
**That file is the authority.** The whole grammar is in `references/tokens.md`.

- **Build the name from the grammar, never from memory** —
  `--wpds-color-<property>-<target>-<tone>[-<emphasis>][-<state>]`. There is no `text`, no `border`,
  and no bare `content-*`.
- **A token that does not exist fails silently.** `var()` with no fallback and no definition makes
  the whole declaration invalid at computed-value time, which looks exactly like a rule nobody
  wrote.
- **Elevation is not a `--wpds-*` property** — it lives in `@wordpress/base-styles` as
  `$elevation-x-small` and friends. Radius *is* a token, and its whole scale is switchable, so
  write the token and never the number.

## Every admin screen uses the same shell

`src/components/AdminPage.js` owns the page chrome — the dark header, the title
and description, the actions slot, the surface radius, the page padding and the
rhythm between whatever the page puts inside it. **Use it for every registered
page**, so a second screen cannot look like a different plugin:

```jsx
<AdminPage
    title={ __( 'Reports', 'webhead-search-cloud' ) }
    description={ __( 'What this screen is for.', 'webhead-search-cloud' ) }
    icon={ ChartIcon }
    actions={ [
        { label: __( 'Refresh', 'webhead-search-cloud' ), icon: UpdateIcon, onClick: refresh },
        { label: __( 'Add new', 'webhead-search-cloud' ), onClick: create },
        { label: __( 'Export', 'webhead-search-cloud' ), onClick: exportAll },
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
  second is filled with the brand colour, keyed to *position* rather than to what
  the button does, so one header never shows two competing primaries. The third
  descriptor onwards collapses into a single `moreVertical` toggle backed by a
  Popover menu. Do not add a third button; add a third descriptor.
- **The overflow toggle is not a third button.** It is `size="compact"`,
  `variant="tertiary"`, borderless and 32px square, so it reads as the way in to
  the rest rather than as another action. Bordered and full height it crowded the
  header, which is the thing the overflow menu exists to prevent.
- **Hover lifts; it does not invert.** The outlined button takes a translucent
  white wash and keeps its white text — filling it solid white made the secondary
  action louder than the primary beside it. The filled one darkens to
  `--wh-accent-dark`. Transition everything the hover touches — the package
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

**A card separates one section from another. One section needs no card.** If a screen or a tab
holds a single region, put it straight into the page shell — wrapping it draws a box around the
whole thing and promises a second section that never arrives. Reach for cards when there are
several regions and the reader needs to tell them apart.

**Let the Card be a Card.** `Card.Root` already draws its border, radius and surface;
`Card.Header` and `Card.Content` already pad themselves, and there is no separator line under a
header anywhere in the design system. Restating any of it — even with the identical token — breaks
the component's own spacing, because `@wordpress/ui` ships inside `@layer wp-ui` and an unlayered
rule beats a layered one however specific either is. `references/css-traps.md` has the anatomy.

**Lay small cards beside each other.** A column of half-empty full-width cards makes a page far
taller than its content, and every card past the fold costs a scroll. Put them in a grid when
their content is short — but not so eagerly that a card is squeezed below roughly 280px, which
reads as broken. Size the track to the content, not to the number of cards:

```scss
.webhead-search-cloud-section-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--wpds-dimension-gap-xl);
    align-items: start;
}
```

```jsx
<Card.Root className="webhead-search-cloud-card webhead-search-cloud-card--dotted">
    <Card.Header className="webhead-search-cloud-card__header">
        <Card.Title render={ <h2 /> }>{ __( 'Title', 'webhead-search-cloud' ) }</Card.Title>
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

`CollapsibleCard` is the answer to a crowded tab, opened by rule rather than habit:
`defaultOpen={ items.length > 0 }`. One card left open among closed ones reads as the important
one.

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
```
