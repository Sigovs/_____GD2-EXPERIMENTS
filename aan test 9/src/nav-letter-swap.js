/*
 * nav-letter-swap.js — "random letter swap" hover on the primary navigation
 * (after the RandomLetterSwap component: on hover every letter of the label
 * rolls up and its twin rolls in from below, the letters in a random order with
 * a small stagger, a springy ease; on leave they roll back in a new random order).
 *
 * Markup stays real text for assistive tech: the link keeps its label as
 * aria-label, the letter spans are aria-hidden. Styles: nav.css (.ls).
 */

export const LETTER_SWAP = {
	staggerS: 0.025,     // per letter
	durationS: 0.6,      // one letter's roll
	ease: 'cubic-bezier(0.34, 1.4, 0.64, 1)',   // a spring: a little overshoot, then settles
};

export function initLetterSwap(root = document) {
	const links = root.querySelectorAll('.nav a');
	links.forEach((a) => {
		const text = a.textContent.trim();
		a.setAttribute('aria-label', text);
		a.textContent = '';
		const wrap = document.createElement('span');
		wrap.className = 'ls-word';
		wrap.setAttribute('aria-hidden', 'true');
		const letters = [];
		for (const ch of text) {
			if (ch === ' ') { const sp = document.createElement('span'); sp.className = 'ls-space'; sp.textContent = ' '; wrap.appendChild(sp); continue; }
			const l = document.createElement('span');
			l.className = 'ls';
			l.innerHTML = `<span class="ls__a">${ch}</span><span class="ls__b">${ch}</span>`;
			l.style.transitionDuration = `${LETTER_SWAP.durationS}s`;
			l.style.transitionTimingFunction = LETTER_SWAP.ease;
			wrap.appendChild(l);
			letters.push(l);
		}
		a.appendChild(wrap);

		const shuffle = () => {
			const order = letters.map((_, i) => i);
			for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
			order.forEach((idx, n) => { letters[idx].style.transitionDelay = `${(n * LETTER_SWAP.staggerS).toFixed(3)}s`; });
		};
		const swap = (on) => { shuffle(); a.classList.toggle('is-swapped', on); };
		a.addEventListener('mouseenter', () => swap(true));
		a.addEventListener('mouseleave', () => swap(false));
		a.addEventListener('focus', () => swap(true));
		a.addEventListener('blur', () => swap(false));
	});
}
