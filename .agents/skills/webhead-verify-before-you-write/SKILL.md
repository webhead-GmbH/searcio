---
name: webhead-verify-before-you-write
description: "Read this before writing code against any package, and before reporting that anything works. It is a list of mistakes that were actually made in Searcio - Fast AI Product Search for WooCommerce's codebase and how each one was caught — every entry cost real debugging time, and every one was avoidable by reading instead of recalling."
license: MIT
metadata:
  author: webhead
---

# Verify before you write

Everything below happened. Each entry is a real defect that reached a running
plugin, and each one had the same two causes: **an API shape was recalled instead
of read**, or **a command was believed instead of checked**.

They are cheap to avoid and expensive to find, because almost none of them
produce an error that names the problem.

## The two rules

1. **Before you write a call, read the thing you are calling.** The installed
   package in `node_modules`, the sibling file that already does it, the `.d.ts`.
   Not your memory of it — these packages change faster than memory is right.
2. **A command has not succeeded until you have seen its exit code.** Not its
   last line of output. Not the absence of a red word.

## Failures that look like success

These produce no error at all. Nothing goes red; the thing just does not work.

| what was written | what happened |
|---|---|
| `import DataViews from '@wordpress/dataviews'` | It is a **named** export. The default is `undefined`, and React reports only the minified error #130. |
| `import { ToggleGroupControl } from '@wordpress/components'` | Exported as `__experimentalToggleGroupControl`. Same silent `undefined`, same #130. |
| `<Stack gap={ 3 }>` | `gap` takes a token — `'xs' … '3xl'`. A number produces no gap. |
| `<Stack wrap>` | `wrap` is a `flex-wrap` **string**. A bare attribute passes `true`, which is not valid CSS, so content overflows its card. |
| `<Badge intent="success">` | Intents are `none \| stable \| draft \| informational \| low \| medium \| high`. Anything else renders unstyled. |
| `<InputControl onChange={…}>` | The `@wordpress/ui` controls take **`onValueChange`**. The field renders perfectly and never updates. |
| `box-shadow: var( --wpds-elevation-xs )` | `@wordpress/theme` removed the elevation properties. The declaration was dropped; no shadow, no warning. The build stops on it now (`Unknown design token`), in a stylesheet. |
| A `--wpds-*` name that does not exist, in a `style` prop or a JavaScript string | Same silence, and the build does not reach it. CSS drops the declaration and nothing reports it. |
| Two elements, one after the other, in a `Card.Content` | `Card.Content` pads itself and does not space its children; a fragment does not either. They touch — 0px, measured — and the source looks fine. A `Stack direction="column"` with a `gap` holds them. |
| `.thing svg { fill: white; }` | `@wordpress/icons` 17 draws most icons as strokes carrying `fill: none` inline. The rule does nothing; `color` recolours them. |
| `<Notice.Root status="error" isDismissible>` | That is the `@wordpress/components` API. The `@wordpress/ui` notice takes `intent`, and is dismissible when it holds a `Notice.CloseIconButton`. |
| A `Notice` that appears, and nothing that reads it out | `@wordpress/ui` 0.23 announced a notice itself, and 0.24 stopped. It renders the same, and a screen reader hears nothing. Call `speak()` from `@wordpress/a11y` when it appears. |
| `page.getByLabel( 'Enable Feature' )` on a switch or a radio of `@wordpress/ui` | The control is a `role="switch"` or `role="radio"` element with a hidden input beside it, and the label names both: strict mode stops on two elements. `getByRole( 'switch', { name } )` finds the one a person uses. |
| `import { LinkButton } from '@wordpress/ui'`, or `<Notice.CloseIcon>` | Names 0.24 took away, for `ButtonLink` and `Notice.CloseIconButton`: `undefined`, and #130 again. |
| `<Stack direction="column" align="start">` around a button and a notice | `align` applies to every child. The button stays as wide as its label, which was the point, and the notice collapses to 26px with its text one word to a line. It only shows after the button is clicked. Buttons go in `<Stack direction="row">`. |
| A custom property set on a screen's root, or on `body`, to recolour it | A theme provider writes its values inline on `<html>` and on its own element, and WordPress sets `--wp-admin-theme-color` on `body.admin-color-*`. A value set above either never arrives. Read it back with `getComputedStyle` on the control. |
| An element rule (`button { color: inherit; }`) outside a cascade layer | `@wordpress/ui` styles are in a layer, and a rule outside one outranks them whatever its specificity: a filled button had its label dark on a dark fill. |
| `<CheckboxControl onValueChange={…}>` | A checkbox takes `checked` and `onCheckedChange`. Text, select and radio controls take `onValueChange`. Neither takes `onChange`. |
| `import { DataViews } from '@wordpress/dataviews'` on a second screen | The package's stylesheet is a separate file. The table renders without it: 1275px wide in a 2293px frame, headers centred. Import it from `src/components/DataViews`. |
| `styles: { name: { width: '18%' } }` where `name` is the `titleField` | DataViews sizes the primary column itself and ignores the style. |
| A line clamp on `.dataviews-view-table__cell-content-wrapper` | DataViews makes that element a row that does not wrap, through a more specific selector. The text is cut at the edge with no ellipsis. Clamp the value in the field's `render`. |
| `<ConfirmDialog title="Move to trash?">` | The title is the dialog's accessible name and is not drawn. The body has to ask the question. |
| `<EmptyState.Root>` straight into a page | It centres its content, not itself, and sits at the left edge. |

