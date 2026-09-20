/*
 * route.js — the ROUTE on the still mountain (version 4, Alex, 20 Sep): a line drawn by the scroll from the summit
 * DOWN to the camp ("сверху к лагерю"), waypoints lighting as the head passes them, and the head itself — a small
 * bright point walking the ridge.
 *
 * The line lives in an SVG over the mountain plane, in the frame's own coordinates (viewBox 1920×1080, `slice` — the
 * same cover mapping the film canvas uses), so a point placed on the last frame stays on that rock at every viewport.
 * It copies the mountain plane's transform each frame, so it leans with the mountain under the cursor, not over it.
 *
 * Points come from ROUTE.points (0..1 of the frame) — laid by hand in the editor (?edit=path, src/route-editor.js)
 * and baked here. The curve through them is Catmull-Rom → cubic Béziers.
 */

export const ROUTE = {
	points: [[0.600, 0.205], [0.568, 0.285], [0.522, 0.352], [0.474, 0.435], [0.486, 0.515], [0.515, 0.585]],   // summit → camp (the tent, tent-glow track at frame 240)
	draw: [0.05, 0.46],     // scene progress: the line runs from the summit to the camp across this window
	tension: 0.5,           // Catmull-Rom (0.5 = the classic; lower = straighter)
	width: 2.4,             // px in the frame (1920 wide)
	glow: 10,               // the soft copy under the line
	color: '#eef3fb',
	alpha: 0.9,
	waypoint: 5,            // r of the waypoint marks; they light as the head passes
	head: 6,                // r of the head
	dash: null,             // e.g. [10, 8] for a dashed line; null = solid
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const NS = 'http://www.w3.org/2000/svg';
const W = 1920, H = 1080;

// Catmull-Rom through the points → an SVG path of cubic Béziers
function curve(pts, tension = 0.5) {
	if (pts.length < 2) return '';
	const p = pts.map(([x, y]) => [x * W, y * H]);
	let d = `M ${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
	for (let i = 0; i < p.length - 1; i++) {
		const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
		const c1 = [p1[0] + (p2[0] - p0[0]) * tension / 3, p1[1] + (p2[1] - p0[1]) * tension / 3];
		const c2 = [p2[0] - (p3[0] - p1[0]) * tension / 3, p2[1] - (p3[1] - p1[1]) * tension / 3];
		d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
	}
	return d;
}

export function createRoute({ svg, follow = null, cfg = ROUTE }) {
	const el = (tag, attrs = {}, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.append(e); return e; };
	svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
	svg.innerHTML = '';
	const defs = el('defs');
	const filt = el('filter', { id: 'route-blur', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
	el('feGaussianBlur', { stdDeviation: '4' }, filt);
	const glow = el('path', { fill: 'none', stroke: cfg.color, 'stroke-width': cfg.glow, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '0.28', filter: 'url(#route-blur)', pathLength: '1' });
	const line = el('path', { fill: 'none', stroke: cfg.color, 'stroke-width': cfg.width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: String(cfg.alpha), pathLength: '1' });
	const marks = el('g');
	const head = el('circle', { r: cfg.head, fill: cfg.color, opacity: '0' });
	const headGlow = el('circle', { r: cfg.head * 2.2, fill: cfg.color, opacity: '0', filter: 'url(#route-blur)' });
	svg.insertBefore(headGlow, head);
	const handles = el('g', { class: 'route__handles' });   // the editor draws into this

	let pts = cfg.points.map((p) => [...p]), wp = [], total = 1, t = 0, on = false;
	function build() {
		const d = curve(pts, cfg.tension);
		line.setAttribute('d', d); glow.setAttribute('d', d);
		if (cfg.dash) { line.setAttribute('stroke-dasharray', cfg.dash.join(' ')); } else line.removeAttribute('stroke-dasharray');
		total = line.getTotalLength() || 1;
		// each waypoint's place along the line (the nearest of 400 samples)
		marks.innerHTML = ''; wp = [];
		const samples = Array.from({ length: 401 }, (_, i) => line.getPointAtLength(total * i / 400));
		pts.forEach(([x, y], i) => {
			const px = x * W, py = y * H;
			let best = 0, bd = Infinity;
			samples.forEach((s, k) => { const dd = (s.x - px) ** 2 + (s.y - py) ** 2; if (dd < bd) { bd = dd; best = k; } });
			const c = el('circle', { cx: px, cy: py, r: cfg.waypoint, fill: '#05080f', stroke: cfg.color, 'stroke-width': 1.5, opacity: '0' }, marks);
			wp.push({ u: best / 400, el: c, last: i === pts.length - 1 });
		});
		paint(true);
	}
	function paint(force) {
		const k = on ? t : 0;
		// the line: drawn from the summit by k
		// solid: a dash the length of the drawn part — via pathLength=1 the dasharray is "k 1"
		line.setAttribute('stroke-dasharray', cfg.dash ? cfg.dash.join(' ') : `${k.toFixed(4)} 1`);
		glow.setAttribute('stroke-dasharray', `${k.toFixed(4)} 1`);
		if (cfg.dash) line.setAttribute('stroke-dashoffset', '0');
		// the head
		const p = line.getPointAtLength(total * k);
		head.setAttribute('cx', p.x); head.setAttribute('cy', p.y); headGlow.setAttribute('cx', p.x); headGlow.setAttribute('cy', p.y);
		const headOn = on && k > 0.002 && k < 0.995 ? 1 : 0;
		head.setAttribute('opacity', String(headOn)); headGlow.setAttribute('opacity', String(headOn * 0.5));
		// the waypoints light as the head passes
		wp.forEach((w) => { const lit = on && k >= w.u - 0.002; w.el.setAttribute('opacity', lit ? '1' : '0'); w.el.setAttribute('r', lit && w.last && k > 0.99 ? cfg.waypoint * 1.6 : cfg.waypoint); });
	}
	function frame() {
		if (follow) svg.style.transform = follow.style.transform || '';   // lean with the mountain plane
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
	build();

	return {
		cfg, svg, handles,
		get points() { return pts; },
		setPoints(p) { pts = p.map((q) => [...q]); cfg.points = pts; build(); },
		setProgress(P) { const nt = smooth((P - cfg.draw[0]) / (cfg.draw[1] - cfg.draw[0])); if (nt !== t) { t = nt; paint(); } },
		setOn(v) { on = !!v; svg.classList.toggle('is-on', on); paint(); },
		get t() { return t; },
		rebuild: build,
	};
}
