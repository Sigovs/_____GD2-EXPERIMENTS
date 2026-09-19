/*
 * descent.js — two films, one scroll: the mountain hands over to the water.
 *
 * Not blur → cut → new film. The two films live together for a while (the plan Alex brought,
 * 18 Sep): the hero stays untouched until the last ~12 % of ITS scroll, then slips out of
 * reality a little (2–3 px blur, a touch darker, 1.5 % larger) while the water film — which
 * starts already under the surface, the tent's light and the mountain warped above — comes up
 * over it. For a moment the mountain is seen through the surface; then only the water is left,
 * and the scroll scrubs the descent.
 *
 * Everything is a function of the page's progress P (0..1):
 *   hero film    scrubs over [0, heroEnd·heroFilmEnd] and holds its last frame (the tent) until the hand-over;
 *                h = P / heroEnd is the hero's own scroll
 *   water film   scrubs over ACT.water = [heroEnd·0.91, 1]
 *   the hand-over is keyed on h (the hero's own scroll), so the table below reads like the plan:
 *     0.00–0.88  hero, untouched
 *     0.88–0.91  hero blurs a little, darkens a little, grows a little — still on the tent
 *     0.91–0.94  the water surface appears over it (its opacity rises)
 *     0.94–0.97  we are under: the hero dissolves, the clouds go with it
 *     0.97–1.00  water only — the real descent begins
 *
 * The hero's blur/opacity go on a WRAPPER that holds the film AND the tent's glow, so the light
 * leaves with the picture. The clouds fade with the hero. The vignette stays over everything.
 */

export const ACT = {
	heroEnd: 0.56,                      // the hero's share of the page; the water takes the rest (minus the overlap)
	heroFilmEnd: 0.90,                  // in hero scroll: the film plays to its last frame exactly where the hand-over begins (Alex, 19 Sep: "видео горы должно отыгрывать до конца")
	waterStart: 0.80,                   // in hero scroll: where the water film starts — the hand-over is LONG now (~110vh of scroll; Alex, 19 Sep: "резко, можно плавнее")
	hero: {
		soften: [0.84, 1.0],            // blur 0 → blurPx, brightness 1 → dim
		out: [0.93, 1.0],               // opacity 1 → 0
		blurPx: 2.5, dim: 0.85, grow: 1,   // no growth of the act either (Alex, 19 Sep: the mountain stays its size)
		lift: 0,                        // vh: NO lift of the whole act in test 9 — it showed the act's bottom edge as a straight seam over the water (Alex, 19 Sep); the near plane grows instead (layers.js)
	},
	water: { in: [0.80, 1.0], rise: true, soft: 0.9 },   // a tall soft edge (0.85 vh) AND the whole film fading 0 → 100% as it rises — a gradient, never a line (Alex, 19 Sep: "переход грубый")   // the water RISES from the bottom (a soft edge `soft` viewport-heights tall) instead of fading over the whole frame (Alex, 19 Sep); rise: false = the plain crossfade
	clouds: { out: [0.84, 0.98] },      // the plates leave with the hero
	end: [0.95, 1.0],                   // page progress: the water goes to the plain dark ground (Alex, 19 Sep) — short: the dark tail before the brands was a void
};

import { sceneProgress } from './progress.js?v=2026-09-18v';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ramp = (v, [a, b]) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export function createDescent({ heroWrap, waterCanvas, cloudCanvas, heroFilm, waterFilm, clouds, endEl = null, onWater = null, cfg = ACT }) {
	const progress = sceneProgress;
	let last = -1, cloudsRef = clouds;

	function apply(P) {
		const h = clamp(P / cfg.heroEnd, 0, 1);
		heroFilm.setProgress(P);
		waterFilm.setProgress(P);
		cloudsRef?.setProgress?.(h);

		const s = ramp(h, cfg.hero.soften), o = 1 - ramp(h, cfg.hero.out);
		const blur = lerp(0, cfg.hero.blurPx, s), dim = lerp(1, cfg.hero.dim, s), grow = lerp(1, cfg.hero.grow, s), lift = lerp(0, cfg.hero.lift, s);
		heroWrap.style.filter = s > 0 ? `blur(${blur.toFixed(2)}px) brightness(${dim.toFixed(3)})` : '';
		heroWrap.style.transform = s > 0 ? `translateY(${(-lift).toFixed(2)}vh) scale(${grow.toFixed(4)})` : '';
		heroWrap.style.opacity = o.toFixed(3);
		heroWrap.style.visibility = o > 0 ? 'visible' : 'hidden';

		const w = ramp(h, cfg.water.in);
		if (cfg.water.rise) {
			// the water's level: the soft edge travels from below the frame to above it; the canvas itself stays opaque
			const soft = cfg.water.soft, level = (1 + soft) - w * (1 + 2 * soft);   // top of the edge, in viewport heights from the top
			const mask = w <= 0 ? 'linear-gradient(to bottom, transparent 0%, transparent 100%)' : w >= 1 ? 'none' : `linear-gradient(to bottom, transparent ${(level * 100).toFixed(1)}%, #000 ${((level + soft) * 100).toFixed(1)}%)`;
			waterCanvas.style.webkitMaskImage = mask; waterCanvas.style.maskImage = mask;
			waterCanvas.style.opacity = w.toFixed(3);   // and the film itself comes from 0 to 100% as its level rises
		} else waterCanvas.style.opacity = w.toFixed(3);
		waterCanvas.style.visibility = w > 0 ? 'visible' : 'hidden';   // explicit: the CSS default for the water is hidden
		onWater?.(w, P);   // the water's life (caustics, motes, bubbles) follows the water's presence and the depth
		if (endEl && cfg.end) endEl.style.opacity = ramp(P, cfg.end).toFixed(3);   // the end: to the plain dark ground

		if (cloudCanvas) { const c = 1 - ramp(h, cfg.clouds.out); cloudCanvas.style.opacity = c.toFixed(3); cloudCanvas.style.visibility = c > 0 ? 'visible' : 'hidden'; }
		last = P;
	}

	const onScroll = () => apply(progress());
	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('resize', onScroll);
	window.addEventListener('load', onScroll);
	window.addEventListener('pageshow', onScroll);
	apply(progress());

	// the clouds come up later than the films (a glb to load): they join when ready
	const setClouds = (c) => { cloudsRef = c; apply(progress()); };
	return { cfg, apply, setClouds, get progress() { return last; } };
}
