/*
 * slide-in.js — the closing chapters slide in as they arrive, EVERY time (Alex, 20 Sep): .is-in goes on when a
 * chapter has a third of itself on screen and comes off when it leaves, so the move replays on the way back too.
 * The move itself is CSS (hero.css: the chapter's __inner rises 56 px and fades in). Snap is CSS too.
 */
export function initSlideIn(sections) {
	const els = [...sections].filter(Boolean);
	if (!els.length || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
	const io = new IntersectionObserver((entries) => {
		for (const e of entries) e.target.classList.toggle('is-in', e.isIntersecting);
	}, { threshold: 0.3 });
	els.forEach((el) => io.observe(el));
}
