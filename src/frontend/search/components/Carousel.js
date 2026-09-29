import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { chevronLeft, chevronRight } from '@wordpress/icons';
import { __, sprintf } from '@wordpress/i18n';

const DRAG_THRESHOLD = 6;

/**
 * Horizontal card carousel: drag-to-scroll (pointer), overlay prev/next
 * arrows for mouse users, dot pagination, and keyboard support — with the
 * native scrollbar hidden (see `style.scss`). Reused for the empty-state
 * highlights and for search results.
 *
 * @param {Object}                       props
 * @param {Array}                        props.items
 * @param {(item) => any}                props.getKey
 * @param {(item, index) => JSX.Element} props.renderItem
 * @param {string}                       [props.ariaLabel]
 */
const Carousel = ( { items, getKey, renderItem, ariaLabel } ) => {
	const trackRef = useRef( null );
	const [ pageCount, setPageCount ] = useState( 1 );
	const [ activePage, setActivePage ] = useState( 0 );
	const [ canPrev, setCanPrev ] = useState( false );
	const [ canNext, setCanNext ] = useState( false );

	// Pointer-drag bookkeeping. `moved` gates the click-suppression so a plain
	// click on a card still navigates, but a drag does not.
	const drag = useRef( { active: false, startX: 0, startScroll: 0, moved: false } );

	const measure = useCallback( () => {
		const track = trackRef.current;

		if ( ! track ) {
			return;
		}

		const { scrollLeft, clientWidth, scrollWidth } = track;
		const pages = clientWidth > 0 ? Math.max( 1, Math.ceil( scrollWidth / clientWidth ) ) : 1;

		setPageCount( pages );
		setActivePage( Math.min( pages - 1, Math.round( scrollLeft / clientWidth ) ) );
		setCanPrev( scrollLeft > 4 );
		setCanNext( scrollLeft + clientWidth < scrollWidth - 4 );
	}, [] );

	useEffect( () => {
		measure();

		const track = trackRef.current;

		if ( ! track ) {
			return;
		}

		const onScroll = () => measure();

		track.addEventListener( 'scroll', onScroll, { passive: true } );
		window.addEventListener( 'resize', onScroll );

		return () => {
			track.removeEventListener( 'scroll', onScroll );
			window.removeEventListener( 'resize', onScroll );
		};
	}, [ items, measure ] );

	// A page of cards gliding past is the kind of motion a visitor who asked for
	// less of it means; for them the carousel jumps. `auto` defers to the track's
	// CSS, which drops its own smooth scrolling under the same preference.
	const scrollBehavior = () =>
		window.matchMedia?.( '(prefers-reduced-motion: reduce)' ).matches ? 'auto' : 'smooth';

	const scrollByPage = ( direction ) => {
		const track = trackRef.current;

		if ( ! track ) {
			return;
		}

		track.scrollBy( { left: track.clientWidth * 0.9 * direction, behavior: scrollBehavior() } );
	};

	const scrollToPage = ( page ) => {
		const track = trackRef.current;

		if ( ! track ) {
			return;
		}

		track.scrollTo( { left: page * track.clientWidth, behavior: scrollBehavior() } );
	};

	const onKeyDown = ( event ) => {
		if ( 'ArrowLeft' === event.key ) {
			scrollByPage( -1 );
		} else if ( 'ArrowRight' === event.key ) {
			scrollByPage( 1 );
		}
	};

	const onPointerDown = ( event ) => {
		// Only primary button / touch / pen initiates a drag.
		if ( event.button && 0 !== event.button ) {
			return;
		}

		const track = trackRef.current;

		drag.current = { active: true, startX: event.clientX, startScroll: track.scrollLeft, moved: false };
		track.classList.add( 'is-dragging' );
	};

	// Cards are `<a>` links, which start a native link/image drag on
	// mousedown-drag and swallow the scroll gesture. Cancelling `dragstart`
	// (plus `-webkit-user-drag: none` in CSS) lets the pointer drag scroll the
	// track even when the cursor starts on a card.
	const onDragStart = ( event ) => event.preventDefault();

	const onPointerMove = ( event ) => {
		if ( ! drag.current.active ) {
			return;
		}

		const delta = event.clientX - drag.current.startX;

		if ( Math.abs( delta ) > DRAG_THRESHOLD ) {
			drag.current.moved = true;
		}

		trackRef.current.scrollLeft = drag.current.startScroll - delta;
	};

	const endDrag = () => {
		if ( ! drag.current.active ) {
			return;
		}

		drag.current.active = false;
		trackRef.current?.classList.remove( 'is-dragging' );
	};

	// Swallow the click that follows a drag so a dragged card doesn't navigate.
	const onClickCapture = ( event ) => {
		if ( drag.current.moved ) {
			event.preventDefault();
			event.stopPropagation();
			drag.current.moved = false;
		}
	};

	if ( 0 === items.length ) {
		return null;
	}

	return (
		<div className="whsc-carousel">
			<Button
				className="whsc-carousel-arrow whsc-carousel-arrow--prev"
				icon={ chevronLeft }
				label={ __( 'Previous', 'webhead-search-cloud' ) }
				showTooltip={ false }
				disabled={ ! canPrev }
				onClick={ () => scrollByPage( -1 ) }
			/>
			<div
				className="whsc-carousel-track"
				ref={ trackRef }
				role="group"
				aria-label={ ariaLabel }
				tabIndex={ 0 }
				onKeyDown={ onKeyDown }
				onPointerDown={ onPointerDown }
				onPointerMove={ onPointerMove }
				onPointerUp={ endDrag }
				onPointerLeave={ endDrag }
				onDragStart={ onDragStart }
				onClickCapture={ onClickCapture }
			>
				{ items.map( ( item, index ) => (
					<div className="whsc-carousel-item" key={ getKey( item ) }>
						{ renderItem( item, index ) }
					</div>
				) ) }
			</div>
			<Button
				className="whsc-carousel-arrow whsc-carousel-arrow--next"
				icon={ chevronRight }
				label={ __( 'Next', 'webhead-search-cloud' ) }
				showTooltip={ false }
				disabled={ ! canNext }
				onClick={ () => scrollByPage( 1 ) }
			/>
			{ pageCount > 1 && (
				<div className="whsc-carousel-dots" role="tablist" aria-label={ __( 'Pages', 'webhead-search-cloud' ) }>
					{ Array.from( { length: pageCount } ).map( ( _, page ) => (
						<button
							key={ page }
							type="button"
							role="tab"
							className={ `whsc-carousel-dot${ page === activePage ? ' is-active' : '' }` }
							aria-selected={ page === activePage }
							aria-label={ sprintf(
								/* translators: %d: page number. */
								__( 'Go to page %d', 'webhead-search-cloud' ),
								page + 1
							) }
							onClick={ () => scrollToPage( page ) }
						/>
					) ) }
				</div>
			) }
		</div>
	);
};

export default Carousel;
