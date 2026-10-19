import { __ } from '@wordpress/i18n';

/**
 * The states a sync run can be in, named once for the status card and the
 * history table.
 */
export const statusLabels = () => ( {
	queued: __( 'Queued', 'searcio' ),
	running: __( 'Running', 'searcio' ),
	paused: __( 'Paused', 'searcio' ),
	completed: __( 'Completed', 'searcio' ),
	failed: __( 'Failed', 'searcio' ),
	cancelled: __( 'Cancelled', 'searcio' ),
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
