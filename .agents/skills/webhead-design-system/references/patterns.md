# Screen patterns

Loaded from `webhead-design-system` when building one of these surfaces.

## Tabs

`Tabs.Root` / `Tabs.List` / `Tabs.Tab` / `Tabs.Panel`, controlled through `value`.

- **Never key `Tabs.Root` on the active tab.** It is controlled through `value`, so a key that
  changes on every switch remounts the whole tree and replays every entrance animation — which
  reads as a flicker.
- **Do not use tabs for links.** Upstream is explicit: the semantics do not match, and users
  expect every link to be tabbable while `Tabs.List` is a single tab stop.
- **Tabs that top a page are full-bleed with a light bottom border**: the line spans the whole
  panel and each label stays as wide as its text. `Tabs.List` draws neither, so the shell does —
  inside `<AdminPage tabbed>` every `[role="tablist"]` reaches the edges of the surface and
  carries the line. Do not style a strip per screen. A loading placeholder for the strip takes the
  shell's `webhead-search-cloud-admin-page__tab-strip` class and gets the same line, so nothing appears
  when the tabs do. Tabs inside a card leave `tabbed` off.
- **A tab strip must never make the page scroll sideways.** `overflow-x: auto` on the list, tabs
  sized to their labels. Verify at a narrow viewport rather than assuming.
- **Do not render a placeholder tab while data loads** and then swap it for the real set — that
  reads as the tabs arriving after the page has settled. Render skeleton shapes until the real
  sections are known.

## Save & submit: one model per surface

Decide per screen whether it **autosaves** or **collects changes behind a Save button**, and never
mix them: a screen where some fields save instantly and others wait is one where nobody can tell
what is stored.

Autosave is the design system's preferred default — "when in doubt, prefer autosave" — wherever
fields can be validated and stored one at a time. Toggles, selects and radios save on change; text
and number fields on blur or debounced, never per keystroke; feedback and errors per field,
inline, keeping what was typed; no global Save button and no leave-guard, because both imply
pending state that does not exist.

Manual save — one primary "Save changes" button that goes busy, a snackbar confirms, the button
is disabled with a "No unsaved changes" tooltip when there is nothing to store, and leaving with
edits prompts first. The generated settings screen is this model, because its values are written
together. Partial saves get **one** `Notice` saying what was saved and what still needs
attention; never stack a success and an error. A save that failed outright shows the reason the
REST API gave, not "Something went wrong".

Toggles: lead the label with a verb — Use, Allow, Show, Enable — keep it short, and put the
explanation in the description or the card title.

## Error messages

Answer **what happened, why, and what now**, in a sentence or two.

- Explain the cause; if it is genuinely unknown, say so rather than inventing one.
- No error codes, no internal names, no jargon.
- **Never blame.** "Enter a date in the future", not "You entered an invalid date".
- Name the specific thing that failed, not "the server".
- Always leave one thing to try.

Where it goes: no decision needed → **snackbar**; a decision with a place on screen →
**`<Notice.Root intent="error">` in that card or row**; whole screen → **`Notice` at the top**;
must be resolved first → **modal**. Anything requiring a decision must not auto-dismiss.

`Notice` is the compound one from `@wordpress/ui`; its shape is in `component-status.md`.

**One announcement per update.** A notice that is on the page when it renders announces nothing.
One that appears is announced — assertively for an error that needs attention now, politely
otherwise — with its title and description and nothing else. At `@wordpress/ui` 0.23 the notice
does that itself, so adding `role="alert"`, an `aria-live` region or a `speak()` beside it makes
two. A later release takes it out of the component: if `Notice.Root` no longer has `spokenMessage`
and `politeness` in `node_modules/@wordpress/ui/build-types/notice/types.d.ts`, the handler that
shows a notice calls `speak( message, 'assertive' )` from `@wordpress/a11y`.

## Forms

- Each control keeps its own label. Hide one only when other visible text already identifies it.
- Several controls under one visible group label take a `Fieldset` with a `Fieldset.Legend`.
- `Card.Content` does not space what is in it: fields, their help and their notices go in a
  `Stack direction="column"` with a `gap`.

## The house modal

Reach for `src/components/Modal.js`, not `Modal` from `@wordpress/components`. It carries the
blurred backdrop, the open/close motion, the size presets and a focus trap that returns focus to
whatever opened it, and its shadow comes from `$elevation-large` — the level the design system
assigns to "components that confirm an action or require a decision".

It is **mounted always and told whether it is open**:

```jsx
<TheModal isOpen={ showing } onClose={ () => setShowing( false ) } … />   // correct
{ showing && <TheModal … /> }                                            // no animation, either way
```

`AnimatePresence` has to outlive its child to run an exit animation, and it declares
`initial={ false }` so a modal mounted already-open simply appears. Conditional mounting breaks
both halves and neither one errors.

`actions` renders the footer buttons in order; each takes `label`, `onClick`, `variant`,
`isDestructive`, `disabled`, and `closeOnClick: false` when the click should not dismiss. Pass
`footer` instead when the buttons need their own layout.

If the plugin predates it, install it with `wh-plugin components:add modal`.

## Destructive actions

1. **No visible frontend result** → no confirmation and no destructive styling; ensure undo exists.
2. **Visible but easily undone** → `ConfirmDialog` (exported as `__experimentalConfirmDialog`),
   dismissable, confirm button **primary** not destructive, followed by a snackbar with an undo
   action. The dialog draws no title, so its body asks the question and says what happens to what
   is removed.
3. **Irreversible** → the house modal with `showCloseButton={ false }`,
   `closeOnEscape={ false }` and `closeOnBackdropClick={ false }`, an `isDestructive` primary
   action and a `variant="tertiary"` cancel. Label it for what it does — "Delete permanently",
   not "Delete". For the worst cases add an initially unchecked acknowledgement checkbox that
   gates the button.

## States

- **Loading uses a skeleton, not a spinner**, wherever the layout is known before the data. A
  spinner says only "wait"; a skeleton says what is coming, so the screen does not jump. A spinner
  is still right for a busy button, where the shape *is* the button.
- **The skeleton is `Skeleton` from `@wordpress/ui`**, sized by a class of yours, inside one
  region marked `role="status"`, `aria-busy="true"` and an `aria-label`.
  `src/admin/settings/components/SettingsSkeleton.js` is the one to follow. Do not add
  `react-content-loader` for it.
- **Badges** hold text and never an icon. Use the least attention-grabbing `intent` that is true.
- **Tooltips are a visual label and nothing else.** The popup is not exposed to assistive
  technology and does not appear on touch devices, so the trigger carries an `aria-label` saying
  the same thing. Never hide a description or status in one: a description is inline text, an
  infotip is a `Popover`, and feedback after an action is a notice or a snackbar.
- **A busy tab is a design problem**, not a density preference. More than about five controls in
  one region wants grouping into cards or progressive disclosure.
