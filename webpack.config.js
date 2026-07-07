const path = require( 'path' );
const DependencyExtractionWebpackPlugin = require( '@wordpress/dependency-extraction-webpack-plugin' );
const defaults = require( '@wordpress/scripts/config/webpack.config' );

const shouldBundleWordPressPackage = ( request ) => (
	request === '@wordpress/theme' || request.startsWith( '@wordpress/theme/' )
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

module.exports = {
	...defaults,
	mode: process.env.NODE_ENV || 'production',
	entry: {
		'bundle.default': path.resolve( process.cwd(), 'src', 'components', 'Default', 'index.js' ),
		'bundle.settings': path.resolve( process.cwd(), 'src', 'admin', 'settings', 'index.js' ),
		'bundle.search': path.resolve( process.cwd(), 'src', 'frontend', 'search', 'index.js' ),
		'bundle.search-block-editor': path.resolve( process.cwd(), 'src', 'blocks', 'search', 'index.js' ),
	},
	output: {
		filename: '[name].js',
		path: path.resolve( process.cwd(), 'public' ),
		clean: true,
	},
	module: {
		...defaults.module,
		rules: markStyleRulesSideEffectful( defaults.module?.rules ),
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
		modules: [ path.resolve( __dirname, 'node_modules' ) ],
		extensions: [
			...( defaults.resolve ? defaults.resolve.extensions || [ '.js', '.jsx', '.ts', '.tsx' ] : [] ),
		],
	},
};
