/**
 * The search block's Styles tab in the block editor.
 *
 * A colour panel draws what it holds one under the other with no space of its
 * own, and the size sliders under the colours touched: a slider's label sat on
 * the number box of the slider above it. Only a browser lays the panel out.
 */

import { test, expect } from '../utils';

// What the Trigger and Modal panels hold, in the order they draw it.
const SLIDERS = [
	[ 'Icon size', 'Button size', 'Border radius' ],
	[ 'Corner radius', 'Padding', 'Section spacing' ],
];

test.describe( "The search block's Styles tab", () => {
	test( 'leaves space between the size sliders', async ( { admin, editor, page } ) => {
		// A post: a new page opens on the starter patterns, over the editor.
		await admin.createNewPost();
		await editor.insertBlock( { name: 'webhead-search-cloud/search' } );
		await editor.openDocumentSettingsSidebar();

		const inspector = page.getByRole( 'region', { name: 'Editor settings' } );
		await inspector.getByRole( 'tab', { name: 'Styles' } ).click();

		for ( const group of SLIDERS ) {
			for ( let i = 1; i < group.length; i++ ) {
				// The number box of the slider above, and the label of the next one.
				// "Border radius" is in a later panel too: these are the first.
				const box = inspector.getByRole( 'spinbutton', { name: group[ i - 1 ], exact: true } ).first();
				const label = inspector.getByText( group[ i ], { exact: true } ).first();

				await expect( label ).toBeVisible();
				await label.scrollIntoViewIfNeeded();

				const [ above, below ] = await Promise.all( [ box.boundingBox(), label.boundingBox() ] );

				expect( below.y - ( above.y + above.height ), `${ group[ i - 1 ] } to ${ group[ i ] }` ).toBeGreaterThanOrEqual( 12 );
			}
		}
	} );
} );
