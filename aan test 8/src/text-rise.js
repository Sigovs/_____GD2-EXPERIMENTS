/*
 * text-rise.js — the statement's letters: the entrance, and the rotating word.
 *
 * After the "text-rotate" component (React + motion), done natively:
 *   • enter: y 100 % → 0 on a spring (stiffness 300, damping 25), staggered per character
 *   • exit:  y 0 → −120 %, opacity → 0, the same spring, staggered from the LAST character
 *   • mode "wait": the old word leaves entirely, then the new one arrives
 *   • the container's width moves to the new word's width (the component's `layout`)
 *
 * splitLines(): wraps each .hero__line's text in per-character spans (Intl.Segmenter, so an
 * emoji or a combined glyph stays one piece); a nested .hero__rotate keeps its own word.
 * riseIn(): the entrance — every letter rises from under its line's mask, the top line first.
 * rotateWord(): cycles the .hero__rotate element through its data-words. Returns a controller
 * (next / stop / start). Under prefers-reduced-motion nothing is split, nothing rotates.
 */

// the spring, sampled into a linear() easing, with a bezier fallback
const SPRING = 'linear(0, 0.19 4.2%, 0.5 9.5%, 0.78 15.2%, 0.96 21%, 1.06 27%, 1.09 32.5%, 1.07 38.5%, 1.03 45%, 1 52%, 0.99 60%, 1 72%, 1)';
const FALLBACK = 'cubic-bezier(0.22, 1, 0.36, 1)';
const supportsLinear = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('animation-timing-function', 'linear(0, 1)');
const EASE = supportsLinear ? SPRING : FALLBACK;

function graphemes(text) {
	if (typeof Intl !== 'undefined' && Intl.Segmenter) return Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text), (s) => s.segment);
	return Array.from(text);
}
function charSpans(text) {
	return graphemes(text).map((c) => {
		const el = document.createElement('span');
		el.className = 'ch' + (c === ' ' ? ' ch--space' : '');
		el.textContent = c;
		return el;
	});
}

export function splitLines(lines) {
	for (const line of lines) {
		if (line.dataset.split) continue;
		// text nodes become characters; a nested .hero__rotate keeps its element and gets its own word inside
		for (const node of [...line.childNodes]) {
			if (node.nodeType === Node.TEXT_NODE) {
				const frag = document.createDocumentFragment();
				for (const el of charSpans(node.textContent)) frag.appendChild(el);
				line.replaceChild(frag, node);
			} else if (node.classList?.contains('hero__rotate')) {
				const word = document.createElement('span');
				word.className = 'hero__word';
				for (const el of charSpans(node.textContent.trim())) word.appendChild(el);
				node.textContent = '';
				node.appendChild(word);
				node.setAttribute('aria-label', node.dataset.words?.split('|')[0] ?? word.textContent);
			}
		}
		line.dataset.split = '1';
	}
}

export function riseIn(lines, { delay = 0, lineGap = 140, stagger = 24, duration = 640 } = {}) {
	const anims = [];
	lines.forEach((line, li) => {
		[...line.querySelectorAll('.ch')].forEach((ch, ci) => {
			anims.push(ch.animate(
				[{ transform: 'translateY(110%)', opacity: 0.6 }, { transform: 'translateY(0)', opacity: 1 }],
				{ duration, delay: delay + li * lineGap + ci * stagger, easing: EASE, fill: 'both' }));
		});
	});
	return Promise.all(anims.map((a) => a.finished)).then(() => anims);
}

export function rotateWord(host, { interval = 2400, stagger = 25, duration = 520, paused = () => false } = {}) {
	const words = (host?.dataset.words || '').split('|').map((w) => w.trim()).filter(Boolean);
	if (!host || words.length < 2) return null;
	let index = 0, timer = 0, busy = false, running = false;
	host.style.width = host.getBoundingClientRect().width + 'px';   // the layout: the width is owned from here on
	window.addEventListener('resize', () => { if (busy) return; host.style.width = 'auto'; host.style.width = host.getBoundingClientRect().width + 'px'; });   // the type is vw-sized

	async function swap(to) {
		if (busy) return; busy = true;
		const old = host.querySelector('.hero__word');
		const oldChars = old ? [...old.querySelectorAll('.ch')] : [];
		const n = oldChars.length;
		// exit: from the last character
		await Promise.all(oldChars.map((ch, i) => ch.animate(
			[{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-120%)', opacity: 0 }],
			{ duration, delay: (n - 1 - i) * stagger, easing: EASE, fill: 'forwards' }).finished));
		// the new word, measured, then the width follows it
		const word = document.createElement('span');
		word.className = 'hero__word';
		for (const el of charSpans(words[to])) { el.style.transform = 'translateY(100%)'; el.style.opacity = '0'; word.appendChild(el); }
		old?.remove();
		host.appendChild(word);
		host.setAttribute('aria-label', words[to]);
		const from = parseFloat(host.style.width) || host.getBoundingClientRect().width;
		host.style.width = 'auto';
		const target = host.getBoundingClientRect().width;
		host.style.width = from + 'px';
		host.animate([{ width: from + 'px' }, { width: target + 'px' }], { duration: 420, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'forwards' }).finished.then(() => { host.getAnimations().forEach((a) => a.cancel()); host.style.width = target + 'px'; });
		// enter: from the last character
		const chars = [...word.querySelectorAll('.ch')], m = chars.length;
		await Promise.all(chars.map((ch, i) => ch.animate(
			[{ transform: 'translateY(100%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
			{ duration, delay: (m - 1 - i) * stagger, easing: EASE, fill: 'forwards' }).finished));
		for (const ch of chars) { ch.getAnimations().forEach((a) => a.cancel()); ch.style.transform = ''; ch.style.opacity = ''; }
		index = to; busy = false;
	}
	const next = () => swap((index + 1) % words.length);
	function tick() {
		timer = setTimeout(async () => { if (!paused()) await next(); if (running) tick(); }, interval);
	}
	function start() { if (running) return; running = true; tick(); }
	function stop() { running = false; clearTimeout(timer); }
	return { next, start, stop, get index() { return index; } };
}
