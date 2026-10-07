// Webhead scaffold managed file. scaffold:update may refresh this file.
const path = require( 'path' );
const DependencyExtractionWebpackPlugin = require( '@wordpress/dependency-extraction-webpack-plugin' );
const defaults = require( '@wordpress/scripts/config/webpack.config' );

const shouldBundleWordPressPackage = ( request ) => (
	request.endsWith( '.css' )
	|| request === '@wordpress/theme'
	|| request.startsWith( '@wordpress/theme/' )
);

const markStyleRulesSideEffectful = ( rules = [] ) => rules.map( ( rule ) => {
	const nextRule = { ...rule };

	if ( Array.isArray( nextRule.oneOf ) ) {
		nextRule.oneOf = markStyleRulesSideEffectful( nextRule.oneOf );
	}

	const ruleTest = String( nextRule.test || '' );

	if ( ruleTest.includes( 'css' ) || ruleTest.includes( 'sc|sa' ) ) {
		nextRule.sideEffects = true;
	}

	return nextRule;
} );

/**
 * Hands every stylesheet to the design system's own PostCSS plugin.
 *
 * It gives each bare `var( --wpds-* )` the value the token has in the installed
 * `@wordpress/theme`, so a rule still paints on a page the token stylesheet did
 * not reach. And it stops the build at a token that package does not define.
 * A custom property that does not exist is not a CSS error, so a mistyped or
 * retired token used to cost a screen its padding or a colour with nothing in
 * the build output to say so.
 *
 * The plugin is an ES module. `require()` loads one on the Node this project's
 * `package.json` asks for.
 */
const designTokenFallbacks = require( '@wordpress/theme/postcss-plugins/postcss-ds-token-fallbacks' ).default;

const withDesignTokenFallbacks = ( rules = [] ) => rules.map( ( rule ) => {
	const nextRule = { ...rule };

	if ( Array.isArray( nextRule.oneOf ) ) {
		nextRule.oneOf = withDesignTokenFallbacks( nextRule.oneOf );
	}

	if ( Array.isArray( nextRule.use ) ) {
		nextRule.use = nextRule.use.map( ( loader ) => {
			const postcssOptions = loader?.options?.postcssOptions;

			if ( ! postcssOptions || ! Array.isArray( postcssOptions.plugins ) ) {
				return loader;
			}

			return {
				...loader,
				options: {
					...loader.options,
					postcssOptions: {
						...postcssOptions,
						plugins: [ designTokenFallbacks, ...postcssOptions.plugins ],
					},
				},
			};
		} );
	}

	return nextRule;
} );

module.exports = {
	...defaults,
	mode: process.env.NODE_ENV || 'production',
	entry: {
		'bundle.default': path.resolve( process.cwd(), 'src', 'components', 'Default', 'index.js' ),
		'bundle.settings': path.resolve( process.cwd(), 'src', 'admin', 'settings', 'index.js' ),
		'bundle.search': path.resolve( process.cwd(), 'src', 'frontend', 'search', 'index.js' ),
		'bundle.search-block-editor': path.resolve( process.cwd(), 'src', 'blocks', 'search', 'index.js' ),
		'bundle.products-block-editor': path.resolve( process.cwd(), 'src', 'blocks', 'products', 'index.js' ),
	},
	output: {
		filename: '[name].js',
		path: path.resolve( process.cwd(), 'public' ),
		clean: true,
	},
	module: {
		...defaults.module,
		rules: withDesignTokenFallbacks( markStyleRulesSideEffectful( defaults.module?.rules ) ),
	},
	plugins: [
		...defaults.plugins.filter(
			( plugin ) => plugin.constructor.name !== 'DependencyExtractionWebpackPlugin'
		),
		new DependencyExtractionWebpackPlugin( {
			requestToExternal( request ) {
				if ( shouldBundleWordPressPackage( request ) ) {
					return false;
				}

				return undefined;
			},
		} ),
	],
	externalsType: defaults.externalsType,
	externals: {
		...defaults.externals,
		react: 'React',
		'react-dom': 'ReactDOM',
	},
	resolve: {
		...defaults.resolve,
		// A package is looked for the way Node looks for it: in the
		// `node_modules` nearest to the file that asks, and then upwards. So a
		// package gets the copy of a dependency that npm installed for it.
		//
		// This used to name the top `node_modules` of the plugin as the only
		// place to look. When two packages need different releases of a third,
		// npm puts one at the top and the other under the package that needs
		// it, and from there it was never read. `motion` 14 ran on the
		// `framer-motion` 11 that `@wordpress/components` brings, and nothing
		// said so: the build passed, and every word of a page header went out
		// for one frame at the end of its fade, which that release does and
		// the one `motion` asked for does not.
		//
		// What that line was there for is kept by the restriction. Nothing
		// outside the plugin is bundled, so a package the manifest forgot
		// stops the build here, and not on the next machine, where no
		// directory above the plugin happens to hold it.
		restrictions: [ __dirname ],
		extensions: [
			...( defaults.resolve ? defaults.resolve.extensions || [ '.js', '.jsx', '.ts', '.tsx' ] : [] ),
		],
	},
};
