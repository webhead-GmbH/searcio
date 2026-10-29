<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Frontend;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\DTO\Placement_Options;
use Webhead\WP\SearchCloud\Frontend\Theme_Presets;

final class Theme_Presets_Test extends TestCase {
	public function test_finds_a_theme_by_its_folder_name(): void {
		$preset = Theme_Presets::for_theme( 'enfold' );

		$this->assertSame( 'Enfold', $preset['name'] );
		$this->assertSame( [ '#menu-item-search > a' ], $preset['selectors'] );
	}

	/**
	 * A child theme's folder is its own; the parent's is the template.
	 */
	public function test_a_child_theme_takes_its_parents_preset(): void {
		$this->assertSame( 'enfold', Theme_Presets::for_theme( 'enfold', 'enfold-fisch-gruber' )['key'] );
	}

	public function test_a_folder_named_in_capitals_is_found(): void {
		$this->assertSame( 'Divi', Theme_Presets::for_theme( 'Divi' )['name'] );
		$this->assertSame( 'Avada', Theme_Presets::for_theme( 'Avada' )['name'] );
	}

	public function test_a_theme_without_a_preset_has_none(): void {
		$this->assertNull( Theme_Presets::for_theme( 'twentytwentyfive' ) );
		$this->assertNull( Theme_Presets::for_theme( '' ) );
	}

	/**
	 * A preset that its own cleaning would change is one an admin could
	 * apply and then lose on saving.
	 */
	public function test_every_preset_survives_the_cleaning_of_a_save(): void {
		$presets = array_map( static fn ( string $theme ): array => Theme_Presets::for_theme( $theme ), Theme_Presets::themes() );
		$presets[] = Theme_Presets::for_builder( 'elementor-pro' );

		foreach ( $presets as $preset ) {
			$this->assertNotEmpty( $preset['selectors'], $preset['name'] );
			$this->assertSame( $preset['selectors'], Placement_Options::clean_selectors( $preset['selectors'] ), $preset['name'] );
		}
	}

	public function test_an_unknown_builder_has_no_preset(): void {
		$this->assertNull( Theme_Presets::for_builder( 'bricks' ) );
	}
}