**How to not be in this table:** open the package before you use it.

```bash
# What does it really export?
cat node_modules/@wordpress/ui/build-types/form/input-control/types.d.ts
grep -o "export *{[^}]*}" node_modules/@wordpress/dataviews/build-module/index.mjs

# Which design tokens actually exist?
grep -o -- "--wpds-[a-z0-9-]*" node_modules/@wordpress/theme/prebuilt/css/design-tokens.css | sort -u
```

## Copy from the sibling, not from memory

Three defects came from inventing a value that an existing file already held:

- **A REST namespace was written as `plugin-slug`** when every other endpoint in
  the plugin used `plugin-slug/v1`. The route registered at the wrong path and
  the screen got a 404. `Settings_Endpoint::get_rest_namespace()` was two files
  away.
- **A page's localized object name was copied from another page and not
  changed**, so `window.<name>` was `undefined` on the new screen and every
  request silently had no nonce and no path.
- **A new admin page rebuilt its own header** instead of using the shell, and
  looked nothing like the rest of the plugin.

Before adding a route, a page, an endpoint or a screen: **open the one that
already exists and follow it.** If there is a shared component for it — there is
one for pages and one for modals — use that instead of writing a second version.

## Commands lie when you pipe them

Twice, a failing command was reported as successful:

```bash
npm run build | tail -5          # exit code is tail's, always 0
npm install --silent | tail -2   # hid "insufficient space on your system"
```

The pipeline's exit status is the **last** command's. A build that failed and a
disk that filled both reported success.

```bash
set -o pipefail                  # then the pipeline fails when any stage does
npm run build > /tmp/b.log 2>&1; echo "exit=$?"
```

**Check `$?` before saying something worked.** "The output looked fine" is not a
result.

## Your own checks can be wrong in both directions

A guard was added to catch stylesheets reading tokens that no longer exist. It
then failed twice for reasons that were not the codebase's fault:

- It scanned **comments**, so a stylesheet explaining *why* a token was removed
  reported itself as still using it.
- It scanned **documentation**, so a guidance file describing the removed token
  failed the build.

A check that has never failed has not been tested. **Make it fail on purpose
before you trust it** — break the thing it guards, watch it complain, put it
back:

```bash
# Prove the guard catches what it claims to. In this plugin the guard is
# scaffold:update, which reports stylesheets that read a retired token.
echo '.probe { box-shadow: var(--wpds-elevation-xs); }' >> src/components/Default/default.scss
if vendor/bin/webhead scaffold:update --path=. --dry-run | grep -qF -- '--wpds-elevation-xs'; then echo caught; else echo 'NOT caught: the guard is not working'; fi
git checkout -- src/components/Default/default.scss
```

Check that the guard names the thing you broke, not merely that something
failed: a command that does not exist also exits non-zero.

## A screen is every state it has

A page was built, opened, measured and reported as correct. The person who asked for it clicked
its one button, and the notice that appeared was 26px wide. Nothing that had been checked was
wrong; the state that was wrong had never been on the screen.

**Opening a screen checks one state of it.** Before saying a screen works:

