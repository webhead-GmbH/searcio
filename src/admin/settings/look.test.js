import { applies, controlsIn, fontOptions, forDevice, hasOwn, setInGroup, statesOf, withDevice, withValue } from './look';

const GROUP = {
	id: 'trigger',
	controls: [
		{ id: 'trigger_icon_color', type: 'color', state: 'normal', when: { mode: 'icon' } },
		{ id: 'trigger_icon_color_hover', type: 'color', state: 'hover', when: { mode: 'icon' } },
		{ id: 'trigger_box_bg', type: 'color', state: 'normal', when: { mode: 'box' } },
		{ id: 'trigger_radius', type: 'size', state: 'normal', responsive: true, when: {} },
	],
};

describe( 'the Look editor', () => {
	it( 'shows a state where a group has controls in it', () => {
		expect( statesOf( GROUP ) ).toEqual( [ 'normal', 'hover' ] );
	} );

	it( 'shows the controls of the search as it is set', () => {
		expect( applies( GROUP.controls[ 0 ], { mode: 'box' } ) ).toBe( false );
		expect( controlsIn( GROUP, 'normal', { mode: 'icon' } ).map( ( control ) => control.id ) ).toEqual( [ 'trigger_icon_color', 'trigger_radius' ] );
		expect( controlsIn( GROUP, 'normal', { mode: 'box' } ).map( ( control ) => control.id ) ).toEqual( [ 'trigger_box_bg', 'trigger_radius' ] );
	} );

	it( 'gives a device the value of the larger one where it has none', () => {
		const value = { desktop: 24, mobile: 12 };

		expect( forDevice( value, 'desktop' ) ).toBe( 24 );
		expect( forDevice( value, 'tablet' ) ).toBe( 24 );
		expect( forDevice( value, 'mobile' ) ).toBe( 12 );
		expect( forDevice( { tablet: 16 }, 'desktop' ) ).toBeUndefined();
		expect( forDevice( '#fff', 'mobile' ) ).toBe( '#fff' );
		expect( forDevice( [ 1, 2, 3, 4 ], 'mobile' ) ).toEqual( [ 1, 2, 3, 4 ] );
		expect( hasOwn( value, 'tablet' ) ).toBe( false );
		expect( hasOwn( value, 'mobile' ) ).toBe( true );
	} );

	it( 'changes one device, and takes the value away with the last one', () => {
		expect( withDevice( { desktop: 24 }, 'mobile', 12 ) ).toEqual( { desktop: 24, mobile: 12 } );
		expect( withDevice( { desktop: 24, mobile: 12 }, 'mobile', undefined ) ).toEqual( { desktop: 24 } );
		expect( withDevice( { desktop: 24 }, 'desktop', '' ) ).toBeUndefined();
	} );

	it( 'keeps only the values that are set', () => {
		expect( withValue( { field_bg: '#fff' }, 'field_text', '#000' ) ).toEqual( { field_bg: '#fff', field_text: '#000' } );
		expect( withValue( { field_bg: '#fff' }, 'field_bg', '' ) ).toEqual( {} );
		expect( withValue( { modal_round_top: true }, 'modal_round_top', false ) ).toEqual( {} );
		expect( withValue( { tab_typography: { size: { desktop: 14 } } }, 'tab_typography', {} ) ).toEqual( {} );
	} );

	it( 'counts what a group has set', () => {
		expect( setInGroup( GROUP, { trigger_radius: { desktop: 4 }, field_bg: '#fff' } ) ).toBe( 1 );
	} );

	it( 'offers the site\'s fonts first and Google\'s it does not have', () => {
		expect( fontOptions( { site: [ 'Inter', 'My Sans' ], google: [ 'Roboto', 'Inter' ] } ) ).toEqual( [
			{ value: 'Inter', label: 'Inter', google: false },
			{ value: 'My Sans', label: 'My Sans', google: false },
			{ value: 'Roboto', label: 'Roboto', google: true },
		] );
	} );
} );
