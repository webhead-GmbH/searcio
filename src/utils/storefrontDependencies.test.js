/**
 * Guards what the storefront bundle is made of.
 *
 * `@wordpress/components` alone is more than 800 KB of JavaScript, and it
 * drags the date library, the rich-text editor and the data layer in behind
 * it. The storefront once imported it for an icon, a tooltip, a dialog and a
 * search field, and every page with a search trigger paid for all of it before
 * the visitor typed a letter. Its components are now written for the
 * storefront (`src/frontend/search/ui`), and this test keeps the heavy
 * packages from coming back in through any file the entry reaches, however
 * far down the import chain.
 */

const fs = require( 'fs' );
const path = require( 'path' );

const ROOT = path.resolve( __dirname, '../..' );
const ENTRY = path.join( ROOT, 'src/frontend/search/index.js' );

// Packages whose size or weight on a page is not worth what the storefront takes from them.
const HEAVY = [
	'@wordpress/components',
	'@wordpress/data',
	'@wordpress/core-data',
	'@wordpress/date',
	'@wordpress/block-editor',
	'@wordpress/blocks',
	'@wordpress/dataviews',
	'@wordpress/notices',
	'@wordpress/rich-text',
	'@wordpress/theme',
	'@wordpress/ui',
];

const IMPORT = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;

const resolve = ( from, request ) => {
	const base = path.resolve( path.dirname( from ), request );

	return [ base, `${ base }.js`, path.join( base, 'index.js' ) ].find( ( file ) => fs.existsSync( file ) && fs.statSync( file ).isFile() );
};

/** Every file the entry reaches through relative imports, and every package those files import. */
const reached = () => {
	const files = new Set();
	const packages = new Map();
	const queue = [ ENTRY ];

	while ( queue.length ) {
		const file = queue.pop();

		if ( files.has( file ) ) {
			continue;
		}

		files.add( file );

		if ( ! file.endsWith( '.js' ) ) {
			continue;
		}

		const source = fs.readFileSync( file, 'utf8' );

		for ( const match of source.matchAll( IMPORT ) ) {
			const request = match[ 1 ] || match[ 2 ];

			if ( request.startsWith( '.' ) ) {
				const next = resolve( file, request );

				if ( next ) {
					queue.push( next );
				}
			} else {
				packages.set( request, [ ...( packages.get( request ) || [] ), path.relative( ROOT, file ).split( path.sep ).join( '/' ) ] );
			}
		}
	}

	return { files, packages };
};

describe( 'storefront bundle', () => {
	const { files, packages } = reached();

	it( 'reaches the files of the storefront', () => {
		// A guard that reads nothing guards nothing.
		expect( files.size ).toBeGreaterThan( 20 );
		expect( packages.has( '@wordpress/element' ) ).toBe( true );
	} );

	it( 'imports none of the heavy WordPress packages, from any file it reaches', () => {
		const found = [ ...packages.entries() ]
			.filter( ( [ name ] ) => HEAVY.some( ( heavy ) => name === heavy || name.startsWith( `${ heavy }/` ) ) )
			.map( ( [ name, importers ] ) => `${ name } (${ [ ...new Set( importers ) ].join( ', ' ) })` );

		expect( found ).toEqual( [] );
	} );

	it( 'imports every package it uses from the dependencies of the plugin', () => {
		const manifest = JSON.parse( fs.readFileSync( path.join( ROOT, 'package.json' ), 'utf8' ) );
		const declared = new Set( [ ...Object.keys( manifest.dependencies || {} ), ...Object.keys( manifest.devDependencies || {} ) ] );
		const undeclared = [ ...packages.keys() ]
			.map( ( name ) => name.split( '/' ).slice( 0, name.startsWith( '@' ) ? 2 : 1 ).join( '/' ) )
			.filter( ( name ) => ! declared.has( name ) && ! [ 'react', 'react-dom' ].includes( name ) );

		expect( [ ...new Set( undeclared ) ] ).toEqual( [] );
	} );
} );