- **Click every action** and look at what appears: the notice, the busy button, the toast.
- **Open every overlay**: the menu, the confirmation, the modal. Tick what gates a button and
  look at the button again.
- **Make every field wrong** once, and make a save fail, and read what the screen says.
- **Empty the list.** A table has a state with no rows and one with a filter that matches none.
- **Select something**: a row, several rows, a tab that is not the first.
- **Narrow the window** to a phone's width, where the menu collapses and the header's actions
  move under the title.
- **Switch to a right-to-left language**, when the plugin will be used in one. The build writes a
  mirrored stylesheet and the framework tells WordPress about it, but a `left` or a `right`
  written into a `style` prop is not mirrored by anything.

Two things about the tools:

- **Read the numbers, not the picture.** A screenshot scaled to fit made dark grey text look red.
  The computed colour was the one the stylesheet asked for.
- **`document.documentElement.style.zoom` misplaces overlays.** It makes a wide layout in a narrow
  window, and it is the right tool for widths, but a popover positioned while it is set opens in
  the wrong place. Check menus and popovers at zoom 1.

## Measure the page; do not look at it

A screenshot shows that something rendered, not that it is right. Every one of
these caught a defect the eye passed over:

```js
// A token that resolves to nothing looks exactly like a rule you forgot to write.
getComputedStyle( document.documentElement ).getPropertyValue( '--wpds-typography-font-weight-emphasis' );

// Does any card supply its own separating margin? The container should own it.
[ ...document.querySelectorAll( '[class*="card"]' ) ].map( ( c ) => getComputedStyle( c ).marginBottom );

// Is the control actually named for assistive tech, or only visually?
const input = document.querySelector( 'input' );
input.labels?.[ 0 ]?.textContent || input.getAttribute( 'aria-label' );

// At a narrow viewport: the tab strip scrolls, the page does not.
const list = document.querySelector( '[role="tablist"]' );
list.scrollWidth > list.clientWidth && document.documentElement.scrollWidth <= document.documentElement.clientWidth;
```

When a component fails to render, **get the name** rather than guessing which
import is wrong. An error boundary reports it in production builds:

```jsx
class Boundary extends Component {
    static getDerivedStateFromError( error ) { return { error }; }
    componentDidCatch( error, info ) { window.__failure = { message: error.message, stack: info.componentStack }; }
    render() { return this.state?.error ? 'failed' : this.props.children; }
}
```

## The package on disk is not always the package on the page

`node_modules/@wordpress/components` is the right place to check a **prop, an
export, or a type**. It is *not* the authority on **CSS**, because WordPress core
enqueues its own bundled `wp-components` stylesheet, and that is what renders.
The two can differ:

```css
/* node_modules/@wordpress/components/build-style/style.css */
outline: … solid var(--focus-color, var(--wpds-color-stroke-focus, …));
/* what the browser actually applied, from core's load-styles.php */
outline: … solid var(--wpds-color-stroke-focus, …);
```

A whole fix was written against the first line and did nothing, because the
second is the one on the page. **For anything visual, ask the page which rule
won** rather than reading a stylesheet and assuming:

```js
// Dump every rule that mentions the component and touches the property, raw.
const hits = [];
for ( const sheet of document.styleSheets ) {
    let rules; try { rules = sheet.cssRules } catch ( e ) { continue }
    for ( const r of rules ) {
        if ( r.selectorText?.includes( 'components-button' ) && /outline|border/.test( r.cssText ) ) {
            hits.push( { src: sheet.href, css: r.cssText } );
        }
    }
}
```

## Your scanner can hide the very rule you are looking for

The scan above deliberately does **no** `element.matches()` filtering. An earlier
version of it did, and silently dropped the answer twice:

- The pseudo-class stripper ran `:(hover|focus|active)` over the whole selector,
  so `:focus:not(:active)` became `:focus:not()` — invalid, thrown, swallowed by
  the `catch`. That was the rule being hunted, both times.
- Alternation order put `focus` before `focus-visible`, so `:focus-visible`
  became `-visible` — invalid again.

Both looked like "no rule matches", which reads as a clean bill of health. If a
scan returns nothing, **prove the scan can return something** before believing
it. Filter after collecting, never inside the collector.

## Three ways the browser lies about state

