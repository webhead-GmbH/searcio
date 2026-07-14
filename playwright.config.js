/**
 * Playwright end-to-end test configuration.
 *
 * Extends the `@wordpress/scripts` base config (admin auth global-setup, wp-env
 * web server, artifacts/tracing) and layers on this plugin's needs: the specs
 * live under `tests/e2e/specs`, and every spec runs twice — once on a desktop
 * viewport and once on a mobile device profile — so the search modal is proven
 * in both layouts. Run with `npm run test:e2e` (wp-env must be started, or
 * Playwright's `webServer` will start it).
 */

const path = require( 'path' );
const { devices } = require( '@playwright/test' );

const baseConfig = require( '@wordpress/scripts/config/playwright.config' );

module.exports = {
	...baseConfig,
	testDir: path.join( __dirname, 'tests/e2e/specs' ),
	projects: [
		{
			name: 'desktop-chrome',
			use: { ...devices[ 'Desktop Chrome' ], viewport: { width: 1280, height: 900 } },
		},
		{
			name: 'mobile-chrome',
			use: { ...devices[ 'Pixel 5' ] },
		},
	],
};
