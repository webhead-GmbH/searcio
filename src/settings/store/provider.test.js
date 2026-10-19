/**
 * The settings screen's tabs, grouped from the settings schema.
 */
import { setLocaleData } from '@wordpress/i18n';

import { groupSettings } from './provider';

describe( 'groupSettings', () => {
	afterEach( () => setLocaleData( {}, 'searcio' ) );

	it( 'names the default section in the language of the screen', () => {
		setLocaleData( { General: [ 'Ogólne' ] }, 'searcio' );

		const [ group ] = groupSettings( { keep_history: { type: 'integer' } } );

		expect( group.name ).toBe( 'general' );
		expect( group.title ).toBe( 'Ogólne' );
	} );

	it( 'keeps the label a section brings', () => {
		const [ group ] = groupSettings( { keep_history: { type: 'integer', section: 'general', section_label: 'Housekeeping' } } );

		expect( group.title ).toBe( 'Housekeeping' );
	} );

	it( 'titles any other section from its slug', () => {
		const [ group ] = groupSettings( { colour: { type: 'string', section: 'look_and_feel' } } );

		expect( group.title ).toBe( 'Look And Feel' );
	} );
} );
