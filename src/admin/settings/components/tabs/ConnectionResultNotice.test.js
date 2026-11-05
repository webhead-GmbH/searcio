/**
 * What the Connection tab says of an account Searcio does not serve. The keys
 * work, so the health check is `ok`, and the notice used to read "Connected"
 * over a storefront whose every search was refused.
 */
// eslint-disable-next-line import/no-extraneous-dependencies -- `@wordpress/element` does not export `act`.
import { act } from 'react';
import { createRoot } from '@wordpress/element';
import { speak } from '@wordpress/a11y';

import ConnectionResultNotice, { accountRefusal } from './ConnectionResultNotice';

jest.mock( '@wordpress/a11y', () => ( { speak: jest.fn() } ) );

const SERVED = {
	ok: true,
	site_id: 21,
	documents: { used: 96, limit: 300000 },
	plan: { is_free: false, upgrade_url: 'https://searcio.test/acme/billing' },
	account: { served: true, reason: null, title: null, message: null, support_url: 'https://searcio.test/login' },
};

const refused = ( reason ) => ( {
	...SERVED,
	account: {
		served: false,
		reason,
		title: `Title of ${ reason }`,
		message: `Message of ${ reason }`,
		support_url: 'https://searcio.test/acme/support',
	},
} );

let container;
let root;

const render = ( result ) => act( () => root.render( <ConnectionResultNotice result={ result } /> ) );

const links = () => [ ...container.querySelectorAll( 'a' ) ].map( ( link ) => [ link.textContent.trim(), link.getAttribute( 'href' ) ] );

beforeEach( () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	speak.mockClear();
	container = document.createElement( 'div' );
	document.body.appendChild( container );
	root = createRoot( container );
} );

afterEach( () => {
	act( () => root.unmount() );
	document.body.innerHTML = '';
} );

describe( 'accountRefusal', () => {
	it( 'is the account of a working connection Searcio does not serve', () => {
		expect( accountRefusal( refused( 'no_active_plan' ) ) ).toMatchObject( { reason: 'no_active_plan' } );
	} );

	it( 'is nothing for a served account, a failed check or a service that does not say', () => {
		expect( accountRefusal( SERVED ) ).toBeNull();
		expect( accountRefusal( { ...refused( 'no_active_plan' ), ok: false } ) ).toBeNull();
		expect( accountRefusal( { ok: true, documents: {} } ) ).toBeNull();
		expect( accountRefusal( null ) ).toBeNull();
	} );
} );

describe( 'ConnectionResultNotice', () => {
	it( 'says a served account is connected', async () => {
		await render( SERVED );

		expect( container.textContent ).toContain( 'Connected - 96 / 300,000 documents indexed. (site #21)' );
		expect( links() ).toEqual( [] );
	} );

	it( 'says why an account without a plan is refused, and links to choosing one', async () => {
		await render( refused( 'no_active_plan' ) );

		expect( container.textContent ).toContain( 'Title of no_active_plan' );
		expect( container.textContent ).toContain( 'Message of no_active_plan' );
		expect( container.textContent ).not.toContain( 'Connected' );
		expect( links() ).toEqual( [ [ expect.stringContaining( 'Choose a plan' ), 'https://searcio.test/acme/billing' ] ] );
	} );

	it( 'links a suspended account to support, which is the only way back', async () => {
		await render( refused( 'account_suspended' ) );

		expect( container.textContent ).toContain( 'Title of account_suspended' );
		expect( links() ).toEqual( [ [ expect.stringContaining( 'Contact Searcio support' ), 'https://searcio.test/acme/support' ] ] );
	} );

	it( 'offers no link it does not have', async () => {
		await render( { ...refused( 'no_active_plan' ), plan: { is_free: false, upgrade_url: '' } } );

		expect( container.textContent ).toContain( 'Title of no_active_plan' );
		expect( links() ).toEqual( [] );
	} );

	it( 'reads a refusal out at once, as it arrives', async () => {
		await render( null );
		await render( refused( 'account_suspended' ) );

		expect( speak ).toHaveBeenCalledWith( 'Title of account_suspended Message of account_suspended', 'assertive' );
	} );
} );
