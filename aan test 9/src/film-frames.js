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
	dir: (w) => (w > 1700 ? 'assets/frames/1920' : w > 1000 ? 'assets/frames/1600' : w > 520 ? 'assets/frames/960' : 'assets/frames/640'),   // wide screens get the native 1920 (the fine snow and rock of the new film soften when 1600 is stretched — Alex, 19 Sep); phones 640
	name: (i) => `f${String(i + 1).padStart(3, '0')}.webp`,
	range: [0, 1],         // the share of the page this film scrubs over (two films overlap where their ranges do — descent.js)
	filmEnd: 1.0,          // within its range, the film spans this share (1 = all of it)
	damp: 10,              // how fast the film follows the scroll (higher = tighter)
	coarse: 8,             // first pass: every Nth frame
	crossfade: true,       // blend the two frames around the fractional position
	keep: (w) => (w > 700 ? 999 : 72),   // frames kept decoded around the current one (plus the coarse grid): all on desktop, a window on phones — a phone cannot hold 241 bitmaps
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createFilmFrames({ canvas, poster, cfg: overrides = {}, loadAfter = 0 }) {
	const cfg = { ...FILM, ...overrides };
	const ctx = canvas.getContext('2d', { alpha: !!cfg.alpha, desynchronized: true });   // alpha: a keyed plate over other planes
	let mayLoad = loadAfter === 0;   // a second film waits its turn, so the first one's frames come in first
	const KEEP = typeof cfg.keep === 'function' ? cfg.keep(window.innerWidth) : cfg.keep;
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const dir = cfg.dir(window.innerWidth);
	const imgs = new Array(cfg.frames).fill(null);
	const loading = new Set();
	/* DECODED frames: the browser cannot hold three films' worth of decoded bitmaps and re-decodes on every scroll step.
	   So the frames near the current one are decoded explicitly (createImageBitmap, off the main thread) and kept; the
	   ones that drift out of the window are closed. drawImage of a bitmap is a blit — no decode on the scroll. */
	const bitmaps = new Array(cfg.frames).fill(null), decoding = new Set(), blobs = new Array(cfg.frames).fill(null);
	const stats = { bitmap: 0, img: 0, nearest: 0 };   // where each drawn frame came from (diagnosis)
	const BITMAP_WINDOW = window.innerWidth > 700 ? 16 : 6;   // frames each side of the current one (13 bitmaps ≈ 100 MB at 1920 — small on purpose: GPU memory churn stalls the renderer)
	const hasBitmaps = typeof createImageBitmap === 'function';
	let target = 0, current = 0, raf = 0, ready = false;
	let W = 0, H = 0, dpr = 1;

	function resize() {
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		// the size: the viewport, or the parent's box when the film sits in an OVERSCANNED act (test 9: the mountain act
		// is 4vh/4vw larger than the screen on every side, so no move, lean, blur or scale inside it can show an edge)
		const par = cfg.fitParent ? canvas.parentElement : null;   // layout size (offset*), not the transformed box: the plane may be scaled
		W = par ? par.offsetWidth : window.innerWidth; H = par ? par.offsetHeight : window.innerHeight;
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

	let lastKey = '', lastPair = null;
	function draw(force = false) {
		if (!W) return;
		const f = clamp(current, 0, cfg.frames - 1);
		const i0 = Math.floor(f), i1 = Math.min(cfg.frames - 1, i0 + 1), t = f - i0;
		const a = bitmaps[i0] || imgs[i0] || nearest(i0), b = bitmaps[i1] || imgs[i1] || nearest(i1);
		stats[bitmaps[i0] ? 'bitmap' : imgs[i0] ? 'img' : 'nearest']++;
		const key = `${i0}:${t.toFixed(3)}:${!!a}:${!!b}`;
		if (!force && key === lastKey) return;
		lastKey = key;
		if (!a) return;
		lastPair = { a, b: (cfg.crossfade && b && b !== a && t > 0.02) ? b : null, t };   // what is on the canvas now (water-waves.js samples the same pair)
		if (cfg.alpha) ctx.clearRect(0, 0, canvas.width, canvas.height);   // a transparent plate must not stack its old frames
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

	// memory: far from the current frame, the full-resolution bitmaps are let go (the coarse grid stays, so
	// scrubbing far away still shows a picture at once); they come back from the HTTP cache when needed
	// the bitmap window follows the current frame: decode what is near, close what is far
	function tendBitmaps() {
		if (!hasBitmaps) return;
		// (a hidden film keeps its window too — the water must have its first frames decoded BEFORE it comes up, or the
		// hand-over starts with a stutter; Alex, 19 Sep: "подводное скачет")
		const c = Math.round(current);
		for (let i = 0; i < cfg.frames; i++) { if (Math.abs(i - c) > BITMAP_WINDOW && bitmaps[i]) { bitmaps[i].close(); bitmaps[i] = null; } }
		for (let d = 0; d <= BITMAP_WINDOW; d++) for (const i of d ? [c + d, c - d] : [c]) {
			if (i < 0 || i >= cfg.frames) continue;
			if (decoding.size >= 6) return;   // six in flight (off the main thread), nearest first; the next tend() continues
			const near = true;
			if (near && !bitmaps[i] && imgs[i] && !decoding.has(i)) {
				decoding.add(i);
				createImageBitmap(blobs[i] || imgs[i]).then((bm) => { decoding.delete(i); if (Math.abs(i - Math.round(current)) <= BITMAP_WINDOW) { bitmaps[i] = bm; if (i === Math.floor(current) || i === Math.ceil(current)) draw(true); } else bm.close(); tend(); }).catch(() => { decoding.delete(i); tend(); });
			}
		}
	}
	let tendTimer = 0;
	const tend = () => { if (!tendTimer) tendTimer = setTimeout(() => { tendTimer = 0; tendBitmaps(); }, 40); };
	function evict() {
		const c = Math.round(current), half = KEEP / 2;
		for (let i = 0; i < cfg.frames; i++) {
			if (!imgs[i] || i % cfg.coarse === 0 || i === 0) continue;
			if (Math.abs(i - c) > half) imgs[i] = null;
		}
	}
	let evictTimer = 0;
	function load(i) {
		if (imgs[i] || loading.has(i) || i < 0 || i >= cfg.frames) return;
		loading.add(i);
		// the bytes come in as a Blob (kept: ~100 KB a frame), the Image is made from them for the cheap fallback path;
		// the window's bitmaps are decoded from the Blob, off the main thread
		fetch(`${dir}/${cfg.name(i)}`).then((r) => r.ok ? r.blob() : Promise.reject(r.status)).then((blob) => {
			blobs[i] = blob;
			const img = new Image();
			img.decoding = 'async';
			img.onload = () => { imgs[i] = img; loading.delete(i); draw(true); pump(); tend(); };
			img.onerror = () => { loading.delete(i); };
			img.src = URL.createObjectURL(blob);
		}).catch(() => { loading.delete(i); });
	}
	// priority: coarse grid first, then outward from the current frame
	function pump() {
		if (!mayLoad || loading.size >= 6) return;
		for (let i = 0; i < cfg.frames; i += cfg.coarse) if (!imgs[i] && !loading.has(i)) { load(i); if (loading.size >= 6) return; }
		const c = Math.round(current);
		for (let d = 0; d < Math.min(cfg.frames, KEEP / 2); d++) {
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
		tend();
		if (KEEP < cfg.frames && !evictTimer) evictTimer = setTimeout(() => { evictTimer = 0; evict(); pump(); }, 800);
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

	const api = { get progress() { return target / (cfg.frames - 1); }, get frame() { return current; }, get pair() { return lastPair; }, setProgress, cfg, canvas,
		get loaded() { let n = 0; for (let i = 0; i < cfg.frames; i++) if (imgs[i]) n++; return n; }, stats,
		allowLoad() { if (!mayLoad) { mayLoad = true; if (!reduced) pump(); } } };   // a film that waits for its cue (the water: not before the scroll nears it)
	if (!window.__film) window.__film = api;   // the first film is the page's film (the clouds, the glow read it)
	return api;
}
