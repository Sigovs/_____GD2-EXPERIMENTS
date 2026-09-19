/*
 * hero-scrub.js — the scroll IS the transport of one film.
 *
 * The video never plays on its own: `currentTime` is a pure function of the scroll,
 * smoothed so a flick of the wheel reads as a camera move rather than a jump. Muted,
 * inline, decoded up front. Under `prefers-reduced-motion` the film holds one frame.
 *
 * Nothing else is animated here — one scene, one idea.
 */

const cfg = {
	damp: 9,              // how fast the film follows the scroll (higher = tighter)
	fadeTitle: [0.45, 0.56],   // the statement stays for the whole hero scroll (Alex, 18 Sep); it leaves only after filmEnd, with the water
	endHold: 0.04,        // fraction of the track kept as a hold on the last frame
};

const video = document.getElementById('hero-video');
const hero = document.querySelector('.hero');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

let duration = 0;
let target = 0;      // where the scroll says the film should be (seconds)
let current = 0;     // where it actually is (seconds), damped
let seeking = false;
let raf = 0;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (v, a, b) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function scrollProgress() {
	const max = document.documentElement.scrollHeight - window.innerHeight;
	return max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
}

function apply(p) {
	// the statement holds while the film scrubs; it leaves with the film, when the water comes
	if (hero) {
		const out = smoothstep(p, cfg.fadeTitle[0], cfg.fadeTitle[1]);
		hero.style.opacity = (1 - out).toFixed(3);
		hero.style.transform = `translateY(calc(-50% - ${(out * 6).toFixed(2)}vh))`;
	}
	const usable = 1 - cfg.endHold;
	target = clamp(p / usable, 0, 1) * duration;
}

function frame() {
	raf = 0;
	if (!duration) return;
	const d = target - current;
	if (Math.abs(d) < 0.004) { current = target; }
	else {
		current += d * Math.min(1, cfg.damp / 60);   // frame-rate independent enough at 60/120 Hz
		schedule();
	}
	if (!seeking && Math.abs(video.currentTime - current) > 0.012) {
		seeking = true;
		video.currentTime = current;
	}
}
function schedule() { if (!raf) raf = requestAnimationFrame(frame); }

video.addEventListener('seeked', () => { seeking = false; });

function onMetadata() {
	duration = video.duration || 0;
	if (reduced.matches) {
		// one frame, no transport: the picture the page opens on
		video.currentTime = duration * 0.25;
	} else {
		apply(scrollProgress());
		current = target;
		video.currentTime = current;
	}
	document.body.classList.add('is-ready');
	document.body.dispatchEvent(new Event('ready'));
}
// decode ahead: a muted play/pause primes the pipeline so the first scrub is not a stutter
function prime() { video.play().then(() => video.pause()).catch(() => {}); }

// This module runs after parsing, and the film is `preload="auto"`: on a cached or local load
// its metadata is already in before we can listen, and the events never come. Check first.
if (video.readyState >= 1) onMetadata(); else video.addEventListener('loadedmetadata', onMetadata, { once: true });
if (video.readyState >= 3) prime(); else video.addEventListener('canplay', prime, { once: true });

if (!reduced.matches) {
	const onScroll = () => { apply(scrollProgress()); schedule(); };
	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('resize', onScroll);
	// a reload mid-page: the browser restores the scroll position after we first read it, without a scroll event
	window.addEventListener('load', onScroll);
	window.addEventListener('pageshow', onScroll);
}

export {};
