/*
 * nav.js — the full-screen navigation (nav.css): open / close, the wipe, the reveal, the trap.
 *
 *   open   the panel wipes in from the right over --nav-wipe (clip-path, WAAPI); then the head,
 *          the links (staggered 70 ms), the images (scale 0.8 → 1) reveal in sequence
 *   close  the content sinks (scale 0.9, half opacity) while the panel wipes out to the left
 *   keys   Escape closes; Tab is kept inside the panel; focus returns to the toggle
 *   scroll the page is locked while open; hero-scrub.js sees no scroll, so the film holds
 *   reduced motion: the wipe is a 200 ms fade, the reveals are instant
 */

const CLIP = {
	closedInitial: 'polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%)',   // a sliver at the right edge
	open: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
	closedFinal: 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)',             // gone out the left edge
};
const EASE = 'cubic-bezier(0.77, 0, 0.175, 1)';
const OUT = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function initNav({ wipe = 1000 } = {}) {
	const nav = document.querySelector('.nav');
	const toggle = nav?.querySelector('.nav__toggle');
	const panel = document.querySelector('.nav__panel');
	const inner = panel?.querySelector('.nav__inner');
	if (!nav || !toggle || !panel || !inner) return null;
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const reveals = [...panel.querySelectorAll('[data-reveal]')];
	const links = [...panel.querySelectorAll('.nav__link')];

	// the per-character hover: each link's text becomes a run of characters with a stagger index
	if (!reduced) for (const a of links) {
		const label = a.textContent.trim();
		a.setAttribute('aria-label', label);
		const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
		[...label].forEach((ch, i) => { const c = document.createElement('span'); c.className = 'c'; c.style.setProperty('--i', i); c.textContent = ch; w.appendChild(c); });
		a.textContent = ''; a.appendChild(w);
	}

	let open = false, moving = false, previous = null;
	const setLinksTabbable = (on) => { for (const el of panel.querySelectorAll(FOCUSABLE)) el.tabIndex = on ? 0 : -1; };
	setLinksTabbable(false);

	function revealIn() {
		const t0 = Math.max(0, wipe - 200);
		for (const el of reveals) {
			const kind = el.dataset.reveal, i = +(el.dataset.i || 0);
			el.getAnimations().forEach((a) => a.cancel());
			if (reduced) { el.style.opacity = '1'; el.style.transform = ''; continue; }
			const from = kind === 'image' ? { opacity: 0, transform: 'scale(0.8)' } : kind === 'link' ? { opacity: 0, transform: 'translateY(30px)' } : { opacity: 0, transform: 'translateY(-12px)' };
			const delay = t0 + (kind === 'link' ? i * 70 : kind === 'image' ? 100 + i * 20 : i * 80);
			const dur = kind === 'image' ? 900 : kind === 'link' ? 800 : 600;
			el.animate([from, { opacity: 1, transform: 'none' }], { duration: dur, delay, easing: OUT, fill: 'both' });
		}
	}
	function revealReset() { for (const el of reveals) { el.getAnimations().forEach((a) => a.cancel()); el.style.opacity = ''; el.style.transform = ''; } }

	async function openMenu() {
		if (moving) return; moving = true; open = true;
		previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		nav.classList.add('is-open'); panel.classList.add('is-moving');
		toggle.setAttribute('aria-expanded', 'true'); panel.setAttribute('aria-hidden', 'false');
		document.body.style.overflow = 'hidden';
		inner.getAnimations().forEach((a) => a.cancel()); inner.style.transform = ''; inner.style.opacity = '';
		if (reduced) {
			panel.style.clipPath = CLIP.open;
			await panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: OUT, fill: 'both' }).finished;
		} else {
			panel.style.clipPath = CLIP.closedInitial;
			revealIn();
			await panel.animate([{ clipPath: CLIP.closedInitial }, { clipPath: CLIP.open }], { duration: wipe, delay: 200, easing: EASE, fill: 'both' }).finished;
		}
		panel.style.clipPath = CLIP.open; panel.getAnimations().forEach((a) => a.cancel());
		if (reduced) revealIn();
		panel.classList.add('is-open'); panel.classList.remove('is-moving');
		setLinksTabbable(true);
		moving = false;
		// focus lands on the panel itself (the trap keeps Tab inside); a keyboard user's next Tab reaches the first link
		panel.tabIndex = -1;
		requestAnimationFrame(() => panel.focus({ preventScroll: true }));
	}
	async function closeMenu() {
		if (moving || !open) return; moving = true; open = false;
		nav.classList.remove('is-open'); panel.classList.remove('is-open'); panel.classList.add('is-moving');
		toggle.setAttribute('aria-expanded', 'false'); panel.setAttribute('aria-hidden', 'true');
		setLinksTabbable(false);
		if (reduced) {
			await panel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: OUT, fill: 'both' }).finished;
		} else {
			inner.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.9)', opacity: 0.5 }], { duration: 700, easing: 'cubic-bezier(0.55, 0, 1, 0.45)', fill: 'both' });
			await panel.animate([{ clipPath: CLIP.open }, { clipPath: CLIP.closedFinal }], { duration: wipe, easing: EASE, fill: 'both' }).finished;
		}
		panel.getAnimations().forEach((a) => a.cancel()); panel.style.clipPath = CLIP.closedInitial;
		inner.getAnimations().forEach((a) => a.cancel());
		revealReset();
		panel.classList.remove('is-moving');
		document.body.style.overflow = '';
		moving = false;
		if (previous && document.contains(previous)) previous.focus(); else toggle.focus();
	}

	toggle.addEventListener('click', () => (open ? closeMenu() : openMenu()));
	for (const a of links) a.addEventListener('click', () => { if (open) closeMenu(); });
	document.addEventListener('keydown', (e) => {
		if (!open) return;
		if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
		if (e.key !== 'Tab') return;
		const items = [...panel.querySelectorAll(FOCUSABLE), toggle].filter((el) => el.getClientRects().length);
		if (!items.length) return;
		const first = items[0], last = items[items.length - 1], active = document.activeElement;
		if (e.shiftKey ? (active === first || !panel.contains(active) && active !== toggle) : (active === last)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
	});

	return { open: openMenu, close: closeMenu, get isOpen() { return open; } };
}
