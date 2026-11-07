import { useEffect, useMemo, useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { Badge, EmptyState, Icon, Notice, Stack, Text } from '@wordpress/ui';
import { __, _n, sprintf } from '@wordpress/i18n';
import { calendar, help, tag, trash } from '@wordpress/icons';
import apiFetch from '@wordpress/api-fetch';
import { dateI18n, getSettings } from '@wordpress/date';

import { DataViews } from '../../../../components/DataViews';
import { showToast } from '../../../../toast';
import { useAnnounce } from '../../../../utils/announce';
import { QUIZZES_PATH, languageName, quizErrorMessage, statusLabel } from './quizApi';
import { forget, readOnce } from '../../remote';

// Scoped to this plugin, screen and table, so the view survives a reload.
const VIEW_STORAGE_KEY = 'searcio.settings.quizzes.view';

const loadStoredView = () => {
	try {
		const parsed = JSON.parse( window.localStorage.getItem( VIEW_STORAGE_KEY ) || 'null' );

		return parsed && 'object' === typeof parsed ? parsed : null;
	} catch ( error ) {
		return null;
	}
};

const storeView = ( view ) => {
	try {
		window.localStorage.setItem( VIEW_STORAGE_KEY, JSON.stringify( view ) );
	} catch ( error ) {
		// Storage is unavailable (a private window); the view is a convenience.
	}
};

// Every column but the first, which is the title and takes what these leave.
// Read from here on every load, never from the stored view.
const COLUMN_STYLES = {
	status: { width: '16%', minWidth: 120 },
	lang: { width: '18%', minWidth: 130 },
	question_count: { width: '12%', minWidth: 100 },
	updated_at: { width: '22%', minWidth: 170 },
};

const withColumnStyles = ( view ) => ( { ...view, layout: { ...( view.layout || {} ), styles: COLUMN_STYLES } } );

const DEFAULT_VIEW = {
	type: 'table',
	page: 1,
	perPage: 20,
	sort: { field: 'updated_at', direction: 'desc' },
	search: '',
	filters: [],
	titleField: 'name',
	showMedia: false,
	fields: [ 'status', 'lang', 'question_count', 'updated_at' ],
	layout: {},
};

const formatDate = ( iso ) => {
	const date = iso ? new Date( iso ) : null;

	return date && ! Number.isNaN( date.getTime() ) ? dateI18n( getSettings().formats.datetime, date ) : '-';
};

const fieldHeader = ( label, icon ) => (
	<span className="whsc-dataviews-field-header-with-icon">
		<Icon icon={ icon } size={ 16 } />
		<span>{ label }</span>
	</span>
);

/**
 * The site's quizzes as a table, with a quiz to open, publish, take off the
 * product finder or delete. Searcio holds them; the plugin's REST route
 * searches, filters, orders and pages them, so the table shows what the
 * server sent.
 *
 * @param {Object}        props
 * @param {Array<Object>} props.languages The site's languages, `{ code, name }`; none on a single-language site.
 * @param {Function}      props.onOpen    Called with the id of the quiz to edit.
 * @param {Function}      props.onCreate  Called when a quiz is to be added.
 * @param {number}        props.reload    Bumped when the list has to be read again.
 */
const QuizList = ( { languages, onOpen, onCreate, reload } ) => {
	const [ view, setView ] = useState( () => withColumnStyles( { ...DEFAULT_VIEW, ...( loadStoredView() || {} ), page: 1 } ) );
	const [ items, setItems ] = useState( [] );
	const [ total, setTotal ] = useState( 0 );
	const [ limit, setLimit ] = useState( 0 );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ loadError, setLoadError ] = useState( '' );
	const [ refresh, setRefresh ] = useState( 0 );

	useAnnounce( loadError, 'assertive' );

	const updateView = ( next ) => {
		const styled = withColumnStyles( next );

		setView( styled );
		storeView( styled );
	};

	useEffect( () => {
		let cancelled = false;
		const filter = ( field ) => view.filters.find( ( item ) => item.field === field )?.value || '';
		const query = new URLSearchParams( {
			page: String( view.page ),
			per_page: String( view.perPage ),
			order_by: view.sort?.field || 'updated_at',
			order: 'asc' === view.sort?.direction ? 'asc' : 'desc',
		} );

		if ( view.search ) {
			query.set( 'search', view.search );
		}

		[ 'status', 'lang' ].forEach( ( field ) => {
			if ( filter( field ) ) {
				query.set( field, filter( field ) );
			}
		} );

		setIsLoading( true );

		readOnce( { path: `${ QUIZZES_PATH }?${ query.toString() }` } )
			.then( ( response ) => {
				if ( ! cancelled ) {
					setItems( Array.isArray( response?.items ) ? response.items : [] );
					setTotal( Number( response?.total ) || 0 );
					setLimit( Number( response?.limit ) || 0 );
					setLoadError( '' );
				}
			} )
			.catch( ( error ) => {
				if ( ! cancelled ) {
					setItems( [] );
					setTotal( 0 );
					setLoadError( quizErrorMessage( error ) );
				}
			} )
			.finally( () => {
				if ( ! cancelled ) {
					setIsLoading( false );
				}
			} );

		return () => {
			cancelled = true;
		};
	}, [ view, reload, refresh ] );

	const setStatus = async ( item, status ) => {
		try {
			await apiFetch( { path: `${ QUIZZES_PATH }/${ item.id }`, method: 'PUT', data: { quiz: { status } } } );
			forget( `${ QUIZZES_PATH }?` );
			showToast(
				'published' === status ? __( 'The quiz is in the product finder.', 'searcio' ) : __( 'The quiz is a draft again.', 'searcio' ),
				'success'
			);
		} catch ( error ) {
			showToast( quizErrorMessage( error ), 'error' );
		}

		setRefresh( ( value ) => value + 1 );
	};

	const fields = useMemo( () => [
		{
			id: 'name',
			label: __( 'Quiz', 'searcio' ),
			enableSorting: true,
			enableHiding: false,
			filterBy: false,
			render: ( { item } ) => (
				<Button variant="link" onClick={ () => onOpen( item.id ) }>
					<span className="searcio-cell-clamp">{ item.name || __( '(no name)', 'searcio' ) }</span>
				</Button>
			),
		},
		{
			id: 'status',
			label: __( 'Status', 'searcio' ),
			header: fieldHeader( __( 'Status', 'searcio' ), tag ),
			enableSorting: true,
			elements: [
				{ value: 'published', label: statusLabel( 'published' ) },
				{ value: 'draft', label: statusLabel( 'draft' ) },
			],
			filterBy: { operators: [ 'is' ] },
			render: ( { item } ) => (
				<Badge intent={ 'published' === item.status ? 'stable' : 'draft' }>{ statusLabel( item.status ) }</Badge>
			),
		},
		{
			id: 'lang',
			label: __( 'Language', 'searcio' ),
			enableSorting: true,
			enableHiding: languages.length > 1,
			elements: [
				{ value: '-', label: __( 'Every language', 'searcio' ) },
				...languages.map( ( language ) => ( { value: language.code, label: language.name } ) ),
			],
			filterBy: languages.length > 1 ? { operators: [ 'is' ] } : false,
			render: ( { item } ) => languageName( item.lang, languages ),
		},
		{
			id: 'question_count',
			label: __( 'Questions', 'searcio' ),
			header: fieldHeader( __( 'Questions', 'searcio' ), help ),
			enableSorting: true,
			filterBy: false,
			render: ( { item } ) => Number( item.question_count ) || 0,
		},
		{
			id: 'updated_at',
			label: __( 'Changed', 'searcio' ),
			header: fieldHeader( __( 'Changed', 'searcio' ), calendar ),
			enableSorting: true,
			filterBy: false,
			render: ( { item } ) => formatDate( item.updated_at ),
		},
	], [ languages, onOpen ] );

	const actions = useMemo( () => [
		{
			id: 'edit',
			label: __( 'Edit', 'searcio' ),
			isPrimary: true,
			callback: ( [ item ] ) => onOpen( item.id ),
		},
		{
			id: 'publish',
			label: __( 'Publish', 'searcio' ),
			isEligible: ( item ) => 'published' !== item.status,
			callback: ( [ item ] ) => setStatus( item, 'published' ),
		},
		{
			id: 'unpublish',
			label: __( 'Make a draft', 'searcio' ),
			isEligible: ( item ) => 'published' === item.status,
			callback: ( [ item ] ) => setStatus( item, 'draft' ),
		},
		{
			id: 'delete',
			label: __( 'Delete', 'searcio' ),
			icon: trash,
			isDestructive: true,
			supportsBulk: true,
			modalHeader: ( selected ) => _n( 'Delete this quiz?', 'Delete these quizzes?', selected.length, 'searcio' ),
			modalSize: 'small',
			// A deleted quiz cannot be brought back, here or in the Searcio
			// panel, so the table asks first and the button says what it does.
			RenderModal: ( { items: selected, closeModal } ) => (
				<Stack direction="column" gap="lg">
					<Text>
						{ sprintf(
							/* translators: %d: number of quizzes. */
							_n(
								'%d quiz is deleted for good, in the Searcio panel too, and leaves the product finder.',
								'%d quizzes are deleted for good, in the Searcio panel too, and leave the product finder.',
								selected.length,
								'searcio'
							),
							selected.length
						) }
					</Text>
					<Stack direction="row" gap="sm" justify="flex-end">
						<Button __next40pxDefaultSize variant="tertiary" onClick={ closeModal }>
							{ __( 'Cancel', 'searcio' ) }
						</Button>
						<Button
							__next40pxDefaultSize
							variant="primary"
							isDestructive
							onClick={ async () => {
								closeModal();

								const results = await Promise.all(
									selected.map( ( item ) =>
										apiFetch( { path: `${ QUIZZES_PATH }/${ item.id }`, method: 'DELETE' } ).then( () => true, () => false )
									)
								);

								forget( `${ QUIZZES_PATH }?` );

								if ( results.includes( false ) ) {
									showToast( __( 'A quiz could not be deleted. Try again.', 'searcio' ), 'error' );
								}

								setRefresh( ( value ) => value + 1 );
							} }
						>
							{ __( 'Delete permanently', 'searcio' ) }
						</Button>
					</Stack>
				</Stack>
			),
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps -- setStatus reads only setters.
	], [ onOpen ] );

	const atLimit = limit > 0 && total >= limit && 0 === view.filters.length && '' === view.search;

	return (
		<Stack direction="column" gap="md" className="whsc-quizzes">
			<Stack direction="row" gap="md" justify="space-between" align="center" wrap="wrap">
				<Text render={ <p /> } variant="body-sm" className="whsc-quizzes__count">
					{ limit > 0
						? sprintf(
							/* translators: 1: number of quizzes, 2: the most a site can have. */
							_n( '%1$d of %2$d quiz', '%1$d of %2$d quizzes', limit, 'searcio' ),
							total,
							limit
						)
						: '' }
				</Text>
				<Button
					__next40pxDefaultSize
					accessibleWhenDisabled
					variant="primary"
					onClick={ onCreate }
					disabled={ atLimit || '' !== loadError }
					description={ atLimit ? __( 'This site has as many quizzes as Searcio holds for one site.', 'searcio' ) : undefined }
					showTooltip={ atLimit }
				>
					{ __( 'Add a quiz', 'searcio' ) }
				</Button>
			</Stack>

			{ '' !== loadError ? (
				<Notice.Root intent="error">
					<Notice.Title>{ __( 'The quizzes could not be loaded.', 'searcio' ) }</Notice.Title>
					<Notice.Description>{ loadError }</Notice.Description>
					<Notice.Actions>
						<Notice.ActionButton onClick={ () => setRefresh( ( value ) => value + 1 ) }>
							{ __( 'Try again', 'searcio' ) }
						</Notice.ActionButton>
					</Notice.Actions>
				</Notice.Root>
			) : (
				// No media; the class keeps an empty media box out of every layout.
				<div className="searcio-dataviews--no-media">
					<DataViews
						data={ items }
						fields={ fields }
						view={ view }
						onChangeView={ updateView }
						actions={ actions }
						isLoading={ isLoading }
						paginationInfo={ { totalItems: total, totalPages: Math.max( 1, Math.ceil( total / view.perPage ) ) } }
						defaultLayouts={ {
							table: { showMedia: false, layout: { styles: COLUMN_STYLES } },
							activity: { showMedia: false },
						} }
						getItemId={ ( item ) => String( item.id ) }
						empty={
							<EmptyState.Root>
								<EmptyState.Icon icon={ help } />
								<EmptyState.Title>{ __( 'No quizzes yet', 'searcio' ) }</EmptyState.Title>
								<EmptyState.Description>
									{ __( 'A quiz asks shoppers a few questions and shows the products that fit their answers.', 'searcio' ) }
								</EmptyState.Description>
								<EmptyState.Actions>
									<Button __next40pxDefaultSize variant="primary" onClick={ onCreate }>
										{ __( 'Add a quiz', 'searcio' ) }
									</Button>
								</EmptyState.Actions>
							</EmptyState.Root>
						}
					/>
				</div>
			) }
		</Stack>
	);
};

export default QuizList;
