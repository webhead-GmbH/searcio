import { Button, SearchControl } from '@wordpress/components';
import { search } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Hydrates a server-rendered `[data-whsc-trigger]` placeholder with a real
 * `@wordpress/components` control.
 *
 * Icon mode only ever opens the shared modal. Box mode is a real, working
 * input: typing in it (`onBoxChange`) updates the shared query and opens the
 * modal so typing continues seamlessly into the full search experience.
 * Opening is wired to `onClick` rather than `onFocus` on purpose - the modal
 * covers the box while open, and when it closes we restore focus to the box
 * programmatically (`el.focus()`), which fires a native focus event but not
 * a click; using `onFocus` here would immediately reopen the modal the
 * instant it finished closing.
 *
 * The site's own trigger, printed at the end of a page for the site-wide ways
 * of opening the search, is `hidden` (nothing to draw) or `floating`: a button
 * fixed to a corner, with the magnifier alone or with the word "Search".
 */
const Trigger = ( { mode, placeholder, iconHtml, value, onOpen, onBoxChange, floatingStyle = 'icon' } ) => {
	// An icon button has no text of its own, so its label is its only name. The
	// placeholder is optional in the block and the widget, and left empty it
	// rendered `aria-label=""`: a screen reader announced just "button".
	const name = placeholder || __( 'Search', 'searcio' );

	if ( 'hidden' === mode ) {
		return null;
	}

	if ( 'floating' === mode ) {
		const label = 'label' === floatingStyle;

		return (
			<Button
				className={ `whsc-trigger-icon-button whsc-trigger-floating-button${ label ? ' whsc-trigger-floating-button--label' : '' }` }
				icon={ search }
				label={ label ? undefined : name }
				showTooltip={ ! label }
				onClick={ onOpen }
			>
				{ label ? __( 'Search', 'searcio' ) : null }
			</Button>
		);
	}

	if ( 'box' === mode ) {
		return (
			<SearchControl
				className="whsc-trigger-box"
				value={ value }
				placeholder={ placeholder }
				onChange={ onBoxChange }
				onClick={ onOpen }
			/>
		);
	}

	// A custom icon chosen in the editor (Elementor's icon picker) arrives as a
	// pre-rendered, server-escaped HTML string via `data-icon`; render it in
	// place of the default `@wordpress/icons` search glyph.
	if ( iconHtml ) {
		return (
			<Button
				className="whsc-trigger-icon-button"
				label={ name }
				showTooltip
				onClick={ onOpen }
			>
				<span
					className="whsc-trigger-custom-icon"
					// eslint-disable-next-line react/no-danger -- sanitized server-side via Elementor's Icons_Manager / wp_kses.
					dangerouslySetInnerHTML={ { __html: iconHtml } }
				/>
			</Button>
		);
	}

	return (
		<Button
			className="whsc-trigger-icon-button"
			icon={ search }
			label={ name }
			showTooltip
			onClick={ onOpen }
		/>
	);
};

export default Trigger;
