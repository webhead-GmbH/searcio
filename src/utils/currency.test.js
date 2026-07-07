let mockCurrency = {};

jest.mock( './api', () => ( {
	getConfig: () => ( { currency: mockCurrency } ),
} ) );

// eslint-disable-next-line import/first -- must follow the jest.mock() call above.
import { formatPrice, PRICE_FIELDS } from './currency';

describe( 'formatPrice', () => {
	beforeEach( () => {
		mockCurrency = {};
	} );

	it( 'returns an empty string for a non-finite value', () => {
		expect( formatPrice( 'not-a-number' ) ).toBe( '' );
		expect( formatPrice( undefined ) ).toBe( '' );
	} );

	it( 'formats with the store\'s decimal/thousand separators and symbol position (German-style)', () => {
		mockCurrency = { decimals: 2, decimalSep: ',', thousandSep: '.', symbol: '€', position: 'right_space' };

		expect( formatPrice( 1234.5 ) ).toBe( '1.234,50 €' );
	} );

	it( 'formats with a left-positioned symbol (US-style)', () => {
		mockCurrency = { decimals: 2, decimalSep: '.', thousandSep: ',', symbol: '$', position: 'left' };

		expect( formatPrice( 1234.5 ) ).toBe( '$1,234.50' );
	} );

	it( 'falls back to sane defaults when currency config is entirely empty', () => {
		expect( formatPrice( 1234.5 ) ).toBe( '1,234.50' );
	} );

	it( 'preserves a negative sign', () => {
		mockCurrency = { symbol: '€', position: 'right' };

		expect( formatPrice( -5 ) ).toBe( '-5.00€' );
	} );
} );

describe( 'PRICE_FIELDS', () => {
	it( 'contains the exact field names this plugin\'s own WooCommerce indexer uses', () => {
		expect( [ ...PRICE_FIELDS ] ).toEqual(
			expect.arrayContaining( [ 'price', 'regular_price', 'sale_price', 'price_min', 'price_max' ] )
		);
	} );
} );
