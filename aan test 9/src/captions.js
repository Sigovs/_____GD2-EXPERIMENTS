/*
 * captions.js — text blocks that arrive with the scroll, over the mountain and under the water.
 *
 * Each block owns a window of the page's progress [from, to]. The scroll decides WHEN: entering the
 * window brings the block in, leaving it takes the block out (in either direction). The motion
 * itself runs on a clock, not on the scroll position — so a flick of the wheel still gives every
 * word its 800 ms: it rises out of a soft blur, word after word, the eyebrow first. Under the water
 * the block leaves downward, sinking; in the air it lifts away.
 *
 *   block = { at: [from, to], side: 'left' | 'right', y: '50%', eyebrow, lines: [...], world: 'air' | 'water' }
 *
 * The statement (.hero, the page's opening line) is not a block: it is already on the page for the
 * intro (intro.js lifts its letters); this module only takes it out as the scroll begins, the same
 * soft way.
 *
 * COPY IS PLACEHOLDER — the client's lines go in CAPTIONS.blocks.
 */

export const CAPTIONS = {
	statementOut: 0.05,                  // the opening statement leaves when the page passes this progress
	motion: {
		in:  { duration: 900, stagger: 70, rise: 0.7, blur: 10 },    // ms per word, ms between words, em, px
		out: { duration: 620, stagger: 40, drop: 0.45, blur: 6 },
		ease: 'cubic-bezier(0.16, 1, 0.3, 1)',                     // out-expo: fast off the mark, long soft landing
		easeOut: 'cubic-bezier(0.7, 0, 0.84, 0)',                  // in-expo: a gentle start, gone quickly
	},
	blocks: [
		// ACT I — the mountain (the hero scrubs to 0.56 of the page; the tent holds from ~0.44)
		{ at: [0.10, 0.22], side: 'left',  y: '58%', eyebrow: '01 — Ascent',    lines: ['Every summit starts', 'with a decision.'], world: 'air' },
		{ at: [0.26, 0.38], side: 'right', y: '46%', eyebrow: '02 — Route',     lines: ['We map the route', 'before the first step.'], world: 'air' },
		{ at: [0.42, 0.485], side: 'left',  y: '40%', eyebrow: '03 — Base camp', lines: ['Where the plan', 'meets the night.'], world: 'air' },
		// ACT II — the water (from ~0.56)
		{ at: [0.60, 0.70], side: 'right', y: '54%', eyebrow: '04 — Descent',   lines: ['Below the surface', 'the real work begins.'], world: 'water' },
		{ at: [0.74, 0.84], side: 'left',  y: '50%', eyebrow: '05 — Pressure',  lines: ['Compliance is not a cage.', 'It is a map of the pressure.'], world: 'water' },
		{ at: [0.88, 0.99], side: 'left',  y: '50%', eyebrow: 'GD2',            lines: ['The deeper you go,', 'the more you know.'], world: 'water', closing: true, cta: { label: 'Start the descent', href: '#main' } },
	],
};

import { sceneProgress } from './progress.js?v=2026-09-18v';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createCaptions({ root = document.body, hero = document.querySelector('.hero'), cfg = CAPTIONS } = {}) {
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const M = cfg.motion;
	const host = document.createElement('div');
	host.className = 'captions';
	host.setAttribute('aria-hidden', 'true');
	root.appendChild(host);

	// every word is its own span, so the arrival can be staggered word by word
	const words = (line) => line.split(' ').map((w) => `<span class="caption__word">${w}</span>`).join(' ');
	const blocks = cfg.blocks.map((b) => {
		const el = document.createElement('div');
		el.className = `caption caption--${b.side} caption--${b.world}${b.closing ? ' caption--closing' : ''}`;
		el.style.setProperty('--y', b.y);
		el.innerHTML = `<div class="caption__eyebrow"><span class="caption__word">${b.eyebrow}</span></div>` + b.lines.map((l) => `<div class="caption__line">${words(l)}</div>`).join('')
			+ (b.cta ? `<div class="caption__cta"><a class="cta cta--ghost caption__word" href="${b.cta.href}">${b.cta.label}</a></div>` : '');
		host.appendChild(el);
		const parts = [...el.querySelectorAll('.caption__word')];
		parts.forEach((p) => { p.style.opacity = '0'; });
		return { cfg: b, el, parts, shown: false, anims: [] };
	});

	function stop(b) { b.anims.forEach((a) => a.cancel()); b.anims = []; }
	function show(b) {
		if (b.shown) return; b.shown = true; stop(b);
		b.el.style.visibility = 'visible';
		b.parts.forEach((p, i) => {
			if (reduced) { p.style.opacity = '1'; p.style.transform = ''; p.style.filter = ''; return; }
			const a = p.animate(
				[{ opacity: 0, transform: `translateY(${M.in.rise}em)`, filter: `blur(${M.in.blur}px)` }, { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' }],
				{ duration: M.in.duration, delay: i * M.in.stagger, easing: M.ease, fill: 'both' });
			b.anims.push(a);
		});
	}
	function hide(b) {
		if (!b.shown) return; b.shown = false; stop(b);
		const sink = b.cfg.world === 'water' ? 1 : -1;   // under the water the words sink; in the air they lift away
		let lastAnim = null;
		b.parts.forEach((p, i) => {
			if (reduced) { p.style.opacity = '0'; return; }
			const a = p.animate(
				[{ opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' }, { opacity: 0, transform: `translateY(${M.out.drop * sink}em)`, filter: `blur(${M.out.blur}px)` }],
				{ duration: M.out.duration, delay: i * M.out.stagger, easing: M.easeOut, fill: 'both' });
			b.anims.push(a); lastAnim = a;
		});
		const done = () => { if (!b.shown) b.el.style.visibility = 'hidden'; };
		if (lastAnim) lastAnim.finished.then(done).catch(() => {}); else done();
	}

	// the statement: the same soft leaving, once, when the scroll passes its mark; back in if the scroll returns
	let statementShown = true, statementAnim = null;
	function statement(P) {
		if (!hero) return;
		const want = P < cfg.statementOut;
		if (want === statementShown) return;
		statementShown = want;
		statementAnim?.cancel();
		if (reduced) { hero.style.opacity = want ? '1' : '0'; return; }
		const from = { opacity: want ? 0 : 1, transform: `translateY(calc(-50% - ${want ? 6 : 0}vh))`, filter: want ? 'blur(8px)' : 'blur(0px)' };
		const to   = { opacity: want ? 1 : 0, transform: `translateY(calc(-50% - ${want ? 0 : 6}vh))`, filter: want ? 'blur(0px)' : 'blur(8px)' };
		statementAnim = hero.animate([from, to], { duration: want ? 900 : 700, easing: want ? M.ease : M.easeOut, fill: 'both' });
	}

	function apply(P) {
		statement(P);
		for (const b of blocks) {
			const [a, z] = b.cfg.at;
			if (P >= a && P <= z) show(b); else hide(b);
		}
	}

	const progress = sceneProgress;
	const onScroll = () => apply(progress());
	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('resize', onScroll);
	window.addEventListener('load', onScroll);
	apply(progress());
	return { apply, blocks, cfg };
}
