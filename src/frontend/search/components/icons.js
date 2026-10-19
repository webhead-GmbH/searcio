/**
 * `@wordpress/icons` has no microphone icon, so this one custom SVG (lucide
 * "mic") fills that single gap. Everything else uses `@wordpress/icons`.
 */
export const micIcon = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M12 19v3" />
		<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
		<rect x="9" y="2" width="6" height="13" rx="3" />
	</svg>
);

// Assistant avatar (lucide "sparkles"), and the composer send glyph (lucide
// "send-horizontal") - neither exists in `@wordpress/icons`.
export const sparkleIcon = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="currentColor"
		aria-hidden="true"
	>
		<path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
	</svg>
);

// The assistant's results toggle: "columns" for the compare table, "grid" for
// the card list. `@wordpress/icons` has no matching pair at this weight.
export const compareIcon = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<rect x="3" y="4" width="7" height="16" rx="1.5" />
		<rect x="14" y="4" width="7" height="16" rx="1.5" />
	</svg>
);

export const gridIcon = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<rect x="3" y="3" width="7" height="7" rx="1.5" />
		<rect x="14" y="3" width="7" height="7" rx="1.5" />
		<rect x="3" y="14" width="7" height="7" rx="1.5" />
		<rect x="14" y="14" width="7" height="7" rx="1.5" />
	</svg>
);

/*
 * Drawn symmetrically about the viewBox's vertical centre (y=12) and spanning
 * x 2.5-21.5, so it sits centred in the round send button. The previous glyph
 * was a stroked outline whose bounding box was offset within the viewBox, which
 * left it visibly high and right of centre.
 */
export const sendIcon = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="currentColor"
		aria-hidden="true"
	>
		<path d="M2.5 3.2 21.5 12 2.5 20.8l0-6.9L15 12 2.5 10.1z" />
	</svg>
);

// The visual-search upload control (lucide "camera"); `@wordpress/icons` has
// no camera either.
export const cameraIcon = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M14.5 4h-5L8 6.5H4.5A1.5 1.5 0 0 0 3 8v10a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 18V8a1.5 1.5 0 0 0-1.5-1.5H16z" />
		<circle cx="12" cy="12.5" r="3.5" />
	</svg>
);
