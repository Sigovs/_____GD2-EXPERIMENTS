/*
 * sonar.js — a sonar scan in the deep: nested ISOLINES around one point, a ping travelling outward through them.
 *
 * After the reference Alex brought (19 Sep): thin arcs radiating from the diver, ticks along them, the
 * whole thing barely there — an instrument reading the dark. Ours: `rings` still arcs around `origin`
 * (of the frame), each with ticks every `tick` degrees; every `every` seconds a PING — one bright arc
 * expands from the origin over `life` seconds and fades, waking the still rings it passes. Only in the
 * water, and only once we are deep (depth window), leaning a little with the cursor.
 */

export const SONAR = {
	enabled: true,
	origin: [0.52, 0.56],           // of the frame — the contours' centre
	rings: 6, spacing: 0.15,        // count, and the gap between them in viewport heights
	wobble: { lobes: 3.3, depth: 0.36, fine: 7, fineDepth: 0.035, drift: 0.05 },   // the contours are not circles: low lobes + a fine ripple, both drifting slowly (rad/s)
	stretch: 1.25,                  // wider than tall — the frame's shape
	line: 1, alpha: 0.28,           // px, and the still contours' opacity at full presence
	ping: { every: 6, life: 4, alpha: 0.6, width: 1.4 },
	depth: [0.70, 0.86],            // page progress: the scan fades in with the depth
	parallax: 14,                   // px lean with the cursor
	color: '196, 222, 255',
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
	// a contour: a closed loop around (cx, cy) whose radius wobbles with the angle — isolines, not circles
	function contour(cx, cy, r, width, alpha, seed, tt) {
		const w = cfg.wobble;
		ctx.lineWidth = width; ctx.strokeStyle = `rgba(${cfg.color}, ${alpha.toFixed(3)})`;
		ctx.beginPath();
		const N = 160;
		for (let i = 0; i <= N; i++) {
			const a = (i / N) * Math.PI * 2;
			const lobe = Math.sin(a * w.lobes + seed * 1.7 + tt * w.drift) * 0.6 + Math.sin(a * (w.lobes + 1.7) - seed * 2.3 - tt * w.drift * 0.7) * 0.4;
			const fine = Math.sin(a * w.fine + seed * 5.1 + tt * w.drift * 1.6) * Math.sin(a * 2.1 + seed);
			const rr = r * (1 + lobe * w.depth + fine * w.fineDepth);
			const x = cx + Math.cos(a) * rr * cfg.stretch, y = cy + Math.sin(a) * rr;
			i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
		}
		ctx.closePath(); ctx.stroke();
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
			// the still contours, each woken a little by a ping passing through
			for (let i = 1; i <= cfg.rings; i++) {
				const r = i * step;
				let wake = 0;
				for (const p of pings) { const pr = ((t - p.born) / cfg.ping.life) * (cfg.rings + 1) * step; wake = Math.max(wake, Math.exp(-Math.pow((pr - r) / (step * 0.6), 2))); }
				contour(cx, cy, r, cfg.line, k * (cfg.alpha + wake * 0.4) * (1 - i / (cfg.rings + 3)), i, t);
			}
			// the pings: one contour travelling outward, its shape morphing between the still ones
			for (let i = pings.length - 1; i >= 0; i--) {
				const p = pings[i], age = (t - p.born) / cfg.ping.life;
				if (age >= 1) { pings.splice(i, 1); continue; }
				const r = age * (cfg.rings + 1) * step;
				contour(cx, cy, r, cfg.ping.width, k * cfg.ping.alpha * (1 - age) * (1 - age), r / step, t);
			}
			// the origin: a small mark
			ctx.fillStyle = `rgba(${cfg.color}, ${(k * 0.5).toFixed(3)})`; ctx.beginPath(); ctx.arc(cx, cy, 1.8, 0, Math.PI * 2); ctx.fill();
		}
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
	return { cfg, setPresence(p, P) { on = clamp(p, 0, 1); depth = P; } };
}
