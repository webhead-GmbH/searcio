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
// "send-horizontal") — neither exists in `@wordpress/icons`.
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

export const sendIcon = (
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
		<path d="M3.4 20.4l17.5-8.4a1 1 0 0 0 0-1.8L3.4 1.8a1 1 0 0 0-1.4 1.2l2.4 6.7a1 1 0 0 0 .8.7l8.8 1.6-8.8 1.6a1 1 0 0 0-.8.7l-2.4 6.7a1 1 0 0 0 1.4 1.1z" />
	</svg>
);
