/*
 * sonar.js — a sonar scan in the deep: concentric arcs with tick marks, a ping expanding from one point.
 *
 * After the reference Alex brought (19 Sep): thin arcs radiating from the diver, ticks along them, the
 * whole thing barely there — an instrument reading the dark. Ours: `rings` still arcs around `origin`
 * (of the frame), each with ticks every `tick` degrees; every `every` seconds a PING — one bright arc
 * expands from the origin over `life` seconds and fades, waking the still rings it passes. Only in the
 * water, and only once we are deep (depth window), leaning a little with the cursor.
 */

export const SONAR = {
	enabled: true,
	origin: [0.84, 0.30],           // of the frame — where the diver would be
	rings: 9, spacing: 0.11,        // count, and the gap between them in viewport heights
	arc: [95, 265],                 // degrees (0 = right, 90 = down): the arcs sweep left and down from the diver, toward the wall — as in the reference
	tick: 6,                        // degrees between ticks
	line: 1, alpha: 0.2,           // px, and the still rings' opacity at full presence
	ping: { every: 5.5, life: 3.2, alpha: 0.55, width: 1.6 },
	depth: [0.70, 0.86],            // page progress: the scan fades in with the depth
	parallax: 14,                   // px lean with the cursor
	color: '186, 216, 255',
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const DEG = Math.PI / 180;

export function createSonar({ canvas, cfg = SONAR }) {
	const ctx = canvas.getContext('2d');
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	let W = 0, H = 0, dpr = 1, on = 0, depth = 0;
	function resize() {
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		W = innerWidth; H = innerHeight;
		canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
		canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
	}
	addEventListener('resize', resize); resize();

	const mouse = { x: 0, y: 0 }, lean = { x: 0, y: 0 };
	addEventListener('pointermove', (e) => { mouse.x = (e.clientX / W) * 2 - 1; mouse.y = (e.clientY / H) * 2 - 1; }, { passive: true });

	let last = performance.now(), t = 0, nextPing = 1.5;
	const pings = [];
	function arc(cx, cy, r, a0, a1, width, alpha, ticks) {
		ctx.lineWidth = width; ctx.strokeStyle = `rgba(${cfg.color}, ${alpha.toFixed(3)})`;
		ctx.beginPath(); ctx.arc(cx, cy, r, a0 * DEG, a1 * DEG); ctx.stroke();
		if (ticks) {
			ctx.beginPath();
			for (let a = a0; a <= a1; a += cfg.tick) { const ca = Math.cos(a * DEG), sa = Math.sin(a * DEG); ctx.moveTo(cx + ca * (r - 3), cy + sa * (r - 3)); ctx.lineTo(cx + ca * (r + 3), cy + sa * (r + 3)); }
			ctx.stroke();
		}
	}
	function frame(now) {
		const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
		lean.x += (mouse.x - lean.x) * Math.min(1, dt * 2); lean.y += (mouse.y - lean.y) * Math.min(1, dt * 2);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
		const deep = smooth((depth - cfg.depth[0]) / (cfg.depth[1] - cfg.depth[0]));
		const k = cfg.enabled ? on * deep : 0;
		if (k > 0.005) {
			const cx = cfg.origin[0] * W + lean.x * cfg.parallax, cy = cfg.origin[1] * H + lean.y * cfg.parallax * 0.6;
			const step = cfg.spacing * H;
			if (!reduced && t > nextPing) { pings.push({ born: t }); nextPing = t + cfg.ping.every; }
			// the still rings, each woken a little by a ping passing
			for (let i = 1; i <= cfg.rings; i++) {
				const r = i * step;
				let wake = 0;
				for (const p of pings) { const pr = ((t - p.born) / cfg.ping.life) * (cfg.rings + 1) * step; wake = Math.max(wake, Math.exp(-Math.pow((pr - r) / (step * 0.6), 2))); }
				arc(cx, cy, r, cfg.arc[0], cfg.arc[1], cfg.line, k * (cfg.alpha + wake * 0.35) * (1 - i / (cfg.rings + 2)), i % 2 === 1);
			}
			// the pings
			for (let i = pings.length - 1; i >= 0; i--) {
				const p = pings[i], age = (t - p.born) / cfg.ping.life;
				if (age >= 1) { pings.splice(i, 1); continue; }
				const r = age * (cfg.rings + 1) * step;
				arc(cx, cy, r, cfg.arc[0] - 6, cfg.arc[1] + 6, cfg.ping.width, k * cfg.ping.alpha * (1 - age) * (1 - age), false);
			}
			// the origin: a small mark
			ctx.fillStyle = `rgba(${cfg.color}, ${(k * 0.7).toFixed(3)})`; ctx.beginPath(); ctx.arc(cx, cy, 2.2, 0, Math.PI * 2); ctx.fill();
		}
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
	return { cfg, setPresence(p, P) { on = clamp(p, 0, 1); depth = P; } };
}
