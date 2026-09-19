/*
 * water-ripple.js — the water answers the cursor: a small refraction that follows the mouse, under
 * the water only, and only just (Alex, 18 Sep: "чуть-чуть").
 *
 * An SVG filter on the water film's canvas: fractal noise is let through a soft round window that
 * sits where the cursor is (eased), everywhere else the map is neutral grey; feDisplacementMap then
 * bends the picture inside the window by a few pixels. The window breathes with the cursor's speed —
 * a still cursor barely shows, a move wakes a soft lens that settles again in about a second. The
 * noise itself drifts slowly, so even a still lens is water, not glass.
 *
 * Desktop only (a fine pointer that can hover); off under reduced motion; idle → the filter is
 * removed entirely so the film costs nothing extra.
 */

export const WATER_RIPPLE = {
	enabled: true,
	radius: 220,             // px: the lens
	scale: [1.5, 7],         // px of displacement: at rest, and at full speed
	speedFull: 900,          // px/s of cursor speed that reads as "full"
	ease: 3.0,               // how fast the lens follows the cursor (higher = tighter)
	settle: 1.4,             // seconds for the wake to die down
	noise: { frequency: 0.011, octaves: 2, drift: 6 },   // drift: px/s the noise field moves
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createWaterRipple({ target, cfg = WATER_RIPPLE }) {
	const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (!cfg.enabled || !fine || reduced || !target) return { setPresence() {} };

	// the lens window: a soft disc, drawn once
	const R = cfg.radius;
	const disc = document.createElement('canvas'); disc.width = disc.height = 256;
	{ const x = disc.getContext('2d'); const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }

	const NS = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(NS, 'svg');
	svg.setAttribute('aria-hidden', 'true');
	svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
	svg.innerHTML = `
		<filter id="water-ripple" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
			<feTurbulence type="fractalNoise" baseFrequency="${cfg.noise.frequency}" numOctaves="${cfg.noise.octaves}" seed="7" result="noise"/>
			<feOffset in="noise" dx="0" dy="0" result="drift"/>
			<feImage href="${disc.toDataURL()}" x="0" y="0" width="${R * 2}" height="${R * 2}" preserveAspectRatio="none" result="window"/>
			<feComposite in="drift" in2="window" operator="in" result="local"/>
			<feFlood flood-color="#808080" result="neutral"/>
			<feComposite in="local" in2="neutral" operator="over" result="map"/>
			<feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G"/>
		</filter>`;
	document.body.appendChild(svg);
	const win = svg.querySelector('feImage'), off = svg.querySelector('feOffset'), disp = svg.querySelector('feDisplacementMap');

	const mouse = { x: innerWidth / 2, y: innerHeight / 2 }, lens = { x: innerWidth / 2, y: innerHeight / 2 };
	let speed = 0, lastMove = performance.now(), lastPos = null, presence = 0, applied = false;
	window.addEventListener('pointermove', (e) => {
		const now = performance.now();
		if (lastPos) { const dt = Math.max(0.008, (now - lastMove) / 1000); speed = Math.min(cfg.speedFull * 2, Math.hypot(e.clientX - lastPos.x, e.clientY - lastPos.y) / dt); }
		lastPos = { x: e.clientX, y: e.clientY }; lastMove = now;
		mouse.x = e.clientX; mouse.y = e.clientY;
	}, { passive: true });

	let last = performance.now(), t = 0, wake = 0;
	function frame(now) {
		const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
		lens.x += (mouse.x - lens.x) * Math.min(1, dt * cfg.ease);
		lens.y += (mouse.y - lens.y) * Math.min(1, dt * cfg.ease);
		// the wake: rises with speed, dies down over `settle`
		wake = Math.max(wake * Math.pow(0.05, dt / cfg.settle), clamp(speed / cfg.speedFull, 0, 1));
		speed *= Math.pow(0.02, dt);   // no move → the speed reading decays
		const on = presence > 0.02;
		if (on) {
			if (!applied) { target.style.filter = 'url(#water-ripple)'; applied = true; }
			const s = (cfg.scale[0] + (cfg.scale[1] - cfg.scale[0]) * wake) * presence;
			disp.setAttribute('scale', s.toFixed(2));
			win.setAttribute('x', (lens.x - R).toFixed(1)); win.setAttribute('y', (lens.y - R).toFixed(1));
			off.setAttribute('dx', (t * cfg.noise.drift).toFixed(1)); off.setAttribute('dy', (-t * cfg.noise.drift * 0.6).toFixed(1));
		} else if (applied) { target.style.filter = ''; applied = false; }
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);

	return { cfg, setPresence(p) { presence = clamp(p, 0, 1); } };
}
