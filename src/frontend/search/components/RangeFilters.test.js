/**
 * @jest-environment node
 *
 * The range controls for numeric facet fields. A field the site names itself
 * (`fieldLabels` of the storefront config, passed down by the search window)
 * is headed and announced by that name.
 */
// `renderToString` of `@wordpress/element` calls a component as a function,
// which a component with state cannot be; React's own server renderer can,
// and its Node build is the one that runs without a browser's TextEncoder.
import { renderToStaticMarkup } from 'react-dom/server';

import RangeFilters from './RangeFilters';

const render = ( props ) =>
	renderToStaticMarkup(
		<RangeFilters fields={ { attr_width: { min: 10, max: 90 } } } active={ {} } onApply={ () => {} } busy={ false } { ...props } />
	);

describe( 'RangeFilters', () => {
	it( 'heads a field with the name the site gives it', () => {
		const html = render( { labels: { attr_width: 'Breite' } } );

		expect( html ).toContain( '<span class="whsc-facet-group__label">Breite</span>' );
		expect( html ).toContain( 'aria-label="Minimum Breite"' );
	} );

	it( 'humanizes the key of a field the site does not name', () => {
		expect( render( {} ) ).toContain( '<span class="whsc-facet-group__label">Width</span>' );
	} );
} );
