let mockCurrency = {};

jest.mock( '../../../utils/api', () => ( {
	getConfig: () => ( { currency: mockCurrency } ),
} ) );

// eslint-disable-next-line import/first -- must follow the jest.mock() call above.
import {
	postProcessMarkup,
	escapeHtml,
	evaluateCondition,
	evaluateConditions,
	matchTemplate,
	substitutePlaceholders,
} from './serverCards';

describe( 'escapeHtml', () => {
	it( 'escapes HTML-significant characters', () => {
		expect( escapeHtml( '<script>alert(1)</script>' ) ).toBe( '&lt;script&gt;alert(1)&lt;/script&gt;' );
	} );

	it( 'treats null/undefined as an empty string', () => {
		expect( escapeHtml( null ) ).toBe( '' );
		expect( escapeHtml( undefined ) ).toBe( '' );
	} );

	it( 'stringifies non-string values', () => {
		expect( escapeHtml( 42 ) ).toBe( '42' );
	} );

	it( 'escapes double and single quotes so a value cannot break out of an attribute', () => {
		expect( escapeHtml( 'x" onerror="alert(1)' ) ).toBe( 'x&quot; onerror=&quot;alert(1)' );
		expect( escapeHtml( "x' onerror='alert(1)" ) ).toBe( 'x&#39; onerror=&#39;alert(1)' );
	} );

	it( 'escapes ampersands', () => {
		expect( escapeHtml( 'a & b' ) ).toBe( 'a &amp; b' );
	} );
} );

describe( 'server card XSS hardening', () => {
	it( 'a quote-carrying field value cannot inject an onerror handler through an attribute', () => {
		const hit = { source: { image: 'x" onerror="alert(document.cookie)' } };
		const html = '<img src="{{image}}">';

		const result = postProcessMarkup( substitutePlaceholders( html, hit ), hit );

		// The quote must be escaped so the payload stays trapped inside the src
		// value instead of becoming a live event-handler attribute.
		expect( result ).toContain( '&quot;' );

		const img = new window.DOMParser()
			.parseFromString( result, 'text/html' )
			.querySelector( 'img' );

		expect( img.hasAttribute( 'onerror' ) ).toBe( false );
	} );

	it( 'strips a javascript: scheme from a templated href', () => {
		const hit = { source: { url: 'javascript:alert(1)' } };
		const html = '<a href="{{url}}">Buy</a>';

		const result = postProcessMarkup( substitutePlaceholders( html, hit ), hit );

		expect( result ).not.toContain( 'javascript:' );
		expect( result ).toContain( 'Buy' );
	} );

	it( 'strips a non-image data: URI from a templated href', () => {
		const hit = { source: { url: 'data:text/html,<script>alert(1)</script>' } };
		const html = '<a href="{{url}}">Open</a>';

		const result = postProcessMarkup( substitutePlaceholders( html, hit ), hit );

		expect( result ).not.toContain( 'data:text/html' );
	} );

	it( 'keeps an ordinary relative href untouched', () => {
		const hit = { source: { url: '/products/red-shoes' } };
		const html = '<a href="{{url}}">Shoes</a>';

		const result = postProcessMarkup( substitutePlaceholders( html, hit ), hit );

		expect( result ).toContain( 'href="/products/red-shoes"' );
	} );

	it( 'keeps an http(s) image src untouched', () => {
		const hit = { source: { image: 'https://cdn.example.com/p.jpg' } };
		const html = '<img src="{{image}}">';

		const result = postProcessMarkup( substitutePlaceholders( html, hit ), hit );

		expect( result ).toContain( 'src="https://cdn.example.com/p.jpg"' );
	} );
} );

describe( 'evaluateCondition', () => {
	const hit = { id: 'p-1', source: { title: 'Cap', category: 'cap', price: 20, featured: true } };

	it.each( [
		[ { field: 'title', operator: 'exists' }, true ],
		[ { field: 'missing', operator: 'exists' }, false ],
		[ { field: 'missing', operator: 'not_exists' }, true ],
		[ { field: 'category', operator: 'equals', value: 'cap' }, true ],
		[ { field: 'category', operator: 'equals', value: 'shirt' }, false ],
		[ { field: 'category', operator: 'not_equals', value: 'shirt' }, true ],
		[ { field: 'price', operator: 'gt', value: 10 }, true ],
		[ { field: 'price', operator: 'gt', value: 30 }, false ],
		[ { field: 'price', operator: 'lt', value: 30 }, true ],
		[ { field: 'title', operator: 'contains', value: 'ap' }, true ],
		[ { field: 'title', operator: 'contains', value: 'zzz' }, false ],
		[ { field: 'featured', operator: 'is_true' }, true ],
		[ { field: 'featured', operator: 'is_false' }, false ],
		[ { field: 'unknown_operator', operator: 'nonsense' }, false ],
	] )( '%o -> %s', ( condition, expected ) => {
		expect( evaluateCondition( condition, hit ) ).toBe( expected );
	} );

	it( 'falls back to top-level hit fields when not present in source', () => {
		expect( evaluateCondition( { field: 'id', operator: 'equals', value: 'p-1' }, hit ) ).toBe( true );
	} );

	it( 'compares equals loosely as strings', () => {
		expect( evaluateCondition( { field: 'price', operator: 'equals', value: '20' }, hit ) ).toBe( true );
	} );
} );

