# Building a screen

Loaded from `webhead-design-system` when something new goes onto a screen: a page, a card, a
second element inside a card, a table. Each section is something that was built the other way
first, and looked acceptable until it was measured or clicked.

## Adding a page

Four things, and a page is missing if any one of them is:

1. A class in `includes/Admin/` that extends the framework's `Admin\Page`: its
   menu slug, `get_menu_parent()` returning the settings page's slug, its title,
   its capability, the two asset paths copied from `Settings_Page`, and
   `get_asset_key()` returning the name of its bundle, `bundle.reports`.
2. `$page_registry->add( … )` for it in `register_admin_pages()`.
3. An entry in `webpack.config.js`: `'bundle.reports'` pointing at
   `src/admin/reports/index.js`.
4. That file, mounting the screen on the page's root element. The root id is the
   menu slug followed by `-root` unless the class says otherwise:

```jsx
const container = document.getElementById( 'webhead-search-cloud-reports-root' );

if ( container ) {
    createRoot( container ).render(
        <ThemeProvider isRoot color={ { primary: '#101010' } }>
            <AdminPage title={ __( 'Reports', 'searcio' ) } icon={ ChartIcon }>
                …cards…
            </AdminPage>
            <ToastContainer />
        </ThemeProvider>
    );
}
```

Then copy the last two tests of `tests/e2e/specs/settings-page.spec.js` for the
new page. One measures the screen in a browser 2400px wide, and two screens that
both pass it start at the same place and are the same width. The other measures
that nothing the screen stacks touches what is above it.

## Nothing spaces what you put inside a card

**`Card.Content` pads itself and does not space its children.** It is a block with padding and no
`gap` — the design system's own Card story shows two paragraphs in one `Card.Content` sitting
flush against each other — and a fragment has no gap either. Two elements written one after the
other inside a card touch, and nothing in the source shows it:

```jsx
<Card.Content className="webhead-search-cloud-card__content">
    <Stack direction="column" gap="md">
        <Text>{ __( 'What this does.', 'searcio' ) }</Text>
        <Stack direction="row" gap="sm">
            <Button variant="primary" onClick={ run }>{ __( 'Run now', 'searcio' ) }</Button>
        </Stack>
        { done && (
            <Notice.Root intent="success">
                <Notice.Description>{ __( 'Done.', 'searcio' ) }</Notice.Description>
            </Notice.Root>
        ) }
    </Stack>
</Card.Content>
```

- **More than one child in a `Card.Content`, a tab panel or a fragment means a `Stack` with a
  `gap`** — `direction="column"` and a token: `sm` inside one field group, `md` between a control
  and what belongs to it, `lg` between groups. Never a margin on the child.
- **A column `Stack` stretches its children, and that is what a field, a notice and a table
  want.** A button is the exception, and it goes in a row of its own:
  `<Stack direction="row" gap="sm">`. In a row it stays as wide as its label, and a second button
  has a place beside it.
- **Never put `align="start"` on the column to stop a button stretching.** It stops every child
  stretching. A `Notice` in such a stack collapsed to 26px, its text one word to a line, and it
  only showed after the button was clicked.
- **The shell's content area and the settings grid already carry a gap.** Do not add a second one
  around what they hold.

`tests/e2e/specs/settings-page.spec.js` measures it (`leaves a gap between everything it stacks`).
Copy that test for every page you add: a paragraph and a button in one `Card.Content` looks
acceptable in a screenshot and measures 0px.

## Small cards beside each other

**Lay small cards beside each other.** A column of half-empty full-width cards makes a page far
taller than its content, and every card past the fold costs a scroll. Put them in a grid when
their content is short — but not so eagerly that a card is squeezed below roughly 280px, which
reads as broken. Size the track to the content, not to the number of cards, with the plugin's own
`Grid`:

```jsx
import { Grid } from '../../components/Layout';

<Grid auto={ { base: 280, md: 320 } } gap="var(--wpds-dimension-gap-xl)" align="start">
    <Card.Root …>…</Card.Root>
    <Card.Root …>…</Card.Root>
</Grid>
```

`auto` fits as many columns as the width holds and lets the cards share what is left. Do not write
the grid by hand with `repeat(auto-fill, …)`: `auto-fill` keeps the tracks it has no card for, and
on a wide screen four cards stopped two thirds of the way across with a hole beside them.
`align="start"` belongs on a **grid**, where it keeps a short card from being stretched to the
height of its neighbour; it is the column `Stack` that must not have it.

## A card header with something at its end

**`Card.Header` does not lay out what is put in it.** It is a block: a title and a control
written into it stack, and touch. A header that carries something at its end — a copy button, a
menu, a switch — holds both in one row:

```jsx
<Card.Header className="webhead-search-cloud-card__header">
    <Stack direction="row" gap="md" justify="space-between" align="center" wrap="wrap">
        <Card.Title render={ <h2 /> }>{ __( 'Shortcode', 'searcio' ) }</Card.Title>
        <Stack direction="row" gap="sm" align="center">…</Stack>
    </Stack>
</Card.Header>
```

## An empty state

`EmptyState.Root` centres what is in it and not itself. It is at most 320px wide and sits where its
parent puts it, which in a page is the left edge:

```jsx
<Stack direction="column" align="center">
    <EmptyState.Root>
        <EmptyState.Icon icon={ InboxIcon } />
        <EmptyState.Title>{ __( 'No exports yet', 'searcio' ) }</EmptyState.Title>
        <EmptyState.Description>{ __( 'The first one appears here when it is ready.', 'searcio' ) }</EmptyState.Description>
        <EmptyState.Actions>
            <Button variant="primary" onClick={ create }>{ __( 'Create an export', 'searcio' ) }</Button>
        </EmptyState.Actions>
    </EmptyState.Root>
</Stack>
```

This is the one place a column `Stack` takes an `align`: its only child is meant to shrink. Given
to DataViews through its `empty` prop, an empty state is centred by the table and needs no stack.

## A table

Import `DataViews` from `src/components/DataViews`, never from `@wordpress/dataviews`. The module
brings the package's stylesheet and the house rules, and a table rendered without them still
renders: as wide as its content, with centred headers, and with nothing to report a missing
stylesheet. Column widths, the clamp for a long cell and the class for a dataset without media are
in `webhead-react-admin`.
