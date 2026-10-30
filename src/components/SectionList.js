/**
 * Webhead scaffold managed file.
 *
 * A tab with many sections: every section listed down the side, one of them
 * beside the list at a time. Reach for it once a tab holds more than about
 * five sections, rather than stacking them down a page nobody reaches the end
 * of, or folding them into collapsible cards.
 *
 *     <SectionList
 *         label={ __( 'Firewall', 'text-domain' ) }
 *         sections={ [
 *             {
 *                 id: 'events',
 *                 label: __( 'Refused requests', 'text-domain' ),
 *                 summary: [ __( 'Nothing refused this week', 'text-domain' ) ],
 *                 content: <RefusedRequests />,
 *             },
 *             …
 *         ] }
 *     />
 *
 * Each entry carries its name and its state, one short line per fact, so the
 * list reads as a summary of the whole tab before anything is opened. The
 * section is kept in the address (`section=`), so a reload or a copied link
 * lands on it, and taken out again when the list goes, since it names a
 * section of this list only. `aliases` maps the name of a section that was
 * merged into another to the one it went into, so an old link still lands.
 *
 * The selected entry is marked by `Tabs` itself: `@wordpress/ui` draws a line
 * beside it as high as its content. Give it no background of your own.
 *
 * Narrower than 960px, where WordPress folds its admin menu, the list is a
 * strip across the top that scrolls on its own, and the tabs turn horizontal
 * with it: the arrow keys and `aria-orientation` then say what the screen
 * shows, and the line that marks the selected entry moves under it. A
 * vertical tab list laid out as a row by CSS alone keeps that line at the
 * left edge of the strip.
 */
import { useEffect, useState } from '@wordpress/element';
import { addQueryArgs, removeQueryArgs } from '@wordpress/url';
import { Stack, Tabs, Text } from '@wordpress/ui';

// The component owns its stylesheet, so a screen that uses it needs no wiring
// step: a list that renders unstyled reports nothing.
import './section-list.scss';

const SECTION_PARAMETER = 'section';
const NARROW = '(max-width: 960px)';

function useNarrow() {
	const [ narrow, setNarrow ] = useState( () => window.matchMedia( NARROW ).matches );

	useEffect( () => {
		const query = window.matchMedia( NARROW );
		const update = () => setNarrow( query.matches );

		update();
		query.addEventListener( 'change', update );

		return () => query.removeEventListener( 'change', update );
	}, [] );

	return narrow;
}

/**
 * @param {Object}                 props
 * @param {Array<Object>}          props.sections            `{ id, label, summary, content }` for each section, in order.
 * @param {string}                 props.sections[].id       Kept in the address; never shown.
 * @param {import('react').ReactNode} props.sections[].label The section's name.
 * @param {string[]}               [props.sections[].summary] Its state, one short line per fact. Empty lines are left out.
 * @param {import('react').ReactNode} props.sections[].content What the section holds.
 * @param {Object<string, string>} [props.aliases]           Old section names, each mapped to the section it went into.
 * @param {string}                 [props.label]             Names the list for assistive technology.
 * @param {string}                 [props.className]         Extra class on the root.
 */
export default function SectionList( { sections, aliases = {}, label, className = '' } ) {
	const [ section, setSection ] = useState( () => {
		const asked = new URLSearchParams( window.location.search ).get( SECTION_PARAMETER );

		return aliases[ asked ] || asked;
	} );
	const narrow = useNarrow();
	const current = sections.some( ( item ) => item.id === section ) ? section : sections[ 0 ]?.id;

	useEffect( () => {
		if ( current ) {
			window.history.replaceState( {}, '', addQueryArgs( window.location.href, { [ SECTION_PARAMETER ]: current } ) );
		}
	}, [ current ] );

	useEffect( () => () => {
		window.history.replaceState( {}, '', removeQueryArgs( window.location.href, SECTION_PARAMETER ) );
	}, [] );

	if ( ! current ) {
		return null;
	}

	return (
		<Tabs.Root
			orientation={ narrow ? 'horizontal' : 'vertical' }
			value={ current }
			onValueChange={ ( value ) => setSection( value ) }
			className={ `webhead-search-cloud-sections ${ className }`.trim() }
		>
			<Tabs.List aria-label={ label } className="webhead-search-cloud-sections__nav">
				{ sections.map( ( item ) => (
					<Tabs.Tab key={ item.id } value={ item.id } className="webhead-search-cloud-sections__tab">
						<span className="webhead-search-cloud-sections__text">
							<Text variant="heading-md" className="webhead-search-cloud-sections__label">
								{ item.label }
							</Text>
							{ ( item.summary || [] ).filter( Boolean ).map( ( line, index ) => (
								<Text key={ index } variant="body-sm" className="webhead-search-cloud-sections__summary">
									{ line }
								</Text>
							) ) }
						</span>
					</Tabs.Tab>
				) ) }
			</Tabs.List>

			{ sections.map( ( item ) => (
				<Tabs.Panel key={ item.id } value={ item.id } className="webhead-search-cloud-sections__panel">
					<Stack direction="column" gap="lg">
						{ item.content }
					</Stack>
				</Tabs.Panel>
			) ) }
		</Tabs.Root>
	);
}
