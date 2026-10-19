import { Card, Stack, Text } from '@wordpress/ui';
import { __, sprintf } from '@wordpress/i18n';

import { formatNumber } from '../../../../utils/number';

/**
 * What this account has spent of each metered allowance this month.
 *
 * `GET /health` has always returned one entry per metric; the plugin read only
 * `documents` and discarded the rest, so a site could run its monthly searches
 * to zero with nothing in wp-admin saying so - the first sign was the storefront
 * quietly failing for shoppers.
 *
 * Only allowances that are actually metered on the plan are shown: a `limit` of
 * null means unlimited, and a row reading "1,204 / unlimited" is noise.
 */

/**
 * Names worth showing a merchant, in the order they matter to a storefront.
 * A metric the service adds later still renders, under its own key, rather
 * than disappearing because this list has not caught up.
 */
const LABELS = () => ( {
	searches: __( 'Searches', 'searcio' ),
	documents: __( 'Indexed documents', 'searcio' ),
	ai_messages: __( 'AI assistant messages', 'searcio' ),
	visual_searches: __( 'Photo searches', 'searcio' ),
	visual_tags: __( 'AI image tagging', 'searcio' ),
} );

const ORDER = [ 'searches', 'documents', 'ai_messages', 'visual_searches', 'visual_tags' ];

/** Metrics about the account rather than about this site's search. */
const NOT_SITE_SCOPED = [ 'sites', 'members' ];

const humanize = ( key ) =>
	key.replace( /_/g, ' ' ).replace( /^./, ( character ) => character.toUpperCase() );

const UsageCard = ( { usage } ) => {
	const labels = LABELS();
	const entries = Object.entries( usage || {} )
		.filter( ( [ key, metric ] ) => ! NOT_SITE_SCOPED.includes( key ) && null !== metric?.limit && undefined !== metric?.limit )
		.sort( ( [ a ], [ b ] ) => {
			const rank = ( key ) => {
				const index = ORDER.indexOf( key );

				return -1 === index ? ORDER.length : index;
			};

			return rank( a ) - rank( b );
		} );

	if ( 0 === entries.length ) {
		return null;
	}

	return (
		<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
			<Card.Header className="whsc-settings-card-header">
				<div className="whsc-settings-card-copy">
					{ /* An h3: the card is a section of the connection tab, whose
					     heading is the h2 under the page title. */ }
					<Card.Title render={ <h3 /> }>{ __( 'This month', 'searcio' ) }</Card.Title>
					<Text render={ <p /> } variant="body-sm">
						{ __(
							'What your plan has used of each allowance. A spent allowance stops the thing it meters - searches stop returning results, and shoppers fall back to WordPress search.',
							'searcio'
						) }
					</Text>
				</div>
			</Card.Header>
			<Card.Content className="whsc-settings-card-content">
				<Stack direction="column" gap="lg" className="whsc-usage">
					{ entries.map( ( [ key, metric ] ) => {
						const percent = Math.max( 0, Math.min( 100, Number( metric.percent ) || 0 ) );
						const state = metric.exceeded ? 'spent' : ( metric.near_limit ? 'near' : 'ok' );

						return (
							<Stack direction="column" gap="xs" className={ `whsc-usage__row whsc-usage__row--${ state }` } key={ key }>
								<Stack direction="row" gap="md" justify="space-between" align="baseline">
									<Text className="whsc-usage__label">{ labels[ key ] || humanize( key ) }</Text>
									<Text className="whsc-usage__count">
										{ sprintf(
											/* translators: 1: amount used. 2: the plan's allowance. */
											__( '%1$s of %2$s', 'searcio' ),
											formatNumber( metric.used || 0 ),
											formatNumber( metric.limit )
										) }
									</Text>
								</Stack>
								{ /* The bar repeats the number rather than replacing it: a
								     percentage is easier to compare, the count is easier to
								     act on. Its three colours are the point of it, which is
								     more than a progress bar says. */ }
								<div
									className="whsc-usage__bar"
									role="img"
									aria-label={ sprintf(
										/* translators: 1: allowance name. 2: percentage used. */
										__( '%1$s: %2$d%% used', 'searcio' ),
										labels[ key ] || humanize( key ),
										percent
									) }
								>
									<span className="whsc-usage__fill" style={ { width: `${ percent }%` } } />
								</div>
								{ metric.exceeded && (
									<Text variant="body-sm" className="whsc-usage__note">
										{ __( 'Spent for this month. Upgrade to keep this working.', 'searcio' ) }
									</Text>
								) }
								{ ! metric.exceeded && metric.near_limit && (
									<Text variant="body-sm" className="whsc-usage__note">
										{ __( 'Close to the limit.', 'searcio' ) }
									</Text>
								) }
							</Stack>
						);
					} ) }
				</Stack>
			</Card.Content>
		</Card.Root>
	);
};

export default UsageCard;
