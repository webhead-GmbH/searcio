<?php
/**
 * Elementor widget integration tests.
 *
 * Covers the plugin's Elementor integration point: the guarded
 * {@see \Webhead\WP\SearchCloud\Frontend\Elementor_Widget} registrar and the
 * {@see \Webhead\WP\SearchCloud\Frontend\Elementor\Search_Widget} contract
 * (name, category, keywords, and the shared runtime bundle it depends on). The
 * widget's rendered markup is the same `Trigger_Markup` output already covered
 * by the unit suite and the block render test, so it is not re-asserted here.
 *
 * The class skips when Elementor is not loaded into the test environment (see
 * `tests/Integration/bootstrap.php`).
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Frontend;

use Webhead\WP\SearchCloud\Frontend\Elementor\Search_Widget;
use Webhead\WP\SearchCloud\Frontend\Elementor_Widget;
use Webhead\WP\SearchCloud\Frontend\Elementor\Products_Widget;
use Webhead\WP\SearchCloud\Frontend\Frontend_Assets;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Elementor_Widget_Test extends Integration_Test_Case {
	public function set_up(): void {
		parent::set_up();

		if ( ! did_action( 'elementor/loaded' ) || ! class_exists( '\Elementor\Widget_Base' ) ) {
			$this->markTestSkipped( 'Elementor is not loaded in this environment.' );
		}
	}

	public function test_registrar_registers_both_widgets(): void {
		$manager = $this->fake_widgets_manager();

		( new Elementor_Widget() )->register( $manager );

		$this->assertCount( 2, $manager->registered );
		$this->assertInstanceOf( Search_Widget::class, $manager->registered[0] );
		$this->assertInstanceOf( Products_Widget::class, $manager->registered[1] );
	}

	/**
	 * Both widgets declare the shared runtime bundle, which is what makes them
	 * hydrate inside the Elementor editor preview rather than only on the front
	 * end.
	 */
	public function test_both_widgets_declare_the_shared_runtime(): void {
		foreach ( [ new Search_Widget(), new Products_Widget() ] as $widget ) {
			$this->assertContains( Frontend_Assets::HANDLE, $widget->get_script_depends() );
			$this->assertContains( Frontend_Assets::HANDLE, $widget->get_style_depends() );
		}
	}

	public function test_products_widget_identity(): void {
		$widget = new Products_Widget();

		$this->assertSame( 'webhead-search-cloud-products', $widget->get_name() );
		$this->assertNotSame( '', $widget->get_title() );
	}

	public function test_registrar_is_a_no_op_for_an_object_without_a_register_method(): void {
		$manager = new class() {
			/** @var array<int,mixed> */
			public array $registered = [];
		};

		// Must not fatal even though `$manager` has no register() method.
		( new Elementor_Widget() )->register( $manager );

		$this->assertSame( [], $manager->registered );
	}

	public function test_widget_identity(): void {
		$widget = new Search_Widget();

		$this->assertSame( 'webhead-search-cloud-search', $widget->get_name() );
		$this->assertNotSame( '', $widget->get_title() );
		$this->assertContains( 'general', $widget->get_categories() );
		$this->assertContains( 'search', $widget->get_keywords() );
	}

	public function test_widget_declares_the_shared_runtime_bundle(): void {
		$widget = new Search_Widget();

		$this->assertContains( Frontend_Assets::HANDLE, $widget->get_script_depends() );
		$this->assertContains( Frontend_Assets::HANDLE, $widget->get_style_depends() );
	}

	/**
	 * A stand-in for Elementor's widgets manager that records what gets
	 * registered. Matches the `register( $widget )` shape the registrar checks
	 * for with `method_exists()`.
	 */
	private function fake_widgets_manager(): object {
		return new class() {
			/** @var array<int,mixed> */
			public array $registered = [];

			public function register( $widget ): void {
				$this->registered[] = $widget;
			}
		};
	}
}
