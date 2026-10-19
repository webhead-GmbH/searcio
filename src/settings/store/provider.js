import { useCallback, useEffect, useMemo, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

import SettingsContext from './context';

const pluginData = window.webhead_search_cloudData || {};
const SETTINGS_PATH = pluginData?.api?.settingsPath || '/webhead-search-cloud/v1/settings';

if ( pluginData?.api?.nonce ) {
	apiFetch.use( apiFetch.createNonceMiddleware( pluginData.api.nonce ) );
}

const DEFAULT_SECTION = 'general';

/**
 * Readable tab title for a section that arrived without one.
 */
const titleFromSlug = ( slug ) =>
	String( slug )
		.split( /[-_]+/ )
		.filter( Boolean )
		.map( ( word ) => word.charAt( 0 ).toUpperCase() + word.slice( 1 ) )
		.join( ' ' );

/**
 * Group the schema into settings screen tabs.
 *
 * The server already sorts the payload by section, then by each field's order,
 * then by declaration order. Sorting again here keeps a hand-merged payload
 * rendering as declared, and both sides use the same comparator.
 *
 * A Map rather than a plain object because section slugs are data: an object
 * keyed by a slug such as `constructor` resolves truthy against
 * Object.prototype and its group would never be created.
 */
const groupSettings = ( schema ) => {
	const groups = new Map();

	Object.entries( schema || {} ).forEach( ( [ key, definition ], index ) => {
		const section = definition?.section || DEFAULT_SECTION;

		if ( ! groups.has( section ) ) {
			groups.set( section, {
				name: section,
				title: definition?.section_label || titleFromSlug( section ),
				fields: [],
			} );
		}

		groups.get( section ).fields.push( { key, definition, index } );
	} );

	// Number( null ) is 0, not NaN, so an unset order has to be rejected before
	// the numeric coercion or every unordered field sorts to the front.
	const orderOf = ( definition ) => {
		const raw = definition?.order;

		if ( raw === null || raw === undefined || raw === '' ) {
			return null;
		}

		const parsed = Number( raw );

		return Number.isFinite( parsed ) ? parsed : null;
	};

	const byOrderThenDeclaration = ( a, b ) => {
		const aOrder = orderOf( a.definition );
		const bOrder = orderOf( b.definition );

		// An unset order means "leave me where I was declared", so those fields
		// sort after the deliberately positioned ones.
		if ( ( aOrder === null ) !== ( bOrder === null ) ) {
			return aOrder === null ? 1 : -1;
		}

		if ( aOrder !== null && aOrder !== bOrder ) {
			return aOrder - bOrder;
		}

		return a.index - b.index;
	};

	return [ ...groups.values() ].map( ( group ) => ( {
		...group,
		title: group.title || __( 'General', 'searcio' ),
		fields: [ ...group.fields ].sort( byOrderThenDeclaration ),
	} ) );
};

const reasonOf = ( error ) =>
	error?.message || __( 'the request to the REST API failed.', 'searcio' );

const SettingsProvider = ( { children } ) => {
	const [ schema, setSchema ] = useState( {} );
	const [ settings, setSettings ] = useState( {} );
	const [ persistedSettings, setPersistedSettings ] = useState( {} );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ loadError, setLoadError ] = useState( null );
	const [ saveError, setSaveError ] = useState( null );
	const [ loadAttempt, setLoadAttempt ] = useState( 0 );
	const hasUnsavedChanges = useMemo(
		() => JSON.stringify( settings ) !== JSON.stringify( persistedSettings ),
		[ settings, persistedSettings ]
	);
	// Memoized on the schema alone: grouping inline in the context value rebuilt
	// every group and field object on each keystroke.
	const settingGroups = useMemo( () => groupSettings( schema ), [ schema ] );

	const applyResponse = ( response ) => {
		setSchema( response.schema || {} );
		setSettings( response.settings || {} );
		setPersistedSettings( response.settings || {} );
	};

	// A rejected load used to escape as an unhandled promise rejection: the
	// schema stayed empty and the screen rendered as a plugin with no settings.
	// A blocked /wp-json or an expired nonce is ordinary; the screen has to say
	// so and offer a retry.
	useEffect( () => {
		let isCurrentAttempt = true;

		const loadSettings = async () => {
			try {
				const response = await apiFetch( { path: SETTINGS_PATH } );

				if ( ! isCurrentAttempt ) {
					return;
				}

				applyResponse( response );
				setLoadError( null );
			} catch ( error ) {
				if ( isCurrentAttempt ) {
					setLoadError( reasonOf( error ) );
				}
			} finally {
				if ( isCurrentAttempt ) {
					setIsLoading( false );
				}
			}
		};

		setIsLoading( true );
		void loadSettings();

		// A retry started while the previous request is still in flight must not
		// have its result overwritten when that one lands.
		return () => {
			isCurrentAttempt = false;
		};
	}, [ loadAttempt ] );

	// After a load that failed: the whole screen waits on this one.
	const retryLoad = useCallback( () => {
		setLoadAttempt( ( attempt ) => attempt + 1 );
	}, [] );

	// Re-fetches without the loading skeleton - used after actions that change
	// settings server-side outside the normal save flow (e.g. the Connect /
	// Disconnect actions on the Connection tab, which write credentials and
	// pending-claim state directly through PHP).
	const reloadSettings = async () => {
		applyResponse( await apiFetch( { path: SETTINGS_PATH } ) );
	};

	const updateSetting = ( key, value ) => {
		// The person is fixing what failed; the old reason no longer describes
		// what is on screen.
		setSaveError( null );
		setSettings( ( currentSettings ) => ( {
			...currentSettings,
			[ key ]: value,
		} ) );
	};

	const clearSaveError = useCallback( () => {
		setSaveError( null );
	}, [] );

	const saveSettings = async () => {
		setIsSaving( true );
		setSaveError( null );

		try {
			const response = await apiFetch( {
				path: SETTINGS_PATH,
				method: 'POST',
				data: {
					settings,
				},
			} );

			setSchema( response.schema || schema );
			setSettings( response.settings || settings );
			setPersistedSettings( response.settings || settings );

			return true;
		} catch ( error ) {
			// The REST error names the setting that failed validation, or says
			// the session's nonce has expired; a bare `false` left the screen to
			// guess.
			setSaveError( reasonOf( error ) );

			return false;
		} finally {
			setIsSaving( false );
		}
	};

	return (
		<SettingsContext.Provider
			value={ {
				schema,
				settings,
				hasUnsavedChanges,
				isLoading,
				isSaving,
				loadError,
				saveError,
				clearSaveError,
				settingGroups,
				retryLoad,
				reloadSettings,
				saveSettings,
				updateSetting,
			} }
		>
			{ children }
		</SettingsContext.Provider>
	);
};

export default SettingsProvider;
