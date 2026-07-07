import { forwardRef } from '@wordpress/element';
import { Button, Icon } from '@wordpress/components';
import { search, closeSmall } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * A fully custom-built search input (icon + plain `<input>` + clear button)
 * instead of `@wordpress/components`' `SearchControl`. `SearchControl`'s
 * built-in clear button renders a `Tooltip` directly over the small icon
 * target, which swallows the first click in some layouts — building this
 * ourselves keeps every visual state (including the clear button) fully
 * under our control and themeable via CSS custom properties.
 */
const SearchInput = forwardRef( ( {
	value,
	onChange,
	onKeyDown,
	placeholder,
	autoFocus,
	suggestionsId,
	suggestionsOpen,
}, ref ) => (
	<div className="whsc-search-input">
		<Icon icon={ search } className="whsc-search-input__icon" />
		<input
			ref={ ref }
			type="search"
			className="whsc-search-input__field"
			value={ value }
			placeholder={ placeholder }
			aria-label={ placeholder || __( 'Search', 'webhead-search-cloud' ) }
			role="combobox"
			aria-autocomplete="list"
			aria-expanded={ !! suggestionsOpen }
			aria-controls={ suggestionsId }
			autoFocus={ autoFocus }
			autoComplete="off"
			onChange={ ( event ) => onChange( event.target.value ) }
			onKeyDown={ onKeyDown }
		/>
		{ value && (
			<Button
				className="whsc-search-input__clear"
				icon={ closeSmall }
				label={ __( 'Clear', 'webhead-search-cloud' ) }
				showTooltip={ false }
				onClick={ () => onChange( '' ) }
			/>
		) }
	</div>
) );

export default SearchInput;
