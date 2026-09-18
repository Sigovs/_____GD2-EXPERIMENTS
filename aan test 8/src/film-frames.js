/*
 * film-frames.js — the film as a frame sequence, drawn on a canvas, driven by the scroll.
 *
 * Why not <video>.currentTime: every seek decodes back to the previous keyframe (GOP 250 in
 * our encode), iOS Safari quantises seeks, and 24 fps over ~3700 px of scroll steps 19 px a
 * frame. Frames fix all three: a seek is a drawImage, iOS is happy, and between two frames we
 * CROSSFADE (frame i at 1−t, frame i+1 at t) — for a slow camera move that reads as smooth
 * without inventing frames.
 *
 * Loading: the poster is the first paint; then every 8th frame (the page is scrubbable after
 * ~1 MB), then the rest, nearest to the current position first. Two sizes: 1600 for desktop,
 * 960 under 1000 px wide. Reduced motion: the poster stays.
 *
 * Same contract as hero-scrub.js so the rest of the page (clouds, intro) does not care which
 * transport is on: `body.is-ready`, a 'ready' event, and window.__film.{progress, frame}.
 */

export const FILM = {
	frames: 241,
	fps: 24,
	dir: (w) => (w > 1000 ? 'assets/frames/1600' : 'assets/frames/960'),
	name: (i) => `f${String(i + 1).padStart(3, '0')}.webp`,
	range: [0, 1],         // the share of the page this film scrubs over (two films overlap where their ranges do — descent.js)
	filmEnd: 1.0,          // within its range, the film spans this share (1 = all of it)
	damp: 10,              // how fast the film follows the scroll (higher = tighter)
	coarse: 8,             // first pass: every Nth frame
	crossfade: true,       // blend the two frames around the fractional position
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createFilmFrames({ canvas, poster, cfg: overrides = {}, loadAfter = 0 }) {
	const cfg = { ...FILM, ...overrides };
	const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
	let mayLoad = loadAfter === 0;   // a second film waits its turn, so the first one's frames come in first
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const dir = cfg.dir(window.innerWidth);
	const imgs = new Array(cfg.frames).fill(null);
	const loading = new Set();
	let target = 0, current = 0, raf = 0, ready = false;
	let W = 0, H = 0, dpr = 1;

	function resize() {
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		W = window.innerWidth; H = window.innerHeight;
		canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
		canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
		draw(true);
	}

	// object-fit: cover
	function cover(img) {
		const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
		const s = Math.max(W / iw, H / ih);
		const dw = iw * s, dh = ih * s;
		return [(W - dw) / 2 * dpr, (H - dh) / 2 * dpr, dw * dpr, dh * dpr];
	}

	function nearest(i) {
		// the closest loaded frame (for a frame not yet in): keeps the picture continuous while loading
		for (let d = 0; d < cfg.frames; d++) {
			if (imgs[i - d]) return imgs[i - d];
			if (imgs[i + d]) return imgs[i + d];
		}
		return null;
	}

	let lastKey = '';
	function draw(force = false) {
		if (!W) return;
		const f = clamp(current, 0, cfg.frames - 1);
		const i0 = Math.floor(f), i1 = Math.min(cfg.frames - 1, i0 + 1), t = f - i0;
		const a = imgs[i0] || nearest(i0), b = imgs[i1] || nearest(i1);
		const key = `${i0}:${t.toFixed(3)}:${!!a}:${!!b}`;
		if (!force && key === lastKey) return;
		lastKey = key;
		if (!a) return;
		ctx.globalAlpha = 1;
		ctx.drawImage(a, ...cover(a));
		if (cfg.crossfade && b && b !== a && t > 0.02) {
			ctx.globalAlpha = t;
			ctx.drawImage(b, ...cover(b));
			ctx.globalAlpha = 1;
		}
	}

	function frame() {
		raf = 0;
		const d = target - current;
		if (Math.abs(d) < 0.01) current = target;
		else { current += d * Math.min(1, cfg.damp / 60); schedule(); }
		draw();
	}
	function schedule() { if (!raf) raf = requestAnimationFrame(frame); }

	function load(i) {
		if (imgs[i] || loading.has(i) || i < 0 || i >= cfg.frames) return;
		loading.add(i);
		const img = new Image();
		img.decoding = 'async';
		img.onload = () => { imgs[i] = img; loading.delete(i); draw(true); pump(); };
		img.onerror = () => { loading.delete(i); };
		img.src = `${dir}/${cfg.name(i)}`;
	}
	// priority: coarse grid first, then outward from the current frame
	function pump() {
		if (!mayLoad || loading.size >= 6) return;
		for (let i = 0; i < cfg.frames; i += cfg.coarse) if (!imgs[i] && !loading.has(i)) { load(i); if (loading.size >= 6) return; }
		const c = Math.round(current);
		for (let d = 0; d < cfg.frames; d++) {
			for (const i of [c + d, c - d]) { if (i >= 0 && i < cfg.frames && !imgs[i] && !loading.has(i)) { load(i); if (loading.size >= 6) return; } }
		}
	}

	function scrollProgress() {
		const max = document.documentElement.scrollHeight - window.innerHeight;
		return max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
	}
	function setProgress(p) {
		const [r0, r1] = cfg.range;
		const local = clamp((p - r0) / (r1 - r0), 0, 1);
		target = clamp(local / cfg.filmEnd, 0, 1) * (cfg.frames - 1);
		schedule();
		pump();
	}

	// first paint: the poster, at once
	const first = new Image();
	first.onload = () => { imgs[0] = first; resize(); if (!ready) { ready = true; document.body.classList.add('is-ready'); document.body.dispatchEvent(new Event('ready')); } if (!reduced) pump(); };
	first.src = poster || `${dir}/${cfg.name(0)}`;
	if (loadAfter) setTimeout(() => { mayLoad = true; if (!reduced) pump(); }, loadAfter);

	window.addEventListener('resize', resize);
	if (!reduced && cfg.scroll !== false) {
		const onScroll = () => setProgress(scrollProgress());
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('load', onScroll);
		window.addEventListener('pageshow', onScroll);
		setProgress(scrollProgress());
	}

	const api = { get progress() { return target / (cfg.frames - 1); }, get frame() { return current; }, setProgress, cfg, canvas };
	if (!window.__film) window.__film = api;   // the first film is the page's film (the clouds, the glow read it)
	return api;
}
