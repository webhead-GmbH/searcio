---
name: webhead-verify-before-you-write
description: "Read this before writing code against any package, and before reporting that anything works. It is a list of mistakes that were actually made in webhead Search Cloud's codebase and how each one was caught — every entry cost real debugging time, and every one was avoidable by reading instead of recalling."
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
| `<ToggleControl hideLabelFromVision>` | `ToggleControl` renders its own label and ignores the prop entirely. |
| `box-shadow: var( --wpds-elevation-xs )` | `@wordpress/theme` removed the elevation properties. The declaration is dropped; no shadow, no warning. |
| A `--wpds-*` name that does not exist | Same silence. CSS drops the declaration and nothing reports it. |

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

## Two ways the browser lies about state

- **`document.activeElement` is not `:focus`.** With the pane unfocused, a
  programmatic `.focus()` sets `activeElement` while `el.matches(':focus')` stays
  false and no focus ring computes. Measure focus styling after a real click or
  keypress, and assert `el.matches(':focus')` in the same read.
- **A transitioned property reads at its start value.** The pane suspends
  `requestAnimationFrame` while hidden, so a hover that transitions
  `background-color` measures as the pre-hover colour indefinitely. Force frames
  with a few screenshots, then re-read. This is the same artifact that makes an
  entrance animation measure as `opacity: 0`.

## Rebuild after you change PHP that adds a class

A new class added after `composer dump-autoload` is not autoloaded, and the
symptom is a 404 or a missing service rather than a "class not found". After
adding a PHP class to a plugin, run `composer dump-autoload` before concluding
that the registration is wrong.

## Before you say it is done

- [ ] Every new import was checked against the installed package.
- [ ] Every new route, page or endpoint follows the sibling that already exists.
- [ ] `npm run build` was run and its **exit code** was zero.
- [ ] The screen was opened and **measured**, not just screenshotted.
- [ ] The browser console was read, and any error was traced to its source
      rather than assumed to be stale.
- [ ] Any check you added was made to fail on purpose at least once.
