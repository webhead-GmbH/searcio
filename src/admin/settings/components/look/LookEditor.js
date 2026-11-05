import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import {
	Button,
	Navigator,
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
	__experimentalToggleGroupControlOptionIcon as ToggleGroupControlOptionIcon,
} from '@wordpress/components';
import { Icon, Notice, Stack, Tabs, Text } from '@wordpress/ui';
import { chevronLeft, chevronRight, desktop, mobile, tablet } from '@wordpress/icons';
import { __, _n, isRTL, sprintf } from '@wordpress/i18n';

import Modal from '../../../../components/Modal';
import { DEVICE_WIDTHS, controlsIn, fontOptions, setInGroup, statesOf } from '../../look';
import LookControl from './LookControl';
import LookPreview from './LookPreview';

/** wp-admin's phone layout. */
const NARROW = '(max-width: 782px)';

const stateLabel = ( state ) => ( {
	normal: __( 'Normal', 'searcio' ),
	hover: __( 'Hover', 'searcio' ),
	active: __( 'Active', 'searcio' ),
	focus: __( 'Focus', 'searcio' ),
}[ state ] );

/**
 * The size the page is drawn at for a device, and the scale that fits it on
 * the stage. A desktop is at least as wide as Elementor's widest breakpoint,
 * so the stage of a small screen does not show a tablet's values for it.
 */
const frameOf = ( device, stage ) => {
	const width = 'desktop' === device ? Math.max( stage.width, DEVICE_WIDTHS.desktop ) : DEVICE_WIDTHS[ device ];
	const scale = stage.width > 0 ? Math.min( 1, stage.width / width ) : 1;

	return { width, scale, height: stage.height / scale };
};

/**
 * The controls of one part of the search, in the state chosen, under the
 * headings the Elementor widget gives them.
 */
const GroupControls = ( { group, look, search, device, fonts, onChange, onReset } ) => {
	const states = statesOf( group );
	const [ state, setState ] = useState( 'normal' );
	const shown = controlsIn( group, states.includes( state ) ? state : 'normal', search );

	// Runs of controls under one heading, in the schema's order.
	const runs = [];

	shown.forEach( ( control ) => {
		const heading = control.heading || '';
		const last = runs[ runs.length - 1 ];

		if ( last && last.heading === heading ) {
			last.controls.push( control );
		} else {
			runs.push( { heading, controls: [ control ] } );
		}
	} );

	return (
		<Stack direction="column" gap="lg">
			{ states.length > 1 && (
				<ToggleGroupControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					isBlock
					label={ __( 'State', 'searcio' ) }
					value={ state }
					onChange={ ( value ) => setState( value ) }
				>
					{ states.map( ( one ) => <ToggleGroupControlOption key={ one } value={ one } label={ stateLabel( one ) } /> ) }
				</ToggleGroupControl>
			) }

			{ 0 === shown.length && (
				<Text render={ <p /> } variant="body-sm" className="whsc-look-help">
					{ __( 'Nothing here applies to the search as it is shown now. Change "Shown as" under Content to see the rest.', 'searcio' ) }
				</Text>
			) }

			{ runs.map( ( run, index ) => (
				<Stack key={ `${ run.heading }-${ index }` } direction="column" gap="md" className="whsc-look-run">
					{ run.heading ? <Text render={ <h4 /> } variant="heading-sm" className="whsc-look-heading">{ run.heading }</Text> : null }
					{ run.controls.map( ( control ) => (
						<LookControl
							key={ control.id }
							control={ control }
							value={ look[ control.id ] }
							device={ device }
							fonts={ fonts }
							onChange={ ( value ) => onChange( control.id, value ) }
						/>
					) ) }
				</Stack>
			) ) }

			<Stack direction="row" gap="sm">
				<Button
					__next40pxDefaultSize
					variant="tertiary"
					accessibleWhenDisabled
					disabled={ 0 === setInGroup( group, look ) }
					onClick={ onReset }
				>
					{ __( 'Reset this part', 'searcio' ) }
				</Button>
			</Stack>
		</Stack>
	);
};

/**
 * The look of the search, edited the way the Elementor widget is: the
 * settings down one side, in the parts of the search, for a desktop, a tablet
 * or a phone, and beside them a page of the site at that device's width,
 * showing every change as it is made.
 *
 * What it changes is the tab's, not saved until the tab is; it can save from
 * here too.
 *
 * @param {Object}   props
 * @param {boolean}  props.isOpen
 * @param {Function} props.onClose
 * @param {Object}   props.catalog          From `/placement`: `look`, `fonts`, `preview`.
 * @param {Object}   props.placement        The tab's settings, as on screen.
 * @param {Function} props.onLookChange     ( id, value ) sets a setting of the look; `undefined` takes it away.
 * @param {Function} props.onGroupReset     ( group ) takes a part's settings away.
 * @param {*}        props.content          The search's other settings, for the Content tab.
 * @param {Object}   props.save             `{ onSave, isSaving, disabled, label, description, error, onDismissError }`.
 */
