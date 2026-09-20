/*
 * hero-intro.js — VERSION 4 (Alex, 20 Sep): the mountain does not scrub. On load its VIDEO plays once, at its own
 * pace, and lands on the last frame; the plateau film follows the video's clock (the pull-back and the push-in stay one
 * move — the depth Alex liked), and rises into the frame over the same seconds. Then the scene is still: the scroll
 * owns the route (src/route.js) and the water.
 *
 *   ready   — the page's intro (intro.js) waits for body 'ready': fired when the video can play
 *   start   — once the plateau has enough frames to follow (or `waitMax` ms, whichever first)
 *   skip    — the first wheel / touch / key during the intro runs the video on at `skipRate`: nobody is locked in,
 *             whoever does not touch anything gets the whole shot
 *   done    — the video holds its last frame (no loop); the plateau holds frame 240; `done` is true
 *
 * The api mirrors film-frames' where the page reads it: setProgress (a no-op), frame, progress, cfg.range, loaded.
 */

export const INTRO = {
	rate: 1.2,          // the video's pace (1 = the 10 s of the file)
	skipRate: 8,        // on the first scroll during the intro
	waitPlateau: 120,   // plateau frames in before the shot starts (the plateau follows the clock — its frames must be there)
	waitMax: 4000,      // ms after the video is ready: start anyway
	plateauRise: 0.55,  // of the video: the plateau is up by here (layers.js reads it through enterAt)
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

export function createHeroIntro({ video, plateau = null, range, cfg = INTRO, play = true }) {
	let t = 0, done = false, started = false;
	// `plateau` may be set by the page after creation (the plateau film is made later). Getters, not Object.assign:
	// assign would copy their values once and freeze them.
	const api = {
		plateau,
		setProgress() {},                               // the scroll does not move the mountain
		get frame() { return t * 240; },
		get progress() { return t; },
		get t() { return t; },
		get done() { return done; },
		get loaded() { return undefined; },             // the plateau's loading gate in index.html reads this: no frames to wait for
		enterAt() { return smooth(t / cfg.plateauRise); },   // the plateau's rise, on the video's clock (layers.js)
		cfg: { range },
		onDone: [],
		finish: () => finish(),
	};
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const listeners = [];
	const ready = () => { if (document.body.classList.contains('is-ready')) return; document.body.classList.add('is-ready'); document.body.dispatchEvent(new Event('ready')); };

	function finish() {
		if (done) return;
		done = true; t = 1; log.push([Math.round(performance.now()) / 1000, 'done']);
		try { video.pause(); if (video.duration) video.currentTime = video.duration; } catch {}
		api.plateau?.setProgress(range[1]);
		listeners.forEach(([ev, fn, opt]) => window.removeEventListener(ev, fn, opt));
		api.onDone.forEach((fn) => fn());
	}
	function start() {
		if (started) return; started = true; log.push([Math.round(performance.now()) / 1000, 'start']);
		if (reduced || !play) { finish(); return; }   // reduced motion, or the editor: the still scene at once
		video.playbackRate = cfg.rate;
		video.play().catch(() => finish());   // autoplay refused (no gesture, not muted?) — the still scene, at once
	}
	const log = (window.__introLog = []);   // diagnosis: what happened when (the page's load event comes late — the video holds it)
	let logAt = 0;
	function tick() {
		if (!done) {
			if (video.duration) t = clamp(video.currentTime / video.duration, 0, 1);
			api.plateau?.setProgress(range[1] * t);
			if (performance.now() - logAt > 400) { logAt = performance.now(); log.push([Math.round(logAt) / 1000, +t.toFixed(3), started, api.plateau?.loaded ?? -1, video.readyState]); }
		}
		requestAnimationFrame(tick);
	}
	video.addEventListener('ended', finish);
	video.addEventListener('canplay', () => {
		ready();
		// start once the plateau can follow, or after waitMax
		const t0 = performance.now();
		const wait = () => { if (started) return; if (!api.plateau || api.plateau.loaded >= cfg.waitPlateau || performance.now() - t0 > cfg.waitMax) start(); else setTimeout(wait, 100); };
		wait();
	}, { once: true });
	video.addEventListener('error', () => { ready(); finish(); });
	requestAnimationFrame(tick);

	// the skip: the first scroll gesture runs the shot on
	const onSkip = (e) => { if (done || !started) return; if (e.type === 'keydown' && !['ArrowDown', 'PageDown', ' ', 'Space', 'End'].includes(e.key)) return; video.playbackRate = cfg.skipRate; };
	for (const [ev, opt] of [['wheel', { passive: true }], ['touchmove', { passive: true }], ['keydown', false]]) { window.addEventListener(ev, onSkip, opt); listeners.push([ev, onSkip, opt]); }

	return api;
}
