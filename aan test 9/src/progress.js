/*
 * progress.js — the scene's progress, 0..1, shared by everything that follows the scroll.
 *
 * The films, the captions, the water's life and the hand-over all read the same number. It is the
 * scroll over the SCENE — the fixed stage plus its scroll track (.spacer) — not over the document:
 * what comes after the track (the brands, the footer) scrolls in over the finished scene without
 * stretching the films.
 */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
let track = null;
export function sceneProgress() {
	if (!track) track = document.querySelector('.spacer');
	const end = track ? track.offsetTop + track.offsetHeight : document.documentElement.scrollHeight;
	const max = end - window.innerHeight;
	return max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
}