describe( 'evaluateConditions', () => {
	const hit = { source: { category: 'cap', price: 20 } };

	it( 'AND-s multiple conditions', () => {
		const conditions = [
			{ field: 'category', operator: 'equals', value: 'cap' },
			{ field: 'price', operator: 'gt', value: 10 },
		];

		expect( evaluateConditions( conditions, hit ) ).toBe( true );
	} );

	it( 'fails if any single condition fails', () => {
		const conditions = [
			{ field: 'category', operator: 'equals', value: 'cap' },
			{ field: 'price', operator: 'gt', value: 100 },
		];

		expect( evaluateConditions( conditions, hit ) ).toBe( false );
	} );

	it( 'matches unconditionally when the list is empty or missing (the default template)', () => {
		expect( evaluateConditions( [], hit ) ).toBe( true );
		expect( evaluateConditions( undefined, hit ) ).toBe( true );
	} );
} );

describe( 'matchTemplate', () => {
	const templates = [
		{ id: 12, type: 'product', is_default: false, conditions: [ { field: 'category', operator: 'equals', value: 'cap' } ] },
		{ id: 9, type: 'product', is_default: true, conditions: [] },
		{ id: 5, type: 'post', is_default: true, conditions: [] },
	];

	it( 'picks the first matching conditional template over the default', () => {
		const hit = { source: { type: 'product', category: 'cap' } };

		expect( matchTemplate( templates, hit )?.id ).toBe( 12 );
	} );

	it( 'falls back to the default template when no conditional template matches', () => {
		const hit = { source: { type: 'product', category: 'shirt' } };

		expect( matchTemplate( templates, hit )?.id ).toBe( 9 );
	} );

	it( 'only considers templates for the hit\'s own type', () => {
		const hit = { source: { type: 'post' } };

		expect( matchTemplate( templates, hit )?.id ).toBe( 5 );
	} );

	it( 'returns null when nothing matches the type at all', () => {
		const hit = { source: { type: 'event' } };

		expect( matchTemplate( templates, hit ) ).toBeNull();
	} );
} );

describe( 'substitutePlaceholders', () => {
	it( 'replaces {{field}} with the escaped hit value', () => {
		const hit = { source: { title: 'Red <Shoes>', url: '/red-shoes' } };
		const html = '<a href="{{url}}">{{title}}</a>';

		expect( substitutePlaceholders( html, hit ) ).toBe( '<a href="/red-shoes">Red &lt;Shoes&gt;</a>' );
	} );

	it( 'replaces a missing field with an empty string', () => {
		const hit = { source: {} };

		expect( substitutePlaceholders( '<span>{{missing}}</span>', hit ) ).toBe( '<span></span>' );
	} );

	it( 'formats a known WooCommerce price field with the store\'s currency config', () => {
		mockCurrency = { decimals: 2, decimalSep: ',', thousandSep: '.', symbol: '€', position: 'right_space' };
		const hit = { source: { price: 1234.5 } };

		expect( substitutePlaceholders( '<span>{{price}}</span>', hit ) ).toBe( '<span>1.234,50 €</span>' );
	} );

	it( 'leaves a non-price field as a raw value even if it happens to look numeric', () => {
		mockCurrency = { symbol: '€', position: 'right' };
		const hit = { source: { quantity: 5 } };

		expect( substitutePlaceholders( '<span>{{quantity}}</span>', hit ) ).toBe( '<span>5</span>' );
	} );
} );

