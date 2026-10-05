import { __ } from '@wordpress/i18n';

/**
 * The states a sync run can be in, named once for the status card and the
 * history table.
 */
export const statusLabels = () => ( {
	queued: __( 'Queued', 'webhead-search-cloud' ),
	running: __( 'Running', 'webhead-search-cloud' ),
	paused: __( 'Paused', 'webhead-search-cloud' ),
	completed: __( 'Completed', 'webhead-search-cloud' ),
	failed: __( 'Failed', 'webhead-search-cloud' ),
	cancelled: __( 'Cancelled', 'webhead-search-cloud' ),
} );

/**
 * A `Badge` intent is a level of attention, not a status word: the least
 * attention-grabbing one that is true. Only a failed run asks to be looked at.
 */
const STATUS_INTENTS = {
	queued: 'draft',
	running: 'informational',
	paused: 'low',
	completed: 'stable',
	failed: 'high',
	cancelled: 'none',
};

export const statusIntent = ( status ) => STATUS_INTENTS[ status ] || 'none';
