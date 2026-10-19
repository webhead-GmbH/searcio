/**
 * Guards `languages/script-translation-map.json`.
 *
 * The map tells `wp i18n make-json` which built bundle each source file ends up
 * in. A file missing from it is silently untranslatable in the browser - its
 * strings are extracted into the POT and can be translated in the PO, but they
 * never reach the JS translation JSON, so the UI stays English however complete
 * the translation is. That is exactly what happened to the whole AI Assistant
 * surface: `AiAssistant.js` and `CompareTable.js` were added without being
 * mapped, and nothing failed until someone looked at a German storefront.
 */

const fs = require( 'fs' );
const path = require( 'path' );

const ROOT = path.resolve( __dirname, '../..' );
const MAP_PATH = path.join( ROOT, 'languages/script-translation-map.json' );

// Matches the i18n calls `make-pot` itself extracts.
const I18N_CALL = /\b(?:__|_n|_x|_nx)\s*\(/;

const sourceFiles = ( dir ) => {
	const out = [];

	for ( const entry of fs.readdirSync( dir, { withFileTypes: true } ) ) {
		const full = path.join( dir, entry.name );

		if ( entry.isDirectory() ) {
			out.push( ...sourceFiles( full ) );
		} else if ( entry.name.endsWith( '.js' ) && ! entry.name.endsWith( '.test.js' ) ) {
			out.push( full );
		}
	}

	return out;
};

const translatableFiles = () => sourceFiles( path.join( ROOT, 'src' ) )
	.filter( ( file ) => I18N_CALL.test( fs.readFileSync( file, 'utf8' ) ) )
	.map( ( file ) => path.relative( ROOT, file ).split( path.sep ).join( '/' ) );

describe( 'script translation map', () => {
	const map = JSON.parse( fs.readFileSync( MAP_PATH, 'utf8' ) );

	it( 'lists every source file that has translatable strings', () => {
		const missing = translatableFiles().filter( ( file ) => ! map[ file ] );

		expect( missing ).toEqual( [] );
	} );

	it( 'does not list files that no longer have translatable strings', () => {
		const translatable = new Set( translatableFiles() );
		const stale = Object.keys( map ).filter( ( file ) => ! translatable.has( file ) );

		expect( stale ).toEqual( [] );
	} );

	it( 'points every entry at a bundle that the build actually produces', () => {
		const bundles = new Set( Object.values( map ).flat() );

		bundles.forEach( ( bundle ) => {
			expect( fs.existsSync( path.join( ROOT, bundle ) ) ).toBe( true );
		} );
	} );

	/** A frontend file mapped to the admin bundle would never load on a storefront. */
	it( 'maps frontend sources to the frontend bundle', () => {
		Object.entries( map )
			.filter( ( [ file ] ) => file.startsWith( 'src/frontend/search/' ) )
			.forEach( ( [ file, bundles ] ) => {
				expect( [ file, bundles ] ).toEqual( [ file, [ 'public/bundle.search.js' ] ] );
			} );
	} );
} );
