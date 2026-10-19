/**
 * Webhead scaffold managed file. scaffold:update may refresh this file.
 *
 * The shell every admin screen sits in. Use it for **every** page this plugin
 * registers, so a second screen cannot drift from the first: the dark header,
 * the surface radius, the page padding, the entrance motion and the rhythm
 * between sections all live here rather than being rebuilt per page. The
 * generated settings screen is drawn by it too, which is what makes "the same
 * as the settings screen" true of any page that uses it.
 *
 *     <AdminPage
 *         title={ __( 'Reports', 'text-domain' ) }
 *         description={ __( 'What this screen is for.', 'text-domain' ) }
 *         icon={ ChartIcon }
 *         actions={ [
 *             { label: __( 'Refresh', 'text-domain' ), onClick: refresh, icon: UpdateIcon },
 *             { label: __( 'Add new', 'text-domain' ), onClick: create },
 *         ] }
 *     >
 *         …cards…
 *     </AdminPage>
 *
 * A page whose content opens with a tab strip passes `tabbed`, and the strip
 * sits directly under the header instead of a padding below it.
 *
 * The shell is a *surface* and takes the `xl` radius; the cards inside it are
 * cards and take `lg`. The design system forbids a container and its immediate
 * child sharing a radius, which is why this component owns the outer one and
 * nothing inside it should set a surface radius of its own.
 */
import { Button, Dropdown, MenuGroup, MenuItem } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { moreVertical, page as PageIcon } from '@wordpress/icons';
import { Icon } from '@wordpress/ui';
import { motion } from 'motion/react';

import { animateText, useFadeInUpProps } from '../utils/animation';

// The design tokens and the plugin's own variables, card variants and accent
// colours. Imported here and not left to the page's PHP class to enqueue: a
// page that named no shared stylesheet used to render with every token
// undefined, which is a header with no background and no padding anywhere.
import './Default';
import './admin-page.scss';

/**
 * At most two buttons sit in the header; the rest go behind one menu.
 *
 * A header that grows a button per feature stops reading as a header. Two is
 * where a row still scans at a glance, so the third onwards is collapsed rather
 * than allowed to crowd the title.
 */
const HEADER_ACTION_LIMIT = 2;

function HeaderActions( { actions } ) {
	if ( ! actions || 0 === actions.length ) {
		return null;
	}

	const list = Array.isArray( actions ) ? actions : [ actions ];

	// Anything that is already an element is rendered as given.
	if ( list.some( ( action ) => ! action || 'object' !== typeof action || ! ( 'label' in action ) ) ) {
		return <div className="webhead-search-cloud-admin-page__actions">{ actions }</div>;
	}

	const inline = list.slice( 0, HEADER_ACTION_LIMIT );
	const overflow = list.slice( HEADER_ACTION_LIMIT );

	return (
		<div className="webhead-search-cloud-admin-page__actions">
			{ inline.map( ( action, index ) => (
				<Button
					__next40pxDefaultSize
					key={ action.key || action.label || index }
					// The first is outlined in white, the second is filled with
					// the brand colour. Both are `secondary` so WordPress does not
					// paint its own accent over them; the header stylesheet owns
					// the difference, keyed to position.
					variant="secondary"
					className={ [
						'webhead-search-cloud-admin-page__action',
						`webhead-search-cloud-admin-page__action--${ 0 === index ? 'outline' : 'solid' }`,
						// The overflow menu honours `isDestructive`, so a header
						// button that ignored it meant the same descriptor looked
						// dangerous in third position and ordinary in first.
						action.isDestructive ? 'webhead-search-cloud-admin-page__action--destructive' : '',
					].filter( Boolean ).join( ' ' ) }
					icon={ action.icon }
					disabled={ action.disabled }
					isBusy={ action.isBusy }
					onClick={ action.onClick }
				>
					{ action.label }
				</Button>
			) ) }

			{ overflow.length > 0 && (
				<Dropdown
					className="webhead-search-cloud-admin-page__overflow"
					popoverProps={ { placement: 'bottom-end' } }
					renderToggle={ ( { isOpen, onToggle } ) => (
						<Button
							// `compact` is what @wordpress/components documents for
							// toggle and icon buttons. The overflow toggle is both,
							// and at 40px it took as much room as a labelled button
							// for a control that is only a way in to the rest.
							size="compact"
							variant="tertiary"
							className="webhead-search-cloud-admin-page__action webhead-search-cloud-admin-page__action--ghost"
							icon={ moreVertical }
							label={ __( 'More actions', 'searcio' ) }
							aria-expanded={ isOpen }
							onClick={ onToggle }
						/>
					) }
					renderContent={ ( { onClose } ) => (
						<MenuGroup>
							{ overflow.map( ( action, index ) => (
								<MenuItem
									key={ action.key || action.label || index }
									icon={ action.icon }
									disabled={ action.disabled }
									isDestructive={ action.isDestructive }
									onClick={ () => {
										action.onClick?.();
										onClose();
									} }
								>
									{ action.label }
								</MenuItem>
							) ) }
						</MenuGroup>
					) }
				/>
			) }
		</div>
	);
}

function AdminPage( { title, description, icon = PageIcon, actions, tabbed = false, children, className = '' } ) {
	// Both collapse to the finished state when the visitor has asked their
	// system for reduced motion.
	const headerMotion = useFadeInUpProps( 0, -12 );
	const contentMotion = useFadeInUpProps( 0.08 );

	return (
		// `panel-container` is the class the plugin's own stylesheet scopes its
		// accent colours, card variants and badges to. The shell carries it so
		// every screen receives them, and not only the one whose root element
		// the stylesheet happens to name.
		<div className={ `webhead-search-cloud-admin-page panel-container ${ className }`.trim() }>
			<div className="webhead-search-cloud-admin-page__surface">
				<motion.div className="webhead-search-cloud-admin-page__header" { ...headerMotion }>
					<div className="webhead-search-cloud-admin-page__heading">
						{ /* The icon is not optional. A header without one reads as a
						     different plugin, so a page that passes none still gets a
						     neutral default rather than an empty slot. */ }
						<span className="webhead-search-cloud-admin-page__icon" aria-hidden="true">
							<Icon icon={ icon } />
						</span>
						<div className="webhead-search-cloud-admin-page__titles">
							<h1 className="webhead-search-cloud-admin-page__title">
								{ animateText( title ) }
							</h1>
							{ description ? (
								<p className="webhead-search-cloud-admin-page__description">
									{ animateText( description, 0.16 ) }
								</p>
							) : null }
						</div>
					</div>
					<HeaderActions actions={ actions } />
				</motion.div>
				<motion.div
					className={ [
						'webhead-search-cloud-admin-page__content',
						tabbed ? 'webhead-search-cloud-admin-page__content--tabbed' : '',
					].filter( Boolean ).join( ' ' ) }
					{ ...contentMotion }
				>
					{ children }
				</motion.div>
			</div>
		</div>
	);
}

export default AdminPage;
