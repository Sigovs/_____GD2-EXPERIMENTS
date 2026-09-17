/*
 * intro.js — the opening: we are inside the cloud; it parts, and there is the mountain.
 *
 *    0 –  700 ms  the stage comes up from the ground colour — into a cloud mass (cloud-layer.js
 *                 → setIntro(1): the plates denser, larger, pulled over the centre of the frame)
 *    0 – 3200 ms  the approach: the whole stage starts 1.14× (the eye on the mountain) and settles
 *                 to the film's first frame while the cloud parts
 *  300 – 2900 ms  the mass parts: the plates thin and move back to their places, the mountain
 *                 shows through (setIntro 1 → 0, ease in-out)
 * 1900 – 3100 ms  the empty glass of the route draws on from the summit (route-layer.js →
 *                 setReveal) — the instrument shows itself before any scroll
 * 2300 –        the statement: every letter rises from under its line's mask on a spring,
 *                 staggered from the first, the top line first (text-rise.js)
 * 2700 – 3300 ms  the navigation
 *
 * Waits for the film's metadata and the display face (capped), so nothing swaps mid-move.
 * Scrolling during the intro is honoured: hero-scrub.js owns the scroll, this only fades.
 * prefers-reduced-motion: no intro — the still is the page.
 */

import { splitLines, riseIn, rotateWord } from './text-rise.js';

const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
const T = { stage: 700, zoom: 3200, part: [300, 2900], reveal: [1900, 1200], line: [2300, 600], nav: [2700, 600] };
const ZOOM = 1.14;
const inOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export async function runIntro({ route, clouds } = {}) {
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const root = document.documentElement;
	if (reduced) { root.classList.remove('is-intro'); route?.setReveal?.(1); clouds?.setIntro?.(0); return; }   // no rotation either: the first word is the statement

	const stage = document.querySelector('.stage');
	const lines = [...document.querySelectorAll('.hero__line')];
	const nav = document.querySelector('.nav');
	route?.setReveal?.(0);
	clouds?.setIntro?.(1);
	splitLines(lines);

	// hold until the first frame can show and the face is in — but not forever
	const ready = new Promise((r) => { if (document.body.classList.contains('is-ready')) r(); else document.body.addEventListener('ready', r, { once: true }); });
	await Promise.race([Promise.all([ready, document.fonts?.ready ?? Promise.resolve()]), new Promise((r) => setTimeout(r, 1500))]);

	const t0 = performance.now();
	stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.stage, easing: EASE, fill: 'both' });
	stage.style.transformOrigin = '58% 38%';   // the summit's side of the frame
	stage.animate([{ transform: `scale(${ZOOM})` }, { transform: 'scale(1)' }], { duration: T.zoom, easing: 'cubic-bezier(0.3, 0, 0.15, 1)', fill: 'both' });

	// the cloud parts, then the route's glass draws on — both on one clock
	const tick = (now) => {
		const t = now - t0;
		const kp = Math.min(1, Math.max(0, (t - T.part[0]) / (T.part[1] - T.part[0])));
		clouds?.setIntro?.(1 - inOut(kp));
		const kr = Math.min(1, Math.max(0, (t - T.reveal[0]) / T.reveal[1]));
		route?.setReveal?.(1 - Math.pow(1 - kr, 3));   // ease-out cubic: fast off the summit, settling into the cloud
		if (kp < 1 || kr < 1) requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);

	lines.forEach((el) => { el.style.opacity = '1'; });   // the lines are visible; their letters are under the mask
	const letters = riseIn(lines, { delay: T.line[0] });
	nav?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.nav[1], delay: T.nav[0], easing: EASE, fill: 'both' });

	// hand everything back once the last move has landed: no fill-mode animation keeps owning a property
	await Promise.all([letters, new Promise((r) => setTimeout(r, Math.max(T.zoom, T.nav[0] + T.nav[1]) + 50))]);
	const owned = [stage, nav, ...lines.flatMap((l) => [...l.querySelectorAll('.ch')])];
	for (const el of owned) el?.getAnimations().forEach((a) => a.finish());
	root.classList.remove('is-intro');
	for (const el of owned) el?.getAnimations().forEach((a) => a.cancel());
	for (const el of lines) el.style.opacity = '';
	stage.style.transformOrigin = '';

	// the rotating word starts once the statement has landed, and rests while the statement is away (scrolled)
	const hero = document.querySelector('.hero');
	window.__rotate = rotateWord(document.querySelector('.hero__rotate'), { paused: () => parseFloat(hero?.style.opacity || '1') < 0.05 });
	window.__rotate?.start();
}
