/**
 * The JavaScript unit suite, run by `npm run test:js`.
 *
 * `@wordpress/scripts` 36 moved `test-unit-js` to Vitest and stopped bundling
 * Jest, its preset and its Babel transform. This suite is written for Jest
 * (`jest.mock()`, `jest.resetModules()` with `require()`, fake timers), so it
 * keeps it through `wp-scripts test-unit-jest`, with the combination the
 * scripts migration guide lists as tested.
 */
module.exports = {
	preset: '@wordpress/jest-preset-default',
	transform: {
		'\\.m?[jt]sx?$': [
			'babel-jest',
			{ presets: [ '@wordpress/babel-preset-default' ] },
		],
	},
	// `@wordpress/ui` loads `@wordpress/theme`, which is published as ES
	// modules only. Compiled, it lets a test draw the real controls instead
	// of a stand-in that cannot show how they hand over a value.
	transformIgnorePatterns: [ '/node_modules/(?!@wordpress/theme/)' ],
	// A checkout holds other checkouts under `.claude/worktrees`, each with a
	// suite of its own; the end-to-end specs are Playwright's.
	testPathIgnorePatterns: [
		'<rootDir>/node_modules/',
		'<rootDir>/vendor/',
		'<rootDir>/public/',
		'<rootDir>/tests/',
		'<rootDir>/\\.claude/',
	],
	modulePathIgnorePatterns: [ '<rootDir>/\\.claude/' ],
};