- **`document.activeElement` is not `:focus`.** With the pane unfocused, a
  programmatic `.focus()` sets `activeElement` while `el.matches(':focus')` stays
  false and no focus ring computes. Measure focus styling after a real click or
  keypress, and assert `el.matches(':focus')` in the same read.
- **A transitioned property reads at its start value.** The pane suspends
  `requestAnimationFrame` while hidden, so a hover that transitions
  `background-color` measures as the pre-hover colour indefinitely. Force frames
  with a few screenshots, then re-read. This is the same artifact that makes an
  entrance animation measure as `opacity: 0`.
- **A probe that asks for a frame changes the frame.** Sampled from a
  `requestAnimationFrame` loop, a header's words never flickered; on the screen
  each was gone for a frame. Read what an animation leaves from its `finish`
  event, through a `MessageChannel` message, which asks for no frame.

## Rebuild after you change PHP that adds a class

A new class added after `composer dump-autoload` is not autoloaded, and the
symptom is a 404 or a missing service rather than a "class not found". After
adding a PHP class to a plugin, run `composer dump-autoload` before concluding
that the registration is wrong.

## What only shows up in a real plugin on a real site

Every one of these had passing tests when it was found.

- **`$wpdb->insert_id` after `$table->insert()` is not the row's id.** The write
  invalidates the table's cache group, which can store an option, and the first
  time that is a new row in the options table. Use `$table->insert_get_id()`.
- **A label translated in a `register_*()` method is translated while the
  plugin boots.** It costs a query on every request and raises "translation
  loading was triggered too early". Give a closure where the API takes one.
- **An inline style beats a responsive control.** A widget that prints
  `style="--columns:3"` and also declares the property through Elementor
  `selectors` shows three columns on every screen. Print one or the other.
- **A spec that asks `isVisible()` once and skips is a spec that never runs.**
  The React app has not fetched its data when the page has loaded. Wait with
  `await expect( locator ).toBeVisible()`, and read "1 skipped" as a failure
  until you know why.
- **The integration suite has no active plugin.** It reinstalls the database, so
  a companion plugin is not loaded unless `tests/Integration/bootstrap-extra.php`
  requires it, and a test that needs it passes by skipping.
- **wp-env names a plugin's folder after its zip file.** `x.latest-stable.zip`
  becomes `x.latest-stable/`, which `Requires Plugins: x` does not match. Use
  `x.zip`, and list it before `.` in `.wp-env.json`.
- **An admin screen inside another plugin's screen shares its URL.** The
  settings app remembers its open group in the URL; inside WooCommerce >
  Settings, `tab` is WooCommerce's own argument and must not be written over.
- **A width cap cannot be seen on a screen narrower than the cap.** A second
  admin page was 1440px wide beside a settings screen of 2340px, and 20px to its
  left. It had been opened and tested, every time at laptop width and every time
  on its own. Put two screens side by side as numbers, at a viewport wider than
  any laptop; `is drawn by the page shell and fills the frame it is given` in
  `tests/e2e/specs/settings-page.spec.js` does it at 2400px, and is one of the
  two tests to copy for each page you add.
- **Two things that touch look like a choice in a screenshot.** A page was
  built with a paragraph and a button in one `Card.Content`, and they sat
  flush against each other: nothing in a card spaces its children. It was
  opened, looked at and passed. `leaves a gap between everything it stacks`
  in the same spec measures it, and is the other test to copy.
- **A directory that is there is read as a directory that is used.** A
  `templates` directory holding a placeholder, an `Example_*` class nobody
  registers, an `index.php` that says nothing: each is kept by whoever comes
  next, and copied. Create a directory with its first file, delete it with its
  last, and delete an example you are not building on together with its test.

## Before you say it is done

- [ ] Every new import was checked against the installed package.
- [ ] Every new route, page or endpoint follows the sibling that already exists.
- [ ] `npm run build` was run and its **exit code** was zero.
- [ ] The screen was opened and **measured**, not just screenshotted.
- [ ] Every screen you touched was compared with the settings screen, as numbers,
      at a viewport wider than 1920px.
- [ ] Nothing was left behind: no empty directory, no placeholder file, no example
      the plugin does not use.
- [ ] The browser console was read, and any error was traced to its source
      rather than assumed to be stale.
- [ ] Any check you added was made to fail on purpose at least once.
