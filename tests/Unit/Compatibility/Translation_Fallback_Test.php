<?php
/**
 * Which shipped translation stands in for a locale the plugin has none for.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Compatibility;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\Compatibility\Translation_Fallback;

final class Translation_Fallback_Test extends TestCase {
	private const SHIPPED = [ 'de_DE', 'de_DE_formal', 'de_AT', 'de_CH', 'de_CH_informal', 'fr_FR', 'es_ES', 'it_IT', 'pl_PL' ];

	/**
	 * @return array<string, array{string, string|null}>
	 */
	public static function locales(): array {
		return [
			'Belgian French reads French'       => [ 'fr_BE', 'fr_FR' ],
			'Canadian French reads French'      => [ 'fr_CA', 'fr_FR' ],
			'Mexican Spanish reads Spanish'     => [ 'es_MX', 'es_ES' ],
			'Argentinian Spanish reads Spanish' => [ 'es_AR', 'es_ES' ],
			'a variant reads its locale first'  => [ 'fr_CA_formal', 'fr_FR' ],
			'a shipped locale is its own'       => [ 'de_DE_formal', null ],
			'Swiss informal is its own'         => [ 'de_CH_informal', null ],
			'a language it does not speak'      => [ 'pt_BR', null ],
			'nor formally'                      => [ 'nl_NL_formal', null ],
			'English stays English'             => [ 'en_US', null ],
			'no locale at all'                  => [ '', null ],
		];
	}

	/**
	 * @dataProvider locales
	 */
	public function test_the_nearest_shipped_locale_stands_in( string $locale, ?string $expected ): void {
		$this->assertSame( $expected, Translation_Fallback::stand_in( $locale, self::SHIPPED ) );
	}

	public function test_a_variant_of_a_shipped_region_reads_that_region(): void {
		$this->assertSame( 'de_CH', Translation_Fallback::stand_in( 'de_CH_informal', [ 'de_DE', 'de_CH' ] ) );
	}
}
