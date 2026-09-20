/*
 * mist.js — VERSION 4 (Alex, 20 Sep): the mountain does not scrub; the scroll flies us THROUGH THE CLOUDS to the camp.
 *
 * Two moves layered, both taken from references Alex brought:
 *   the BANK  — white-desert.com: two plates rise from the bottom of the frame at different speeds and white the
 *               screen out, then leave upward; the next scene is under them
 *   the PASS  — unitedcarriers.com: big cumulus plates fly at the camera — they scale up from the middle of the frame
 *               and drift out past its edges, staggered, the way clouds pass a descending plane
 * A veil (one flat tone) peaks under the thickest moment so the cover is complete on any viewport; the plateau rises
 * into its place behind it (layers.js reads `enterAt`). Everything is tinted for the night through one filter.
 *
 * Windows are SCENE progress (progress.js). Plates lean with the cursor — they are the nearest layer.
 */

export const MIST = {
	window: [0.03, 0.38],          // the whole pass; the camp rests after it until the water (ACT: 0.448)
	cover: [0.17, 0.25],           // the veil is full here; the plateau rises under it
	plateau: [0.15, 0.27],         // the plateau's rise (scene progress) — hidden by the veil
	veil: { color: '#5c6878', peak: 1 },
	brightness: 0.62,              // the plates are daylight white; the page is night
	mouse: 22,                     // px lean of the whole pass with the cursor
	bank: {                        // white-desert: from 100% (below the frame) to `to` (above), eased
		back:  { from: 100, to: -120, ease: 1.0 },
		front: { from: 100, to: -160, ease: 1.15 },
		width: 1.0,                // of the viewport (front plate)
	},
	pass: [                        // unitedcarriers: [plate, x, y (of the frame, 0..1 at rest), scale from→to, window (of the pass 0..1)]
		{ src: 'uc-3', x: 0.30, y: 0.62, from: 0.35, to: 5.5, at: [0.00, 0.62], drift: [-0.9, 0.5] },
		{ src: 'uc-2', x: 0.72, y: 0.40, from: 0.30, to: 5.0, at: [0.12, 0.74], drift: [0.9, -0.3] },
		{ src: 'uc-1', x: 0.50, y: 0.25, from: 0.40, to: 6.0, at: [0.26, 0.90], drift: [0.1, -1.0] },
		{ src: 'uc-3', x: 0.62, y: 0.80, from: 0.30, to: 5.0, at: [0.40, 1.00], drift: [0.6, 0.9] },
	],
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export function createMist({ el, cfg = MIST }) {
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	el.innerHTML = '';
	el.style.setProperty('--mist-b', cfg.brightness);
	const mk = (cls, src) => { const i = document.createElement('img'); i.className = cls; i.src = src; i.alt = ''; i.draggable = false; i.decoding = 'async'; el.append(i); return i; };
	// order: the pass plates (far → near), the veil, the bank (nearest)
	const pass = cfg.pass.map((p) => ({ p, img: mk('mist__pass', `assets/mist/${p.src}.avif`) }));
	const veil = document.createElement('div'); veil.className = 'mist__veil'; veil.style.background = cfg.veil.color; el.append(veil);
	// each bank is a plate with a solid block under it (the plates' bottoms are solid white — the block carries that
	// down past the frame, so no bottom edge ever shows while the bank climbs)
	const bank = (cls, src) => { const d = document.createElement('div'); d.className = 'mist__bank ' + cls; const i = document.createElement('img'); i.src = src; i.alt = ''; i.draggable = false; i.decoding = 'async'; d.append(i); el.append(d); return d; };
	const back = bank('mist__bank--back', 'assets/mist/wd-back.png');
	const front = bank('mist__bank--front', 'assets/mist/wd-front.png');

	const mouse = { x: 0, y: 0 }, lean = { x: 0, y: 0 };
	addEventListener('pointermove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });

	let P = 0, last = performance.now();
	function paint() {
		const [w0, w1] = cfg.window;
		const u = clamp((P - w0) / (w1 - w0), 0, 1);           // 0..1 through the pass
		const on = u > 0 && u < 1;
		el.style.visibility = on ? 'visible' : 'hidden';
		if (!on) return;
		const lx = lean.x * cfg.mouse, ly = lean.y * cfg.mouse * 0.6;
		// the bank
		const b = cfg.bank;
		back.style.transform = `translate3d(${(lx * 0.6).toFixed(1)}px, ${lerp(b.back.from, b.back.to, smooth(clamp(u * b.back.ease, 0, 1))).toFixed(2)}%, 0)`;
		front.style.transform = `translate3d(${lx.toFixed(1)}px, ${lerp(b.front.from, b.front.to, smooth(clamp(u * b.front.ease, 0, 1))).toFixed(2)}%, 0)`;
		// the pass: each plate scales up from its place and drifts out
		for (const { p, img } of pass) {
			const k = clamp((u - p.at[0]) / (p.at[1] - p.at[0]), 0, 1);
			if (k <= 0 || k >= 1) { img.style.opacity = '0'; continue; }
			const s = lerp(p.from, p.to, k * k);                          // accelerating: the cloud comes at us
			const dx = (p.x - 0.5) * 2 + p.drift[0] * k * k, dy = (p.y - 0.5) * 2 + p.drift[1] * k * k;
			img.style.opacity = String(Math.sin(k * Math.PI) ** 0.6);
			img.style.transform = `translate3d(calc(${(dx * 50).toFixed(2)}vw + ${(lx * 0.4).toFixed(1)}px), calc(${(dy * 50).toFixed(2)}vh + ${(ly * 0.4).toFixed(1)}px), 0) scale(${s.toFixed(3)})`;
		}
		// the veil: full between cover[0] and cover[1] of the SCENE, soft either side
		const c0 = (cfg.cover[0] - w0) / (w1 - w0), c1 = (cfg.cover[1] - w0) / (w1 - w0);
		const v = u < c0 ? smooth((u - (c0 - 0.12)) / 0.12) : u > c1 ? 1 - smooth((u - c1) / 0.14) : 1;
		veil.style.opacity = (clamp(v, 0, 1) * cfg.veil.peak).toFixed(3);
	}
	function frame(now) {
		const dt = Math.min(0.1, (now - last) / 1000); last = now;
		if (!reduced) { lean.x += (mouse.x - lean.x) * Math.min(1, dt * 2.2); lean.y += (mouse.y - lean.y) * Math.min(1, dt * 2.2); }
		paint();
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);

	return {
		cfg, el,
		setProgress(p) { P = p; },
		enterAt() { return smooth((P - cfg.plateau[0]) / (cfg.plateau[1] - cfg.plateau[0])); },   // the plateau's rise, under the veil
	};
}
