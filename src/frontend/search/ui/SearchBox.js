import { useInstanceId } from '@wordpress/compose';
import { Path, SVG } from '@wordpress/primitives';
import { __ } from '@wordpress/i18n';
import Icon from './Icon';

/**
 * The magnifier the box has always shown: a solid glyph, painted by `fill`.
 *
 * `SearchControl` took it from the copy of `@wordpress/icons` inside
 * WordPress. The one this plugin bundles has since become an outline that is
 * painted by `stroke`, which the stylesheet of the box (it sets `fill`) would
 * draw as nothing.
 */
const magnifier = (
	<SVG xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
		<Path d="M13 5c-3.3 0-6 2.7-6 6 0 1.4.5 2.7 1.3 3.7l-3.8 3.8 1.1 1.1 3.8-3.8c1 .8 2.3 1.3 3.7 1.3 3.3 0 6-2.7 6-6S16.3 5 13 5zm0 10.5c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5 4.5 2 4.5 4.5-2 4.5-4.5 4.5z" />
	</SVG>
);

/**
 * The box a trigger shows in the page: a field with a magnifier before it.
 *
 * The storefront drew it with `SearchControl` of `@wordpress/components`,
 * which brought the package with it for what is an input. It is drawn here in
 * the elements and the class names the package gives the field
 * (`components-search-control`, `components-input-control__container`), so
 * that the stylesheet, which carries what the package would have styled at
 * run time and the placements' own colours, draws it as before.
 *
 * Its label is read by a screen reader and not drawn.
 *
 * @param {Object}   props
 * @param {string}   [props.className]
 * @param {string}   props.value
 * @param {string}   [props.placeholder]
 * @param {Function} props.onChange   Called with the text of the field.
 * @param {Function} [props.onClick]
 */
const SearchBox = ( { className = '', value, placeholder, onChange, onClick } ) => {
	const id = useInstanceId( SearchBox, 'components-search-control' );

	return (
		<div className={ `components-base-control components-input-control components-search-control ${ className }`.trim() }>
			<div className="components-base-control__field">
				<div className="components-flex components-input-base">
					<label className="components-visually-hidden" htmlFor={ id }>
						{ __( 'Search', 'searcio' ) }
					</label>
					<div className="components-input-control__container">
						<span className="components-input-control__prefix">
							<div className="components-input-control-prefix-wrapper">
								<Icon icon={ magnifier } fill="currentColor" />
							</div>
						</span>
						<input
							id={ id }
							className="components-input-control__input"
							type="search"
							autoComplete="off"
							placeholder={ placeholder }
							value={ value ?? '' }
							onChange={ ( event ) => onChange( event.target.value ) }
							onClick={ onClick }
						/>
						<span className="components-input-control__suffix" />
						<div className="components-input-control__backdrop" aria-hidden="true" />
					</div>
				</div>
			</div>
		</div>
	);
};

export default SearchBox;
