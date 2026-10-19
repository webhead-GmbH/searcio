import { useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { Card, Stack, Text } from '@wordpress/ui';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

import { showToast } from '../../../../toast';

const pluginData = window.webhead_search_cloudData || {};
const CACHE_CLEAR_PATH = pluginData?.api?.cacheClearPath || '/webhead-search-cloud/v1/cache/clear';

/**
 * Not a settings field, so it lives as its own card on the General tab
 * rather than in the schema-driven grid. Clearing cache doesn't touch any
 * stored data, so it isn't styled as destructive.
 */
const CacheClearCard = () => {
	const [isClearing, setIsClearing] = useState(false);

	const onClear = async () => {
		setIsClearing(true);

		try {
			await apiFetch( { path: CACHE_CLEAR_PATH, method: 'POST' } );

			showToast( __( 'Cache cleared.', 'searcio' ), 'success' );
		} catch ( error ) {
			showToast( __( 'Could not clear the cache.', 'searcio' ), 'error' );
		} finally {
			setIsClearing( false );
		}
	};

	return (
		<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
			<Card.Header className="whsc-settings-card-header">
				<div className="whsc-settings-card-copy">
					<Card.Title render={ <h2 /> }>
						{ __( 'Cache', 'searcio' ) }
					</Card.Title>
					<Text render={ <p /> } variant="body-sm">
						{ __(
							"Clears this plugin's own cached data and PHP's opcode cache, so a just-changed setting or a recently updated card template/popular-search result shows up immediately instead of waiting for it to expire on its own.",
							'searcio'
						) }
					</Text>
				</div>
			</Card.Header>
			<Card.Content className="whsc-settings-card-content">
				<Stack direction="row" gap="sm" align="center" wrap="wrap">
					<Button
						__next40pxDefaultSize
						variant="secondary"
						isBusy={ isClearing }
						disabled={ isClearing }
						onClick={ onClear }
					>
						{ isClearing ? __( 'Clearing…', 'searcio' ) : __( 'Clear cache', 'searcio' ) }
					</Button>
				</Stack>
			</Card.Content>
		</Card.Root>
	);
};

export default CacheClearCard;