describe( 'postProcessMarkup', () => {
	it( 'removes an element whose data-sc-if conditions do not match', () => {
		const hit = { source: { on_sale: false } };
		const html = '<div><span data-sc-if=\'[{"field":"on_sale","operator":"is_true"}]\'>SALE</span><span>Kept</span></div>';

		const result = postProcessMarkup( html, hit );

		expect( result ).not.toContain( 'SALE' );
		expect( result ).toContain( 'Kept' );
	} );

	it( 'keeps an element whose data-sc-if conditions match', () => {
		const hit = { source: { on_sale: true } };
		const html = '<span data-sc-if=\'[{"field":"on_sale","operator":"is_true"}]\'>SALE</span>';

		expect( postProcessMarkup( html, hit ) ).toContain( 'SALE' );
	} );

	it( 'treats unparsable data-sc-if as an always-false condition list', () => {
		const hit = { source: {} };
		const html = '<span data-sc-if="not-json">Badge</span>';

		expect( postProcessMarkup( html, hit ) ).not.toContain( 'Badge' );
	} );

	it( 'sets --sc-rating-percent from a 0-5 rating field', () => {
		const hit = { source: { rating: 4 } };
		const html = '<div data-sc-rating-field="rating"></div>';

		const result = postProcessMarkup( html, hit );

		expect( result ).toContain( '--sc-rating-percent: 80%' );
	} );

	it( 'clamps and defaults a non-numeric rating to 0%', () => {
		const hit = { source: {} };
		const html = '<div data-sc-rating-field="missing"></div>';

		expect( postProcessMarkup( html, hit ) ).toContain( '--sc-rating-percent: 0%' );
	} );

	it( 'falls back an <img> with an empty src to the placeholder data URI', () => {
		const hit = { source: {} };
		const html = '<img src="" class="product-image">';

		const result = postProcessMarkup( html, hit );

		expect( result ).toContain( 'src="data:image/svg+xml' );
		expect( result ).toContain( 'class="product-image"' );
	} );

	it( 'leaves an <img> with a real src untouched', () => {
		const hit = { source: {} };
		const html = '<img src="https://example.com/photo.jpg">';

		expect( postProcessMarkup( html, hit ) ).toContain( 'src="https://example.com/photo.jpg"' );
	} );
} );

describe( 'postProcessMarkup — price components (data-sc-price)', () => {
	const priceComponent = (
		'<div data-sc-price data-sc-price-field="price" data-sc-regular-field="regular_price" '
		+ 'data-sc-sale-field="sale_price" data-sc-min-field="price_min" data-sc-max-field="price_max" '
		+ 'data-sc-currency="€" data-sc-currency-position="after_space" data-sc-decimals="2" '
		+ 'data-sc-decimal-sep="," data-sc-thousand-sep=".">'
		+ '<span data-sc-price-part="prefix">from</span>'
		+ '<span data-sc-price-part="regular"></span>'
		+ '<span data-sc-price-part="current"></span>'
		+ '</div>'
	);

	it( 'Plain: shows only "current" set to the price field, hides prefix and regular', () => {
		const hit = { source: { price: 1234.5 } };

		const result = postProcessMarkup( priceComponent, hit );

		expect( result ).toContain( '>1.234,50 €<' );
		expect( result ).toMatch( /data-sc-price-part="current"[^>]*>1\.234,50 €/ );
		expect( result ).toMatch( /data-sc-price-part="prefix"[^>]*style="display: none;"/ );
		expect( result ).toMatch( /data-sc-price-part="regular"[^>]*style="display: none;"/ );
	} );

	it( 'Sale: shows "regular" and "current" set to the sale value, hides prefix', () => {
		const hit = { source: { price: 80, regular_price: 100, sale_price: 80 } };

		const result = postProcessMarkup( priceComponent, hit );

		expect( result ).toMatch( /data-sc-price-part="regular"[^>]*>100,00 €/ );
		expect( result ).toMatch( /data-sc-price-part="current"[^>]*>80,00 €/ );
		expect( result ).toMatch( /data-sc-price-part="prefix"[^>]*style="display: none;"/ );
	} );

	it( 'Range: shows "current" set to the min value and shows the prefix without altering its text', () => {
		const hit = { source: { price_min: 10, price_max: 30 } };

		const result = postProcessMarkup( priceComponent, hit );

		expect( result ).toMatch( /data-sc-price-part="current"[^>]*>10,00 €/ );
		expect( result ).toContain( '<span data-sc-price-part="prefix">from</span>' );
		expect( result ).toMatch( /data-sc-price-part="regular"[^>]*style="display: none;"/ );
	} );

	it( 'is Plain (not Range) when min and max are equal', () => {
		const hit = { source: { price: 20, price_min: 20, price_max: 20 } };

		const result = postProcessMarkup( priceComponent, hit );

		expect( result ).toMatch( /data-sc-price-part="prefix"[^>]*style="display: none;"/ );
		expect( result ).toMatch( /data-sc-price-part="current"[^>]*>20,00 €/ );
	} );

	it( 'formats using the component\'s own currency attributes, not the site config', () => {
		mockCurrency = { symbol: '$', position: 'left', decimals: 0, decimalSep: '.', thousandSep: ',' };
		const hit = { source: { price: 1234.5 } };

		const result = postProcessMarkup( priceComponent, hit );

		expect( result ).toContain( '1.234,50 €' );
		expect( result ).not.toContain( '$' );
	} );
} );
