/*
 * layers.js — the mountain scene as a MULTIPLANE: the film, the clouds, the plateau, each on its own move.
 *
 * Test 9 (Alex, 19 Sep): the hero is no longer one baked film. The mountain film is the far plane; the
 * cloud plates sit between; the plateau with the tent (keyed from green, assets/layers/plateau.png — a
 * frame sequence with alpha once the video lands) is the near plane. The scroll and the cursor move
 * them by depth, so the depth is real: the near plane travels more than the far one.
 *
 *   scroll  — the plateau RISES into the frame as the camera pulls back from the peak (enter window),
 *             then holds; every plane drifts a little with the scroll by its depth (scrollDrift)
 *   cursor  — every plane leans toward the cursor by its depth (mouse, px), eased
 *   hand-over — descent.js still owns the blur/dim/lift of the whole act; on top of that the plateau
 *             lifts further (lift, vh) — the near plane leaves first when we go under
 *
 * Everything reads the scene's progress (progress.js). Numbers live in LAYERS.
 */

import { sceneProgress } from './progress.js?v=2026-09-19a';

export const LAYERS = {
	mouseEase: 2.2,
	/* NIGHT — the far planes sink into the dark as the camp comes on (Alex, 19 Sep: from where "We map the route"
	   leaves, captions block 02 ends at 0.38). Scene progress window; the mountain and the clouds dim to these. */
	night: { at: [0.37, 0.54], mountain: 0.28, clouds: 0.45 },
	cloudsOut: [0.92, 0.985],   // hero scroll: the plates leave with the act at the hand-over (was descent.js's; the clouds' opacity is owned here now)
	planes: {
		mountain: { mouse: 7,  scrollDrift: 0,  scale: 1.035 },     // far: barely moves; scaled a touch so the lean never shows an edge
		clouds:   { mouse: 13, scrollDrift: 0 },                   // between (the plate rig adds its own sway on top)
		plateau:  { mouse: 24, scrollDrift: -3, scale: 1.02,
			enter: [0.08, 0.42],   // scene progress: the plateau rises from `from` vh below to its place (Alex, 19 Sep: "не сразу должно появляться")
			from: 72,              // vh below its place at the start: the mountain alone first, the camp arrives as the camera comes down
			lift: [0.90, 0.99],    // hero-scroll window (as ACT.hero.soften): the near plane comes at the camera — it GROWS from its bottom edge (no edge ever shows) and lifts a little
			liftVh: 6, grow: 0.14 },
	},
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export function createLayers({ mountain, clouds, plateau, heroEnd = 0.56, cfg = LAYERS }) {
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const mouse = { x: 0, y: 0 }, lean = { x: 0, y: 0 };
	window.addEventListener('pointermove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });

	const P0 = cfg.planes;
	let last = performance.now();
	function frame(now) {
		const dt = Math.min(0.1, (now - last) / 1000); last = now;
		if (!reduced) { lean.x += (mouse.x - lean.x) * Math.min(1, dt * cfg.mouseEase); lean.y += (mouse.y - lean.y) * Math.min(1, dt * cfg.mouseEase); }
		const P = sceneProgress(), h = clamp(P / heroEnd, 0, 1);

		const place = (el, p, extraVh = 0) => {
			if (!el) return;
			const x = lean.x * p.mouse, y = lean.y * p.mouse * 0.6;   // px, the lean
			const drift = (p.scrollDrift || 0) * h;                     // vh, with the hero's scroll
			el.style.transform = `translate3d(${x.toFixed(1)}px, calc(${y.toFixed(1)}px + ${(drift + extraVh).toFixed(2)}vh), 0)${p.scale ? ` scale(${p.scale})` : ''}`;
		};
		place(mountain, P0.mountain);
		place(clouds, P0.clouds);
		// the night: the far planes dim (the near plane keeps its own light — the tent)
		const n = smooth((P - cfg.night.at[0]) / (cfg.night.at[1] - cfg.night.at[0]));
		if (mountain) mountain.style.filter = n > 0.002 ? `brightness(${lerp(1, cfg.night.mountain, n).toFixed(3)}) saturate(${lerp(1, 0.75, n).toFixed(3)})` : '';
		if (clouds) { const out = 1 - smooth((h - cfg.cloudsOut[0]) / (cfg.cloudsOut[1] - cfg.cloudsOut[0])); const o = lerp(1, cfg.night.clouds, n) * out; clouds.style.opacity = o.toFixed(3); clouds.style.visibility = o > 0.002 ? 'visible' : 'hidden'; }
		// the plateau: rises in, then lifts out ahead of the act
		const pl = P0.plateau;
		const enter = smooth((P - pl.enter[0]) / (pl.enter[1] - pl.enter[0]));
		const lift = smooth((h - pl.lift[0]) / (pl.lift[1] - pl.lift[0]));
		place(plateau, { ...pl, scale: (pl.scale || 1) + lift * (pl.grow || 0) }, lerp(pl.from, 0, enter) - lift * pl.liftVh);
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
	return { cfg };
}