const LookEditor = ( { isOpen, onClose, catalog, placement, onLookChange, onGroupReset, content, save } ) => {
	// An admin on a phone sees a phone's page first: a desktop's would be
	// drawn too small to read there.
	const [ device, setDevice ] = useState( () => ( window.matchMedia( NARROW ).matches ? 'mobile' : 'desktop' ) );
	const [ view, setView ] = useState( 'modal' );
	const [ tab, setTab ] = useState( 'style' );
	const [ styleError, setStyleError ] = useState( '' );
	const [ stage, setStage ] = useState( { width: 0, height: 0 } );
	const stageRef = useRef( null );

	const groups = useMemo( () => ( Array.isArray( catalog?.look ) ? catalog.look : [] ), [ catalog ] );
	const fonts = useMemo( () => fontOptions( catalog?.fonts ), [ catalog ] );
	const search = placement?.search || {};
	const look = search.look || {};

	// The stage is measured as the window and the panel beside it change size.
	useEffect( () => {
		if ( ! isOpen ) {
			return undefined;
		}

		let observer = null;
		const frame = window.requestAnimationFrame( () => {
			if ( ! stageRef.current ) {
				return;
			}

			observer = new window.ResizeObserver( ( [ entry ] ) => {
				setStage( { width: Math.floor( entry.contentRect.width ), height: Math.floor( entry.contentRect.height ) } );
			} );
			observer.observe( stageRef.current );
		} );

		return () => {
			window.cancelAnimationFrame( frame );
			observer?.disconnect();
		};
	}, [ isOpen ] );

	// Escape closes a colour picker or a list first, and the editor only when
	// nothing open inside it took the key.
	useEffect( () => {
		if ( ! isOpen ) {
			return undefined;
		}

		const onKeyDown = ( event ) => {
			if ( 'Escape' === event.key && ! event.defaultPrevented ) {
				onClose();
			}
		};

		document.addEventListener( 'keydown', onKeyDown );

		return () => document.removeEventListener( 'keydown', onKeyDown );
	}, [ isOpen, onClose ] );

	const frame = frameOf( device, stage );
	const back = isRTL() ? chevronRight : chevronLeft;
	const forward = isRTL() ? chevronLeft : chevronRight;

	// The trigger is drawn on the page; every other part is in the window.
	const openGroup = ( group ) => setView( 'trigger' === group.id ? 'trigger' : 'modal' );

	return (
		<Modal
			isOpen={ isOpen }
			onClose={ onClose }
			title={ __( 'Look editor', 'searcio' ) }
			size="full"
			closeOnEscape={ false }
			closeOnBackdropClick={ false }
			className="whsc-look-editor-modal"
		>
			<div className="whsc-look-editor">
				<div className="whsc-look-editor__panel">
					<Tabs.Root value={ tab } onValueChange={ ( value ) => setTab( value ) } className="whsc-look-editor__tabs">
						<Tabs.List className="whsc-look-editor__tab-list">
							<Tabs.Tab value="content">{ __( 'Content', 'searcio' ) }</Tabs.Tab>
							<Tabs.Tab value="style">{ __( 'Style', 'searcio' ) }</Tabs.Tab>
						</Tabs.List>
						<Tabs.Panel value="content" className="whsc-look-editor__tab-panel">
							<div className="whsc-look-editor__screen">
								{ content }
							</div>
						</Tabs.Panel>
						<Tabs.Panel value="style" className="whsc-look-editor__tab-panel">
							<Navigator initialPath="/" className="whsc-look-parts">
								<Navigator.Screen path="/">
									<Stack direction="column" gap="md" className="whsc-look-editor__screen">
										<Text render={ <p /> } variant="body-sm" className="whsc-look-help">
											{ __( 'Pick a part of the search. A setting with a screen beside its name is set for the screen chosen above the preview.', 'searcio' ) }
										</Text>
										<ul className="whsc-look-parts__list">
											{ groups.map( ( group ) => {
												const count = setInGroup( group, look );

												return (
													<li key={ group.id }>
														<Navigator.Button
															path={ `/${ group.id }` }
															className="whsc-look-parts__item"
															onClick={ () => openGroup( group ) }
														>
															<span className="whsc-look-parts__name">{ group.label }</span>
															{ count > 0 ? (
																<span className="whsc-look-parts__count">
																	{ sprintf(
																		/* translators: %d: number of style settings that are set. */
																		_n( '%d set', '%d set', count, 'searcio' ),
																		count
																	) }
																</span>
															) : null }
															<Icon icon={ forward } size={ 20 } className="whsc-look-parts__chevron" aria-hidden="true" />
														</Navigator.Button>
													</li>
												);
											} ) }
										</ul>
									</Stack>
								</Navigator.Screen>
								{ groups.map( ( group ) => (
									<Navigator.Screen key={ group.id } path={ `/${ group.id }` }>
										<Stack direction="column" gap="lg" className="whsc-look-editor__screen">
											<Stack direction="row" gap="sm" align="center" className="whsc-look-parts__header">
												<Navigator.BackButton
													__next40pxDefaultSize
													icon={ back }
													label={ __( 'All parts', 'searcio' ) }
													showTooltip
												/>
												<Text render={ <h3 /> } variant="heading-md" className="whsc-look-heading">{ group.label }</Text>
											</Stack>
											<GroupControls
												group={ group }
												look={ look }
												search={ search }
												device={ device }
												fonts={ fonts }
												onChange={ onLookChange }
												onReset={ () => onGroupReset( group ) }
											/>
										</Stack>
									</Navigator.Screen>
								) ) }
							</Navigator>
						</Tabs.Panel>
					</Tabs.Root>

					<Stack direction="column" gap="sm" className="whsc-look-editor__footer">
						{ save.error && (
							<Notice.Root intent="error">
								<Notice.Description>{ save.error }</Notice.Description>
								<Notice.CloseIconButton onClick={ save.onDismissError } />
							</Notice.Root>
						) }
						<Stack direction="row" gap="sm" align="center" wrap="wrap">
							<Button
								__next40pxDefaultSize
								accessibleWhenDisabled
								variant="primary"
								isBusy={ save.isSaving }
								disabled={ save.disabled }
								description={ save.description }
								label={ save.label }
								showTooltip={ !! save.description }
								onClick={ save.onSave }
							>
								{ save.label }
							</Button>
							<Button __next40pxDefaultSize variant="secondary" onClick={ onClose }>
								{ __( 'Done', 'searcio' ) }
							</Button>
						</Stack>
					</Stack>
				</div>

				<div className="whsc-look-editor__preview">
					<Stack direction="row" gap="md" align="center" justify="space-between" wrap="wrap" className="whsc-look-editor__toolbar">
						<ToggleGroupControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							hideLabelFromVision
							label={ __( 'Screen', 'searcio' ) }
							value={ device }
							onChange={ ( value ) => setDevice( value ) }
						>
							<ToggleGroupControlOptionIcon value="desktop" icon={ desktop } label={ __( 'Desktop', 'searcio' ) } />
							<ToggleGroupControlOptionIcon value="tablet" icon={ tablet } label={ __( 'Tablet', 'searcio' ) } />
							<ToggleGroupControlOptionIcon value="mobile" icon={ mobile } label={ __( 'Phone', 'searcio' ) } />
						</ToggleGroupControl>
						<div className="whsc-look-editor__view">
							<ToggleGroupControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								isBlock
								hideLabelFromVision
								label={ __( 'Preview', 'searcio' ) }
								value={ view }
								onChange={ ( value ) => setView( value ) }
							>
								<ToggleGroupControlOption value="trigger" label={ __( 'On the page', 'searcio' ) } />
								<ToggleGroupControlOption value="modal" label={ __( 'Window open', 'searcio' ) } />
							</ToggleGroupControl>
						</div>
					</Stack>

					{ styleError && (
						<Notice.Root intent="warning">
							<Notice.Description>
								{ sprintf(
									/* translators: %s: reason the request failed, as reported by the REST API. */
									__( 'The preview could not show the last change: %s', 'searcio' ),
									styleError
								) }
							</Notice.Description>
						</Notice.Root>
					) }

					<div ref={ stageRef } className="whsc-look-editor__stage">
						{ stage.width > 0 && stage.height > 0 && (
							<div
								className="whsc-look-editor__device"
								style={ { width: Math.round( frame.width * frame.scale ), height: stage.height } }
							>
								<LookPreview
									preview={ catalog?.preview }
									view={ view }
									placement={ placement }
									title={ __( 'Preview of the search on a page of the site', 'searcio' ) }
									className="whsc-look-editor__frame"
									hostClassName="whsc-look-editor__host"
									style={ { width: frame.width, height: frame.height, transform: `scale(${ frame.scale })` } }
									onStyleError={ setStyleError }
								/>
							</div>
						) }
					</div>

					<Text render={ <p /> } variant="body-sm" className="whsc-placement-preview-note whsc-look-editor__note">
						{ sprintf(
							/* translators: %d: width of the preview in pixels. */
							__( 'Drawn %dpx wide, in your theme\'s styles. Type in it to see results and filters.', 'searcio' ),
							frame.width
						) }
					</Text>
				</div>
			</div>
		</Modal>
	);
};

export default LookEditor;
