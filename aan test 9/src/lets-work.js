/*
 * lets-work.js — the call's two states (index.html: #work, styles in hero.css).
 *
 *   rest  → click the statement/ring → .is-clicked (the rest leaves, the ring blows out, the arrow flies)
 *         → 500 ms later .is-talk (the second state comes up: "Let's talk", the Book a call pill)
 *
 * After the "lets-work-section" React component Alex brought (20 Sep), rebuilt in the page's own language.
 */
export function initLetsWork(section) {
	if (!section) return;
	const trigger = section.querySelector('.work__trigger'), talk = section.querySelector('.work__talk'), book = section.querySelector('.work__book');
	trigger.addEventListener('click', (e) => {
		if (section.classList.contains('is-clicked')) return;
		section.classList.add('is-clicked');
		const byKeyboard = e.detail === 0;   // focus follows only a keyboard activation — a mouse click must not paint a focus ring on the pill
		setTimeout(() => { section.classList.add('is-talk'); talk.setAttribute('aria-hidden', 'false'); book.removeAttribute('tabindex'); if (byKeyboard) book.focus({ preventScroll: true }); }, 500);
	});
}
