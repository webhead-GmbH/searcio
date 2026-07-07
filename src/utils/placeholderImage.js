/**
 * Shared "no image" placeholder for result cards. A data URI (no network
 * request, so it can't add any latency) rather than swapping the element out
 * for a `<span>`/background-image the way the plugin's own built-in cards do
 * (`templates.js`'s `CardImage`) — server-designed card templates style the
 * `<img>` tag directly (sizing, `object-fit`, border-radius, etc.), and
 * keeping it a real `<img>` means that styling still applies to the
 * placeholder instead of silently doing nothing once the tag changes.
 */
const PLACEHOLDER_IMAGE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="#f0f1f3"/><path fill="#9aa0a6" d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.86 8.86l-3 3.87L9 13.14 6 17h12l-3.86-5.14z"/></svg>';

export const PLACEHOLDER_IMAGE_DATA_URI = `data:image/svg+xml,${ encodeURIComponent( PLACEHOLDER_IMAGE_SVG ) }`;
