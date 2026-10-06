---
name: webhead-e2e-testing
description: "Use this skill when writing or debugging webhead Search Cloud's Playwright end-to-end specs: tests/e2e, playwright.config.js, admin authentication, seeding data for the browser, flaky specs, or a spec that cannot find its element."
license: MIT
metadata:
  author: webhead
---

# webhead End-to-End Testing

Playwright drives a real browser against the wp-env tests site. It is the slowest and most fragile tier, so it earns its place only where the browser is the sole place the pieces meet: an admin screen actually rendering, a block actually appearing on a page, a save round-tripping through REST and surviving a reload.

## Running It

```
npm run env:start
npm run build          # only if this plugin has a build; E2E drives the built bundle
npm run test:e2e
npm run test:e2e:headed
```

Target one spec or one test:

```
npm run test:e2e -- tests/e2e/specs/smoke.spec.js
npm run test:e2e -- --grep "saves a setting"
```

Specs run against `http://localhost:8889` — the wp-env **tests** site, not the development site on 8888. If you change ports in a local `.wp-env.override.json`, set `WP_BASE_URL` to match, or the suite silently drives the wrong site.

## Fixtures

`tests/e2e/utils.js` re-exports `test` and `expect` from `@wordpress/e2e-test-utils-playwright`. Import from there, never from `@playwright/test` directly, or you lose the fixtures.

| Fixture | Use |
| --- | --- |
| `admin` | `visitAdminPage( 'admin.php', 'page=webhead-search-cloud' )` |
| `page` | The Playwright page |
| `requestUtils` | REST calls as an administrator: `createPost()`, `rest()`, cleanup |
| `editor` | Block editor interactions |

Authentication is already handled: the base config's global setup signs in as an administrator and stores the session. To test as a logged-out visitor, opt out explicitly:

```js
test.use( { storageState: { cookies: [], origins: [] } } );
```

## Seeding Data

Prefer `requestUtils` — it is fast, runs over REST, and cleans up.

```js
const post = await requestUtils.createPost( { title: 'T', content: '…', status: 'publish' } );
await page.goto( post.link );
```

Use `wpEvalFile()` from `tests/e2e/utils.js` only for what REST cannot reach: custom table rows, serialized builder payloads such as Elementor's `_elementor_data`, and post meta no endpoint exposes. Put the PHP script in `tests/e2e/` and print what the spec needs on stdout.

## Writing Specs That Do Not Flake

- Assert with web-first assertions (`await expect( locator ).toBeVisible()`). They retry. `waitForTimeout` does not, and a fixed sleep is always either too short on CI or wasted locally.
- Never assert on a server-rendered placeholder that React later replaces. Wait for the hydrated control instead.
- Prefer role and label locators (`getByRole`, `getByLabel`) over CSS. They survive markup changes and they fail loudly when accessible naming regresses — which is itself worth catching.
- Each spec must set up its own state. Specs share one site and the run order is not guaranteed. If a spec changes a global setting, restore it in `afterAll`.
- Keep one behavior per test. A test that walks through five screens tells you nothing useful when it fails on step four.

## Skipping Honestly

A spec whose subject is not enabled must skip with a message that says what to do, rather than fail:

```js
test.skip( ! ( await isBlockRegistered( requestUtils ) ), 'Example_Block is not registered. Uncomment its Blocks_Manager registration in includes/Plugin.php and run `npm run build`.' );
```

Use `isPluginActive( requestUtils, 'elementor' )` for specs that need a companion plugin, so the suite still passes on an install without it.

## Viewports

`playwright.config.js` defines one desktop project. A commented mobile project sits next to it — enable it once this plugin has a public-facing surface worth proving in both layouts, and accept that it doubles the run time.

## Debugging

- `npm run test:e2e:headed` to watch it run.
- Traces, screenshots, and videos for failures land in `artifacts/`. CI uploads that directory when the job fails.
- `await page.pause()` opens the Playwright inspector.
- Check the browser console for a React mount failure before suspecting the selector: an unbuilt or unenqueued bundle looks exactly like a missing element.
- A `503` on every request, with "Briefly unavailable for scheduled maintenance" in the failure's page snapshot, is WordPress updating itself, not this plugin. `.wp-env.json` sets `AUTOMATIC_UPDATER_DISABLED` so a new environment does not start one; keep that constant when editing the file.
