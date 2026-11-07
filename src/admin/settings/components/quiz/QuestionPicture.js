import { useRef } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { InputControl, Stack, Text } from '@wordpress/ui';
import { __ } from '@wordpress/i18n';

import { isSecurePicture, pictureUrl } from '../../quizEditor';

/**
 * A question's picture, picked in the WordPress Media Library and shown above
 * the question in the product finder. Searcio takes only an https address, so
 * a picture from a site served over plain http is flagged.
 *
 * Someone who may not open the Media Library (no `upload_files`, so the page
 * does not load it) types the address instead.
 *
 * @param {Object}   props
 * @param {string}   props.value    The picture's address, or ''.
 * @param {Function} props.onChange Called with the new address, or '' to remove it.
 */
const QuestionPicture = ( { value, onChange } ) => {
	const frame = useRef( null );
	const media = window.wp?.media;
	const insecure = '' !== value && ! isSecurePicture( value );

	if ( 'function' !== typeof media ) {
		return (
			<InputControl
				type="url"
				label={ __( 'Picture (optional)', 'searcio' ) }
				description={ __( 'The address of a picture shown above the question, starting with https://.', 'searcio' ) }
				value={ value }
				onValueChange={ onChange }
			/>
		);
	}

	const choose = () => {
		// One frame, opened again, keeps the library where it was left.
		if ( ! frame.current ) {
			frame.current = media( {
				title: __( 'Choose the question\'s picture', 'searcio' ),
				library: { type: 'image' },
				button: { text: __( 'Use this picture', 'searcio' ) },
				multiple: false,
			} );
			frame.current.on( 'select', () => {
				const attachment = frame.current.state().get( 'selection' ).first()?.toJSON();

				onChange( pictureUrl( attachment ) );
			} );
		}

		frame.current.open();
	};

	return (
		<Stack direction="column" gap="sm" className="whsc-quiz-picture">
			<Text render={ <p /> } variant="body-md" className="whsc-quiz-picture__label">
				{ __( 'Picture (optional)', 'searcio' ) }
			</Text>
			{ '' !== value && (
				<img className="whsc-quiz-picture__preview" src={ value } alt={ __( 'The question\'s picture', 'searcio' ) } />
			) }
			<Text render={ <p /> } variant="body-sm" className={ `whsc-quiz-picture__note${ insecure ? ' is-warning' : '' }` }>
				{ insecure
					? __( 'Searcio shows only pictures served over https, and this one is not. Choose another, or serve the site over https.', 'searcio' )
					: __( 'Shown above the question in the product finder.', 'searcio' ) }
			</Text>
			<Stack direction="row" gap="sm" wrap="wrap">
				<Button __next40pxDefaultSize variant="secondary" onClick={ choose }>
					{ '' === value ? __( 'Choose a picture', 'searcio' ) : __( 'Replace', 'searcio' ) }
				</Button>
				{ '' !== value && (
					<Button __next40pxDefaultSize variant="tertiary" onClick={ () => onChange( '' ) }>
						{ __( 'Remove', 'searcio' ) }
					</Button>
				) }
			</Stack>
		</Stack>
	);
};

export default QuestionPicture;
