import ContentLoader from 'react-content-loader';

// One loader per card, laid out in the same flex row as the real carousel and
// clipped by `overflow: hidden`, so the placeholder matches the actual layout
// at every width (≈2 cards on mobile, ≈6–7 on desktop) instead of squeezing a
// fixed count of tiny cards onto small screens.
const CARD_COUNT = 8;
const CARD_W = 200;
const IMG_H = 200;
const CARD_H = 254;

/**
 * Card-shaped loading placeholder for the results/highlights carousel.
 *
 * Each card is its own `react-content-loader` with a colon-free `uniqueKey`
 * (React's `useId()` produces colons, which break the SVG `url(#…)` gradient/
 * clip references) and flat `<rect>` children (a `<clipPath>` ignores `<g>`
 * wrappers, which would leave it empty and invisible).
 */
const SearchResultsSkeleton = () => (
	<div className="whsc-skeleton-row" role="presentation" aria-hidden="true">
		{ Array.from( { length: CARD_COUNT } ).map( ( _, index ) => (
			<div className="whsc-carousel-item" key={ index }>
				<ContentLoader
					className="whsc-skeleton-card"
					uniqueKey={ `whsc-skeleton-${ index }` }
					speed={ 1.5 }
					width={ CARD_W }
					height={ CARD_H }
					viewBox={ `0 0 ${ CARD_W } ${ CARD_H }` }
					backgroundColor="#000000"
					backgroundOpacity={ 0.16 }
					foregroundColor="#000000"
					foregroundOpacity={ 0.07 }
				>
					<rect x="0" y="0" rx="10" ry="10" width={ CARD_W } height={ IMG_H } />
					<rect x="0" y={ IMG_H + 16 } rx="4" ry="4" width={ CARD_W } height="14" />
					<rect x="0" y={ IMG_H + 40 } rx="4" ry="4" width={ CARD_W * 0.55 } height="14" />
				</ContentLoader>
			</div>
		) ) }
	</div>
);

export default SearchResultsSkeleton;
