/*
 * drift-cards.js — photographs that float up through the water as we sink.
 *
 * Each card owns a window of the scene's progress: entering it the card is below the frame; through
 * the window it rises past the viewport and is gone above (Alex, 18 Sep: "подплывающие снизу на
 * скролл и исчезающие потом наверх"). The rise is the scroll's — scrub back and it comes back down —
 * damped a little so a flick reads as drift, not a jump; on top of that a slow sway on a clock, a
 * lean toward the cursor by depth, and a soft fade at both ends of the travel.
 *
 *   card = { at: [from, to], x: '8vw', w: 'clamp(220px, 26vw, 420px)', ratio: 4/5, tilt: -3, depth: 0..1, src, alt, label }
 *
 * PHOTOS ARE PLACEHOLDERS (frames from the films) — the client's go in DRIFT_CARDS.cards.
 */

import { sceneProgress } from './progress.js?v=2026-09-18v';

export const DRIFT_CARDS = {
	travel: [1.12, -0.42],     // of the viewport height: where the card starts (below) and ends (above)
	fade: 0.14,                // of the window: the fade at each end
	damp: 6,                   // how tightly the card follows the scroll (higher = tighter)
	sway: { px: 10, period: 5.5 },
	parallax: 28,              // px at depth 1
	cards: [   // x = the card's left edge; nearer the centre (Alex, 18 Sep: "ближе к центру") — left cards from ~20vw, right ones from ~52vw
		{ at: [0.60, 0.73], x: '20vw', w: 'clamp(200px, 24vw, 380px)', ratio: 4 / 5, tilt: -2.5, depth: 0.8, src: 'previews/card-ridge.jpg',  alt: '', label: 'The ridge, 4 a.m.' },
		{ at: [0.68, 0.81], x: '54vw', w: 'clamp(180px, 20vw, 320px)', ratio: 3 / 2, tilt: 2,    depth: 0.45, src: 'previews/camp.jpg',        alt: '', label: 'Base camp' },
		{ at: [0.77, 0.90], x: '26vw', w: 'clamp(200px, 22vw, 360px)', ratio: 4 / 5, tilt: -1.5, depth: 0.65, src: 'previews/card-trench.jpg', alt: '', label: 'The trench' },
		{ at: [0.85, 0.97], x: '52vw', w: 'clamp(180px, 20vw, 320px)', ratio: 5 / 4, tilt: 3,    depth: 1,    src: 'previews/card-floor.jpg',  alt: '', label: 'The floor' },
	],
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

export function createDriftCards({ root = document.body, cfg = DRIFT_CARDS } = {}) {
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const host = document.createElement('div');
	host.className = 'drift';
	host.setAttribute('aria-hidden', 'true');
	root.appendChild(host);

	const cards = cfg.cards.map((c) => {
		const el = document.createElement('figure');
		el.className = 'drift__card';
		el.style.left = c.x; el.style.width = c.w; el.style.setProperty('--ratio', String(c.ratio)); el.style.setProperty('--tilt', c.tilt + 'deg');
		el.innerHTML = `<img src="${c.src}" alt="${c.alt}" loading="lazy" decoding="async"><figcaption>${c.label}</figcaption>`;
		host.appendChild(el);
		return { cfg: c, el, y: null, shown: false, ph: Math.random() * Math.PI * 2 };
	});

	const mouse = { x: 0, y: 0 }, lean = { x: 0, y: 0 };
	window.addEventListener('pointermove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });

	let last = performance.now(), t = 0;
	function frame(now) {
		const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
		lean.x += (mouse.x - lean.x) * Math.min(1, dt * 2); lean.y += (mouse.y - lean.y) * Math.min(1, dt * 2);
		const P = sceneProgress(), H = innerHeight;
		for (const c of cards) {
			const [a, z] = c.cfg.at;
			const inWin = P >= a - 0.02 && P <= z + 0.02;
			if (!inWin) { if (c.shown) { c.el.style.visibility = 'hidden'; c.shown = false; c.y = null; } continue; }
			const k = clamp((P - a) / (z - a), 0, 1);
			const targetY = (cfg.travel[0] + (cfg.travel[1] - cfg.travel[0]) * k) * H;
			c.y = c.y === null ? targetY : c.y + (targetY - c.y) * Math.min(1, dt * cfg.damp);
			const fade = smooth(k / cfg.fade) * smooth((1 - k) / cfg.fade);
			const sway = reduced ? 0 : Math.sin(t / cfg.sway.period * Math.PI * 2 + c.ph) * cfg.sway.px * (0.5 + 0.5 * c.cfg.depth);
			const px = lean.x * cfg.parallax * c.cfg.depth + sway, py = lean.y * cfg.parallax * 0.5 * c.cfg.depth;
			c.el.style.transform = `translate3d(${px.toFixed(1)}px, ${(c.y + py).toFixed(1)}px, 0) rotate(var(--tilt))`;
			c.el.style.opacity = fade.toFixed(3);
			if (!c.shown) { c.el.style.visibility = 'visible'; c.shown = true; }
		}
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
	return { cards, cfg };
}
