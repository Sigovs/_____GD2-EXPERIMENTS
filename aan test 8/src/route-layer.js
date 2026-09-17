import { resolveRoute } from './route-config.js';

/*
 * route-layer.js — the descent route drawn over the film, as an instrument.
 *
 * Geometry  : route-config.js keys → control points for the film's current time (linear
 *             between keys) → Catmull-Rom → dense samples per chain, in screen px (the film
 *             is object-fit: cover, so the mapping follows the video element).
 * Conduit   : Canvas 2D, between the film and the cloud plates. A graphite casing with a
 *             machined highlight on its upper edge, index ticks along it, a sight-glass slot
 *             down the middle, and the fluid inside it — filled to u, the meniscus at its
 *             front, a slow shimmer along the filled length. A collar at every stop.
 * Callouts  : DOM plates in a fixed slot, a two-segment leader (45° then straight) drawn
 *             in one SVG, revealed as the fluid arrives; reversible with the scroll.
 * Clock     : the film's own currentTime (hero-scrub.js damps it), so the route sits on the
 *             frame that is actually showing. prefers-reduced-motion → one still.
 */

const cfg = resolveRoute(new URLSearchParams(location.search).get('path'));   // ?path=conduit|alpine|filament
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t, a, b) => { const k = clamp((t - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const lerp = (a, b, t) => a + (b - a) * t;

/* --------------------------------------------------------------------------- */
/* geometry                                                                    */
/* --------------------------------------------------------------------------- */

const live = { keys: cfg.keys, glowKeys: cfg.glow.keys };   // replaceable at runtime (tools/route-editor)

function keyedPoints(chain, f) {
	const k = live.keys;
	if (f <= k[0].f) return k[0][chain];
	for (let i = 1; i < k.length; i++) if (f <= k[i].f) {
		const a = k[i - 1], b = k[i], t = (f - a.f) / (b.f - a.f);
		return a[chain].map((p, j) => [lerp(p[0], b[chain][j][0], t), lerp(p[1], b[chain][j][1], t)]);
	}
	return k[k.length - 1][chain];
}

/** Per-point alpha for a chain at film time f: keyed alphas interpolated, else the chain's default. */
function keyedAlpha(chain, f) {
	const withA = live.keys.filter((k) => k.alpha && k.alpha[chain]);
	const fallback = cfg.chains[chain].alpha;
	if (!withA.length) return fallback;
	// before the first keyed alpha: the default; between/after: interpolate (the default counts as the value at the last plain key before)
	const first = withA[0];
	if (f <= first.f) {
		const prev = live.keys.filter((k) => k.f < first.f).pop();
		if (!prev) return first.alpha[chain];
		const t = clamp((f - prev.f) / (first.f - prev.f), 0, 1);
		return fallback.map((a, i) => lerp(a, first.alpha[chain][i], t));
	}
	for (let i = 1; i < withA.length; i++) if (f <= withA[i].f) {
		const a = withA[i - 1], b = withA[i], t = (f - a.f) / (b.f - a.f);
		return a.alpha[chain].map((v, j) => lerp(v, b.alpha[chain][j], t));
	}
	return withA[withA.length - 1].alpha[chain];
}

/** Catmull-Rom through pts (already in px); returns samples with x, y, alpha, s (arc length), u. */
function sampleChain(pts, alphas, n, uRange) {
	const P = [pts[0], ...pts, pts[pts.length - 1]];
	const out = [];
	const segs = pts.length - 1;
	for (let i = 0; i < n; i++) {
		const t = i / (n - 1) * segs, si = Math.min(segs - 1, Math.floor(t)), lt = t - si;
		const p0 = P[si], p1 = P[si + 1], p2 = P[si + 2], p3 = P[si + 3];
		const t2 = lt * lt, t3 = t2 * lt;
		const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * lt + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
		const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * lt + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
		out.push({ x, y, alpha: lerp(alphas[si], alphas[si + 1], lt), cp: t });
	}
	let s = 0;
	for (let i = 0; i < out.length; i++) {
		if (i) s += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y);
		out[i].s = s;
	}
	for (const p of out) p.u = lerp(uRange[0], uRange[1], s ? p.s / s : 0);
	return out;
}

/** The film's frame → screen px, for object-fit: cover (the page) or contain (the editor). */
function filmToScreen(video, fit = 'cover', W = window.innerWidth, H = window.innerHeight) {
	const vw = video.videoWidth || 1920, vh = video.videoHeight || 1080;
	const k = fit === 'contain' ? Math.min(W / vw, H / vh) : Math.max(W / vw, H / vh);
	const dw = vw * k, dh = vh * k, ox = (W - dw) / 2, oy = (H - dh) / 2;
	return ([px, py]) => [ox + px / 100 * dw, oy + py / 100 * dh];
}

/* --------------------------------------------------------------------------- */
/* the layer                                                                   */
/* --------------------------------------------------------------------------- */

export function createRouteLayer({ canvas, video, labelRoot, fit = 'cover', size = null }) {
	const ctx = canvas.getContext('2d');
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const st = cfg.style;
	let W = 1, H = 1, dpr = 1;

	/* stops by id, and the u each sits at (resolved once the chains are sampled) */
	const stops = cfg.stops.map((s) => ({ ...s, u: 0, anchor: [0, 0], onScreen: false }));
	const stopById = Object.fromEntries(stops.map((s) => [s.id, s]));

	function resolveU(v) {
		if (typeof v === 'number') return v;
		const m = /^([A-Z_0-9]+)([+-][\d.]+)?$/.exec(v);
		return stopById[m[1]].u + (m[2] ? parseFloat(m[2]) : 0);
	}
	function fillFor(f) {
		const k = cfg.timing;
		if (f <= k[0].f) return resolveU(k[0].u);
		for (let i = 1; i < k.length; i++) if (f <= k[i].f) {
			const a = k[i - 1], b = k[i];
			return lerp(resolveU(a.u), resolveU(b.u), smooth(f, a.f, b.f));
		}
		return resolveU(k[k.length - 1].u);
	}

	/* ---- callouts ---- */
	const svgNS = 'http://www.w3.org/2000/svg';
	const leaders = document.createElementNS(svgNS, 'svg');
	leaders.setAttribute('class', 'route-leaders');
	leaders.setAttribute('aria-hidden', 'true');
	if (cfg.callouts) labelRoot.appendChild(leaders);
	for (const s of stops) {
		if (!cfg.callouts) break;
		const el = document.createElement('div');
		el.className = 'plate';
		el.dataset.stop = s.id;
		el.innerHTML = `<span class="plate__label">${s.label}</span><strong class="plate__title">${s.title}</strong>${s.text ? `<span class="plate__text">${s.text}</span>` : ''}`;
		labelRoot.appendChild(el);
		const path = document.createElementNS(svgNS, 'path');
		path.setAttribute('class', 'route-leaders__line');
		leaders.appendChild(path);
		const dot = document.createElementNS(svgNS, 'rect');
		dot.setAttribute('class', 'route-leaders__anchor');
		dot.setAttribute('width', '5'); dot.setAttribute('height', '5');
		leaders.appendChild(dot);
		s.el = el; s.path = path; s.dot = dot; s.box = null;
	}
	function placePlates() {
		if (!cfg.callouts) return;
		const narrow = W < 700;
		for (const s of stops) {
			const [fx, fy] = narrow ? s.slot.narrow : s.slot.wide;
			const r = s.el.getBoundingClientRect();
			const left = Math.round(clamp(fx * W - r.width / 2, 16, W - r.width - 16));
			const top = Math.round(clamp(fy * H - r.height / 2, 16, H - r.height - 16));
			s.el.style.left = left + 'px'; s.el.style.top = top + 'px';
			s.box = { left, top, right: left + r.width, bottom: top + r.height, cx: left + r.width / 2, cy: top + r.height / 2 };
		}
	}
	function leaderPath(a, box) {
		// the plate's edge nearest the anchor, then a 45° run from the anchor and a straight run into it
		const edges = [[box.left, box.cy], [box.right, box.cy], [box.cx, box.top], [box.cx, box.bottom]];
		let p = edges[0], best = Infinity;
		for (const e of edges) { const d = Math.hypot(e[0] - a[0], e[1] - a[1]); if (d < best) { best = d; p = e; } }
		const dx = p[0] - a[0], dy = p[1] - a[1], m = Math.min(Math.abs(dx), Math.abs(dy));
		const e = [a[0] + Math.sign(dx) * m, a[1] + Math.sign(dy) * m];
		return `M${a[0].toFixed(1)},${a[1].toFixed(1)} L${e[0].toFixed(1)},${e[1].toFixed(1)} L${p[0].toFixed(1)},${p[1].toFixed(1)}`;
	}
	function updateCallouts(fill) {
		for (const s of stops) {
			const wake = smooth(fill, s.u - cfg.stopReveal.before, s.u + cfg.stopReveal.after);
			const on = s.onScreen ? wake : 0;
			s.el.style.opacity = on.toFixed(3);
			s.el.style.transform = `translateY(${((1 - on) * 8).toFixed(1)}px)`;
			s.el.classList.toggle('is-on', on > 0.02);
			if (on > 0.001 && s.box) {
				s.path.setAttribute('d', leaderPath(s.anchor, s.box));
				s.path.style.opacity = on.toFixed(3);
				s.dot.setAttribute('x', (s.anchor[0] - 2.5).toFixed(1)); s.dot.setAttribute('y', (s.anchor[1] - 2.5).toFixed(1));
				s.dot.style.opacity = on.toFixed(3);
			} else { s.path.style.opacity = '0'; s.dot.style.opacity = '0'; }
		}
	}

	/* ---- the conduit ---- */
	function strokeRuns(samples, width, color, pick = () => true, offset = 0, alphaOf = (p) => p.alpha, colorOf = null) {
		// consecutive samples with the same (quantised) alpha — and colour, when it varies — become one path;
		// offset moves the run along the normal
		ctx.lineWidth = width; ctx.strokeStyle = color;
		let run = null, runA = -1, runC = null;
		const flush = () => { if (run && run.length > 1) { ctx.globalAlpha = runA; if (runC) ctx.strokeStyle = runC; ctx.beginPath(); run.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); } run = null; runA = -1; runC = null; };
		for (let i = 0; i < samples.length; i++) {
			const p = samples[i];
			if (!pick(p)) { flush(); continue; }
			const a = Math.round(clamp(alphaOf(p), 0, 1) * 16) / 16;
			if (a <= 0) { flush(); continue; }
			const c = colorOf ? colorOf(p) : null;
			if (a !== runA || c !== runC) {
				flush(); runA = a; runC = c; run = [];
				// a new run starts at the previous sample, so consecutive runs meet without a gap
				if (i > 0 && pick(samples[i - 1])) { const q = samples[i - 1]; run.push(offset ? [q.x + q.nx * offset, q.y + q.ny * offset] : [q.x, q.y]); }
			}
			run.push(offset ? [p.x + p.nx * offset, p.y + p.ny * offset] : [p.x, p.y]);
		}
		flush();
		ctx.globalAlpha = 1;
	}
	/* the fluid's colour: icy cyan, turning warm within the lamp's reach of the tent (screen distance) */
	const CYAN = [0x37, 0xd6, 0xff], WARM = [0xff, 0xa0, 0x3c];
	function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
	let tentPx = null;   // set per frame from the glow keys
	function warmth(p) {
		if (!tentPx) return 0;
		const d = Math.hypot(p.x - tentPx[0], p.y - tentPx[1]);
		return 1 - smooth(d, 0, st.warmRadius * H);
	}
	function coreColor(p) {
		// the bright thread: cyan-white, turning to a warm white by the lamp
		const w = Math.round(warmth(p) * 8) / 8;
		const a = [210, 246, 255], b = [255, 226, 190];
		const c = a.map((v, i) => Math.round(lerp(v, b[i], w)));
		return `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.95)`;
	}
	function fluidColor(p, alphaScale = 1) {
		const w = Math.round(warmth(p) * 8) / 8;   // eight steps: few runs, no visible banding at these widths
		const a = hexRgb(st.fluid), b = hexRgb(st.fluidWarm || st.fluid);
		const c = a.map((v, i) => Math.round(lerp(v, b[i], w)));
		return alphaScale === 1 ? `rgb(${c[0]}, ${c[1]}, ${c[2]})` : `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alphaScale})`;
	}
	function normals(samples) {
		for (let i = 0; i < samples.length; i++) {
			const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
			const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
			// the "upper" side: the normal that points up the screen
			let nx = -ty / l, ny = tx / l; if (ny > 0) { nx = -nx; ny = -ny; }
			samples[i].nx = nx; samples[i].ny = ny; samples[i].tx = tx / l; samples[i].ty = ty / l;
		}
	}
	function drawChain(samples, fill, now, k, chainName, layerAlpha = 1) {
		normals(samples);
		const half = (st.tube * k) / 2;
		const fw = st.fluidWidth * k;
		const filled = (p) => p.u <= fill;
		// the intro draws the empty glass on (reveal 0 → 1 over the route); the fluid is never clipped by it
		const shown = (p) => p.u <= fill ? 1 : smooth(reveal, p.u - 0.03, p.u);
		// atmosphere: the far end (the summit, u 0) sits in more air than the near end
		const range = cfg.chains[chainName].u;
		const air = (p) => chainName === 'ridge' ? 1 - st.atmosphere * 0.6 * (1 - (p.u - range[0]) / (range[1] - range[0])) : 1;
		const base = (p) => p.alpha * air(p) * layerAlpha;
		const shellAlpha = (p) => base(p) * (p.u <= fill ? 1 : st.emptyAlpha) * shown(p);
		ctx.lineCap = 'round'; ctx.lineJoin = 'round';

		// the contact shadow: the tube sits ON the snow, so it casts one (alpine)
		if (st.shadow) {
			const sh = st.shadow;
			ctx.save(); ctx.translate(sh.dx * k, sh.dy * k);
			if ('filter' in ctx) ctx.filter = 'blur(1.2px)';
			strokeRuns(samples, sh.width * k, 'rgba(0, 0, 0, 1)', () => true, 0, (p) => shellAlpha(p) * sh.alpha);
			ctx.restore();
		}

		// the glass body and its thickness inside the far wall (the walls go on last: glass is in front of the liquid)
		if (st.shell) {
			strokeRuns(samples, st.tube * k, st.shellFill, () => true, 0, shellAlpha);
			strokeRuns(samples, 1.5, st.innerShade, () => true, -(half - 1.6), shellAlpha);
		}

		// the fluid: the glow bleeds through the glass (additive), then the body and its bright thread
		const last = samples.filter(filled).pop();
		if (last) {
			ctx.save(); ctx.globalCompositeOperation = 'lighter';
			for (const [w, a] of st.glow) strokeRuns(samples, w * k, st.fluid, filled, 0, (p) => base(p) * a, fluidColor);
			ctx.restore();
			strokeRuns(samples, fw, st.fluid, filled, 0, base, fluidColor);
			strokeRuns(samples, Math.max(0.8, 1.2 * k), st.fluidCore, filled, 0.4 * k, (p) => base(p) * 0.9, (p) => coreColor(p));
			if (!reduced) {
				// the clotted flow: two dash layers on different periods, drifting
				const fl = st.flow;
				ctx.setLineDash(fl.dash); ctx.lineDashOffset = -(now * fl.speed) % (fl.dash[0] + fl.dash[1]);
				const solid = (p) => (p.alpha >= 0.6 ? base(p) : 0);   // no clots where the tube is fading into the cloud: they read as a dashed line
				strokeRuns(samples, fw, 'rgba(255,255,255,1)', filled, 0, (p) => solid(p) * fl.alpha);
				ctx.setLineDash([fl.dash[0] * 1.7, fl.dash[1] * 2.3]); ctx.lineDashOffset = -(now * fl.speed * 0.6) % ((fl.dash[0] * 1.7) + (fl.dash[1] * 2.3));
				strokeRuns(samples, fw, 'rgba(0,0,0,1)', filled, 0, (p) => solid(p) * fl.alpha * 0.5);
				ctx.setLineDash([]);
				// the energy packet: travels the filled length, with a gap before the next one
				const pu = st.pulse, span = last.s + pu.gap;
				const sp = (now * pu.speed) % span;
				const packet = (p) => Math.exp(-Math.pow((p.s - sp) / pu.halfLen, 2));
				ctx.save(); ctx.globalCompositeOperation = 'lighter';
				strokeRuns(samples, 16 * k, st.fluid, filled, 0, (p) => base(p) * pu.glow * packet(p), fluidColor);
				ctx.restore();
				strokeRuns(samples, fw + 0.6, st.front, filled, 0, (p) => base(p) * pu.alpha * packet(p));
			}
			// the meniscus: a bright cap where the fluid ends
			if (last.alpha > 0.02 && fill < 0.999) {
				ctx.save(); ctx.globalCompositeOperation = 'lighter';
				ctx.fillStyle = fluidColor(last); ctx.globalAlpha = base(last) * 0.35; ctx.beginPath(); ctx.arc(last.x, last.y, st.frontHalo * k, 0, Math.PI * 2); ctx.fill();
				ctx.restore();
				ctx.globalAlpha = base(last); ctx.fillStyle = st.front; ctx.beginPath(); ctx.arc(last.x, last.y, Math.max(1.2, fw * 0.7), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
			}
		}

		// the walls, in front of everything: the near wall takes the moon, the far wall barely
		if (st.shell) {
			strokeRuns(samples, 1, st.wallUpper, () => true, half - 0.5, shellAlpha);
			strokeRuns(samples, 1, st.wallLower, () => true, -(half - 0.5), shellAlpha);
		}

		// the intro's leading edge: a cold glint where the glass is being laid, gone once it is
		if (reveal > 0 && reveal < 1) {
			const edge = samples.find((p) => p.u >= reveal);
			if (edge && edge.alpha > 0.05 && edge.u > fill) {
				ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = edge.alpha * 0.5;
				ctx.fillStyle = 'rgb(200, 225, 255)'; ctx.beginPath(); ctx.arc(edge.x, edge.y, 9, 0, Math.PI * 2); ctx.fill();
				ctx.restore();
				ctx.globalAlpha = edge.alpha; ctx.fillStyle = 'rgb(245, 250, 255)'; ctx.beginPath(); ctx.arc(edge.x, edge.y, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
			}
		}
	}
	function drawFitting(p, k, len = st.fitting.len, layerAlpha = 1) {
		// a machined ring around the tube: a cylinder's shading across the normal, a groove at each end
		const f = st.fitting;
		ctx.save();
		ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.ty, p.tx)); ctx.scale(k, k);
		ctx.globalAlpha = p.alpha * layerAlpha;
		const g = ctx.createLinearGradient(0, -f.width / 2, 0, f.width / 2);
		g.addColorStop(0, f.light); g.addColorStop(0.45, f.dark); g.addColorStop(1, f.light);
		ctx.fillStyle = g; ctx.strokeStyle = f.edge; ctx.lineWidth = 1;
		ctx.beginPath(); ctx.roundRect(-len / 2, -f.width / 2, len, f.width, 1.5); ctx.fill(); ctx.stroke();
		ctx.strokeStyle = f.groove;
		for (const gx of [-len / 2 + 3, len / 2 - 3]) { ctx.beginPath(); ctx.moveTo(gx, -f.width / 2 + 1); ctx.lineTo(gx, f.width / 2 - 1); ctx.stroke(); }
		ctx.restore();
	}
	function tentAt(f) {
		const k = live.glowKeys;
		if (f <= k[0][0]) return k[0][1];
		for (let i = 1; i < k.length; i++) if (f <= k[i][0]) { const a = k[i - 1], b = k[i], q = (f - a[0]) / (b[0] - a[0]); return [lerp(a[1][0], b[1][0], q), lerp(a[1][1], b[1][1], q)]; }
		return k[k.length - 1][1];
	}
	function drawGlow(f, fill, t) {
		// the lamp in the tent: alive whenever the tent is in frame, lifted when the route arrives.
		// It flickers BOTH ways — a warm addition at the peak, a dimming of the film's own light in
		// the trough (multiply) — because the tent is nearly saturated in the film and light added to
		// it alone does not read.
		const g = cfg.glow;
		const k = live.glowKeys;
		const lit = smooth(f, g.lit[0], g.lit[1]);   // the tent rises into the frame
		if (lit <= 0.001) return;
		const arrive = smooth(fill, resolveU(g.arrive), stopById.STOP_03.u);
		const [x, y] = toScreen(tentAt(f));
		// firelight: a slow breath under two faster, unrelated flickers — never the same twice
		const flicker = reduced ? 0 : 0.55 * Math.sin((t / g.breath) * Math.PI * 2)
			+ 0.30 * Math.sin((t / 0.83) * Math.PI * 2 + 1.3)
			+ 0.25 * Math.sin((t / 0.31) * Math.PI * 2 + 0.4) * (0.6 + 0.4 * Math.sin(t / 1.7));
		const base = 0.05 + 0.35 * arrive, amp = 0.55 + 0.3 * arrive;   // the swing crosses zero: the tent itself dims and lifts
		const val = (base + amp * flicker) * lit;   // < 0 = dimmer than the film, > 0 = brighter
		const r = g.radius * H;
		ctx.save();
		if (val >= 0) {
			// the bloom into the mist first (wide, faint), then the lamp's own light
			const rh = g.halo * H;
			const halo = ctx.createRadialGradient(x, y, 0, x, y, rh);
			halo.addColorStop(0, `rgba(${g.color}, ${(g.max * 0.35 * val).toFixed(3)})`);
			halo.addColorStop(0.5, `rgba(${g.color}, ${(g.max * 0.12 * val).toFixed(3)})`);
			halo.addColorStop(1, `rgba(${g.color}, 0)`);
			ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = halo;
			ctx.beginPath(); ctx.arc(x, y, rh, 0, Math.PI * 2); ctx.fill();
			const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
			grad.addColorStop(0, `rgba(${g.color}, ${(g.max * val).toFixed(3)})`);
			grad.addColorStop(0.45, `rgba(${g.color}, ${(g.max * 0.4 * val).toFixed(3)})`);
			grad.addColorStop(1, `rgba(${g.color}, 0)`);
			ctx.fillStyle = grad;
		} else {
			const d = Math.min(1, -val * 1.4);
			const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 0.8);
			grad.addColorStop(0, `rgba(${g.dim}, ${(0.7 * d).toFixed(3)})`);
			grad.addColorStop(0.5, `rgba(${g.dim}, ${(0.3 * d).toFixed(3)})`);
			grad.addColorStop(1, `rgba(${g.dim}, 0)`);
			ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = grad;
		}
		ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
		ctx.restore();
	}
	function drawFitting(p, k, len = st.fitting.len, layerAlpha = 1) {
		// a machined ring around the tube: a cylinder's shading across the normal, a groove at each end
		const f = st.fitting;
		ctx.save();
		ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.ty, p.tx)); ctx.scale(k, k);
		ctx.globalAlpha = p.alpha * layerAlpha;
		const g = ctx.createLinearGradient(0, -f.width / 2, 0, f.width / 2);
		g.addColorStop(0, f.light); g.addColorStop(0.45, f.dark); g.addColorStop(1, f.light);
		ctx.fillStyle = g; ctx.strokeStyle = f.edge; ctx.lineWidth = 1;
		ctx.beginPath(); ctx.roundRect(-len / 2, -f.width / 2, len, f.width, 1.5); ctx.fill(); ctx.stroke();
		ctx.strokeStyle = f.groove;
		for (const gx of [-len / 2 + 3, len / 2 - 3]) { ctx.beginPath(); ctx.moveTo(gx, -f.width / 2 + 1); ctx.lineTo(gx, f.width / 2 - 1); ctx.stroke(); }
		ctx.restore();
	}
	function tentAt(f) {
		const k = live.glowKeys;
		if (f <= k[0][0]) return k[0][1];
		for (let i = 1; i < k.length; i++) if (f <= k[i][0]) { const a = k[i - 1], b = k[i], q = (f - a[0]) / (b[0] - a[0]); return [lerp(a[1][0], b[1][0], q), lerp(a[1][1], b[1][1], q)]; }
		return k[k.length - 1][1];
	}
	function drawGlow(f, fill, t) {
		const g = cfg.glow;
		const arrive = smooth(fill, resolveU(g.arrive), stopById.STOP_03.u);
		if (arrive <= 0.001) return;
		const k = g.keys;
		let c = k[k.length - 1][1];
		if (f <= k[0][0]) c = k[0][1];
		else for (let i = 1; i < k.length; i++) if (f <= k[i][0]) { const a = k[i - 1], b = k[i], q = (f - a[0]) / (b[0] - a[0]); c = [lerp(a[1][0], b[1][0], q), lerp(a[1][1], b[1][1], q)]; break; }
		const [x, y] = toScreen(c);
		// firelight: a slow breath under two faster, unrelated flickers — never the same twice, never dark
		const breath = reduced ? 1 : 0.74
			+ 0.16 * Math.sin((t / g.breath) * Math.PI * 2)
			+ 0.07 * Math.sin((t / 0.83) * Math.PI * 2 + 1.3)
			+ 0.05 * Math.sin((t / 0.31) * Math.PI * 2 + 0.4) * (0.6 + 0.4 * Math.sin(t / 1.7));
		const r = g.radius * H;
		const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
		grad.addColorStop(0, `rgba(${g.color}, ${(g.max * arrive * breath).toFixed(3)})`);
		grad.addColorStop(0.45, `rgba(${g.color}, ${(g.max * 0.35 * arrive * breath).toFixed(3)})`);
		grad.addColorStop(1, `rgba(${g.color}, 0)`);
		ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = grad;
		ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
	}

	/* ---- frame ---- */
	let toScreen = null;
	let reveal = 1;   // intro.js: how much of the route's empty glass is drawn on (u)
	/* the scroll's direction owns the route: scrolling down, it is there and the fluid follows;
	   scrolling up, it fades out; turning down again, it comes back and the fluid refills from the
	   summit to where the scroll is (a short catch-up), then follows again */
	let lastF = -1, dirDown = true, vis = 1, fillShown = 0, lastNow = 0;
	function transport(f, fill, now) {
		const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0; lastNow = now;
		if (lastF >= 0) {
			const d = f - lastF;
			if (d > 0.0005 && !dirDown) { dirDown = true; fillShown = 0; }   // turned down: start over
			else if (d < -0.0005 && dirDown) dirDown = false;               // turned up: leave
		}
		lastF = f;
		vis += ((dirDown ? 1 : 0) - vis) * Math.min(1, dt * (dirDown ? 5 : 8));
		fillShown += (fill - fillShown) * Math.min(1, dt * 6);
		if (Math.abs(fill - fillShown) < 0.002) fillShown = fill;
		return { vis, fill: fillShown };
	}
	function setReveal(r) { reveal = clamp(r, 0, 1); if (reduced) draw(performance.now()); }
	function resize() {
		const box = size ? size() : { w: window.innerWidth, h: window.innerHeight };
		W = box.w; H = box.h; dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
		leaders.setAttribute('viewBox', `0 0 ${W} ${H}`);
		toScreen = filmToScreen(video, fit, W, H);
		placePlates();
		if (reduced) draw(performance.now());
	}

	function draw(now) {
		const f = video.duration ? clamp(video.currentTime / video.duration, 0, 1) : 0;
		const chains = {};
		for (const [name, ch] of Object.entries(cfg.chains)) {
			const pts = keyedPoints(name, f).map(toScreen);
			chains[name] = sampleChain(pts, keyedAlpha(name, f), cfg.samplesPerChain, ch.u);
		}
		// where each stop is now
		for (const s of stops) {
			const [chain, idx] = s.at, samples = chains[chain];
			const at = samples.reduce((best, p) => Math.abs(p.cp - idx) < Math.abs(best.cp - idx) ? p : best, samples[0]);
			s.u = at.u; s.sample = at; s.anchor = [at.x, at.y];
			s.onScreen = at.alpha > 0.5 && at.x > 8 && at.x < W - 8 && at.y > 8 && at.y < H - 8;
		}
		const wanted = reduced ? resolveU(cfg.reducedU) : fillFor(f);
		const tr = reduced ? { vis: 1, fill: wanted } : transport(f, wanted, now);
		const fill = tr.fill;
		// the instrument's scale follows the mountain's apparent size (the camera pushes in, then descends)
		const sr = cfg.scaleRef, pts = keyedPoints(sr.chain, f).map(toScreen);
		const k = clamp(Math.hypot(pts[sr.to][0] - pts[sr.from][0], pts[sr.to][1] - pts[sr.from][1]) / (sr.px * W / 1440), sr.min, sr.max);

		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		const t = now / 1000;
		tentPx = toScreen(tentAt(f));
		drawGlow(f, fill, t);   // under the conduit: the camp's light is the film's, brightened
		if (tr.vis > 0.01) {
			// scrolling up takes the whole instrument away: every stroke carries the same transparency
			const layerAlpha = tr.vis;
			for (const [name, samples] of Object.entries(chains)) drawChain(samples, fill, t, k, name, layerAlpha);
			if (st.fittings) {
				if (reveal > 0.02) drawFitting(chains.ridge[1], k, st.fitting.len + 2, layerAlpha);   // the cap at the summit
				for (const s of stops) if (s.sample && s.sample.alpha > 0.5 && (s.u <= fill || reveal >= s.u)) drawFitting(s.sample, k, undefined, layerAlpha);
			}
		}
		if (cfg.callouts) updateCallouts(fill);
	}

	let raf = 0;
	function loop(now) { draw(now); raf = requestAnimationFrame(loop); }

	window.addEventListener('resize', resize);
	const start = () => { resize(); if (reduced) draw(performance.now()); else raf = requestAnimationFrame(loop); };
	if (video.readyState >= 1) start(); else video.addEventListener('loadedmetadata', start, { once: true });

	/* tools/route-editor: replace the keys live (the editor's own copy; nothing here writes the config) */
	function setKeys(keys, glowKeys) { live.keys = keys; if (glowKeys) live.glowKeys = glowKeys; if (reduced) draw(performance.now()); }

	return { stops, draw, resize, setReveal, setKeys, cfg, live, get transport() { return { dirDown, vis, fillShown, lastF }; } };
}
