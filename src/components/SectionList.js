import { useEffect, useRef, useState } from '@wordpress/element';
import { addQueryArgs, removeQueryArgs } from '@wordpress/url';
import { Stack, Tabs } from '@wordpress/ui';
import { motion } from 'motion/react';

import { useFadeInUpProps } from '../utils/animation';
import './section-list.scss';

/**
 * A tab with many sections: all of them listed down the side, one of them
 * beside the list at a time, as webhead's other plugins draw a long tab.
 *
 * Each entry carries its name and its state, one short line per fact, so the
 * list reads as a summary of the whole tab before anything is opened. The
 * section is kept in the address, so a reload or a copied link lands on it,
 * and taken out again when the tab is left, since it names a section of this
 * tab only. On a narrow screen the list is a strip above the section that
 * scrolls sideways on its own.
 *
 * @param {Object}                                                                        props
 * @param {Array<{id: string, label: string, summary?: Array<string>, content: Object}>} props.sections
 * @param {string}                                                                        props.label     The list's name, for a screen reader.
 * @param {string}                                                                        [props.className]
 */
const SectionList = ( { sections, label, className = '' } ) => {
	const [ section, setSection ] = useState( () => new URLSearchParams( window.location.search ).get( 'section' ) );
	const current = sections.some( ( item ) => item.id === section ) ? section : sections[ 0 ]?.id;
	// A section arrives as a tab of the screen does.
	const panelMotion = useFadeInUpProps( 0.02 );
	const rootRef = useRef( null );

	useEffect( () => {
		if ( current ) {
			window.history.replaceState( {}, '', addQueryArgs( window.location.href, { section: current } ) );
		}
	}, [ current ] );

	useEffect( () => () => {
		window.history.replaceState( {}, '', removeQueryArgs( window.location.href, 'section' ) );
	}, [] );

	// Where the list is a strip that scrolls sideways, the open entry is
	// brought into its middle, or a section opened from the address would be
	// open with nothing in the strip saying which. Measured on the screen, so
	// a right-to-left strip scrolls the same way.
	useEffect( () => {
		const nav = rootRef.current?.querySelector( '.webhead-search-cloud-sections__nav' );
		const tab = nav?.querySelector( '[aria-selected="true"]' );

		if ( ! nav || ! tab || nav.scrollWidth <= nav.clientWidth ) {
			return;
		}

		const strip = nav.getBoundingClientRect();
		const entry = tab.getBoundingClientRect();

		nav.scrollBy( { left: ( entry.left + ( entry.width / 2 ) ) - ( strip.left + ( strip.width / 2 ) ) } );
	}, [ current ] );

	return (
		<Tabs.Root
			ref={ rootRef }
			orientation="vertical"
			value={ current }
			onValueChange={ setSection }
			className={ `webhead-search-cloud-sections ${ className }`.trim() }
		>
			<Tabs.List className="webhead-search-cloud-sections__nav" aria-label={ label }>
				{ sections.map( ( item ) => (
					<Tabs.Tab key={ item.id } value={ item.id } className="webhead-search-cloud-sections__tab">
						<span className="webhead-search-cloud-sections__text">
							<span className="webhead-search-cloud-sections__label">{ item.label }</span>
							{ ( item.summary || [] ).filter( Boolean ).map( ( line ) => (
								<span key={ line } className="webhead-search-cloud-sections__summary">{ line }</span>
							) ) }
						</span>
					</Tabs.Tab>
				) ) }
			</Tabs.List>

			{ sections.map( ( item ) => (
				<Tabs.Panel key={ item.id } value={ item.id } className="webhead-search-cloud-sections__panel">
					<motion.div { ...panelMotion }>
						<Stack direction="column" gap="lg">
							{ item.content }
						</Stack>
					</motion.div>
				</Tabs.Panel>
			) ) }
		</Tabs.Root>
	);
};

export default SectionList;
