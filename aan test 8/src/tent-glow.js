/*
 * tent-glow.js — the tent's light, alive: a stack of warm glows that breathes and flickers.
 *
 * The idea is the "animated fire text-shadow" (codepen atnyman/nmEyjK, Alex 18 Sep): seven shadows
 * from cream to ember, each softer, larger and higher than the last (heat rises), swinging between
 * two states on two different rhythms so it reads as fire, not a metronome. Here the "letter" is the
 * tent in the film: the stack is drawn over it, at its position in the current frame.
 *
 *   • track    — the tent's centre and size per film frame (rotoscoped from the frames: the orange
 *                blob's centroid), mapped through the film's object-fit: cover to screen pixels
 *   • layers   — one dithered radial sprite per colour (no 8-bit gradient steps — see vignette.js),
 *                composited with `lighter` so they add light instead of painting over the film
 *   • rhythm   — a slow breath (~2.6 s) + a quicker tremble (~0.7 s) + rare short flares; every layer
 *                on its own phase, the outer layers drifting a little as they flicker
 *   • scroll   — the film brings the tent in around frame 180; the light fades in with it
 *   • mouse    — the whole stack leans a few pixels toward the cursor
 *   • reduced  — the stack, still: no breath, no flicker
 *
 * It sits between the film and the clouds, so the thin cloud at the camp veils it — the light is
 * in the fog, not on the glass.
 */

export const TENT_GLOW = {
	enabled: true,
	frameAspect: 16 / 9,
	// [frame, u, v, w] — the tent's centre (0..1 of the frame) and its lit width (0..1 of the frame width)
	track: [[179, 0.9363, 0.9952, 0.0344], [182, 0.9107, 0.9873, 0.0625], [184, 0.8925, 0.9823, 0.0719], [189, 0.8485, 0.9664, 0.105], [194, 0.7999, 0.9404, 0.1112], [199, 0.7498, 0.9111, 0.125], [204, 0.7024, 0.883, 0.11], [209, 0.6575, 0.8563, 0.1412], [214, 0.6175, 0.8337, 0.1294], [219, 0.5831, 0.814, 0.1212], [224, 0.5552, 0.7983, 0.1194], [229, 0.534, 0.7862, 0.1275], [234, 0.5186, 0.7771, 0.1444], [239, 0.5088, 0.7703, 0.1325], [240, 0.5079, 0.7693, 0.1431]],
	/* the shape the light is cast from — a polygon in tent widths from the tracked centroid, drawn by hand in the
	   editor (src/glow-editor.js: open with ?edit=glow or press G). Empty = the circular stack. Each layer is this
	   shape, filled in its colour and blurred by its radius, exactly as text-shadow blurs the glyph. */
	// Alex's shape, 18 Sep (drawn in the editor)
	shape: [[0.7098, 0.134], [-0.0026, -0.051], [-1.8527, 0.2148], [-0.1084, 0.2369], [2.2005, 0.1867], [0.948, 0.1144], [0.7651, -0.1089], [0.7481, 0.0315]],
	blur: 0.55,               // blur radius per layer, in `radius` tent widths (the sprite's soft edge, matched)
	// the editor's dials (src/glow-editor.js) — all multipliers on the stack above
	intensity: 2.09,          // brightness of the whole stack
	spread: 0.3,              // how far the light reaches (radius / blur)
	riseScale: 1.94,          // how high the plume climbs
	// the palette: the seven layers run core → mid → ember (the pen's cream → orange → coal); null = the colours above
	palette: { core: '#ff6600', mid: '#ff5900', ember: '#ff0000' },   // Alex, 18 Sep: pure fire, no cream (null = the pen's colours above)
	fadeIn: [192, 226],       // frames: the light comes up as the tent settles into the frame (earlier it reads as a sunrise over the edge)
	anchor: 0,                // the flame sits at the tent's centroid
	// the stack, in the pen's order: radius and rise in tent widths, alpha 0..1. The core is wide and soft —
	// the tent IS the source, so there is no hot spot, just the canopy's own light spreading
	//          colour       radius  rise   alpha
	layers: [
		{ color: '#fefcc9', radius: 0.62, rise: 0.00, alpha: 0.16 },
		{ color: '#feec85', radius: 0.80, rise: 0.04, alpha: 0.18 },
		{ color: '#ffae34', radius: 1.00, rise: 0.10, alpha: 0.20 },
		{ color: '#ec760c', radius: 1.25, rise: 0.18, alpha: 0.18 },
		{ color: '#cd4606', radius: 1.55, rise: 0.28, alpha: 0.14 },
		{ color: '#973716', radius: 1.90, rise: 0.38, alpha: 0.10 },
		{ color: '#451b0e', radius: 2.30, rise: 0.48, alpha: 0.07 },
	],
	breath: { period: 2.6, depth: 0.04 },      // slow swell of the whole stack
	tremble: { period: 0.72, depth: 0.04 },    // the quick shiver of a flame
	flare: { every: [3, 9], depth: 0.16, length: 0.35 },   // rare bursts: seconds between, extra brightness, duration (s)
	drift: 0.048,                              // tent widths: how far the outer layers wander as they flicker
	parallax: 13,                               // px: the lean toward the cursor
	mouseEase: 2.0,
	sprite: 256,
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// a dithered radial sprite: gaussian fall-off, random rounding — no rings
function makeSprite(color, size) {
	const c = document.createElement('canvas'); c.width = c.height = size;
	const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data;
	const [r, g, b] = hex(color); const h = size / 2;
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const dx = (x + 0.5 - h) / h, dy = (y + 0.5 - h) / h;
		const q = dx * dx + dy * dy;
		const a = q >= 1 ? 0 : Math.exp(-q * 4.5) * (1 - q);   // gaussian, pinned to zero at the rim
		const i = (y * size + x) * 4;
		d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = clamp(Math.floor(a * 255 + Math.random()), 0, 255);
	}
	ctx.putImageData(img, 0, 0);
	return c;
}

const toHex = ([r, g, b]) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const mixHex = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };

export function createTentGlow({ canvas, film, cfg = TENT_GLOW }) {
	const ctx = canvas.getContext('2d');
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const base = cfg.layers.map((l) => l.color);
	let sprites = cfg.layers.map((l) => makeSprite(l.color, cfg.sprite));
	// the palette dial: core → mid → ember across the seven layers; the sprites follow
	function setPalette(p) {
		cfg.palette = p;
		cfg.layers.forEach((l, i) => {
			const t = i / (cfg.layers.length - 1);
			l.color = p ? (t < 0.5 ? mixHex(p.core, p.mid, t * 2) : mixHex(p.mid, p.ember, (t - 0.5) * 2)) : base[i];
		});
		sprites = cfg.layers.map((l) => makeSprite(l.color, cfg.sprite));
	}
	if (cfg.palette) setPalette(cfg.palette);
	const phase = cfg.layers.map((_, i) => i * 1.7);
	let W = 0, H = 0, dpr = 1;

	function resize() {
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		W = window.innerWidth; H = window.innerHeight;
		canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
		canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
	}
	window.addEventListener('resize', resize); resize();

	// the film's object-fit: cover — frame (u, v) → screen px, and a frame width → screen px
	function cover() {
		const s = Math.max(W / cfg.frameAspect, H);   // the frame's height on screen
		const fw = s * cfg.frameAspect, fh = s;
		return { x: (W - fw) / 2, y: (H - fh) / 2, fw, fh };
	}
	const hasFilter = 'filter' in ctx;
	// one layer of the stack from the hand-drawn shape: the polygon, filled in the layer's colour, blurred
	function drawShape(color, alpha, blurPx, cx, cy, tw, dx, dy) {
		const pts = cfg.shape;
		if (pts.length < 3) return;
		ctx.globalAlpha = alpha;
		ctx.fillStyle = color;
		if (hasFilter) {
			ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
			ctx.beginPath(); pts.forEach(([rx, ry], i) => { const x = cx + rx * tw + dx, y = cy + ry * tw + dy; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.fill();
			ctx.filter = 'none';
		} else {
			// no ctx.filter: the shadow is the blur — draw the shape off-screen and let its shadow land in place
			const off = 4096;
			ctx.shadowColor = color; ctx.shadowBlur = blurPx; ctx.shadowOffsetX = off; ctx.shadowOffsetY = 0;
			ctx.beginPath(); pts.forEach(([rx, ry], i) => { const x = cx + rx * tw + dx - off, y = cy + ry * tw + dy; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.fill();
			ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0;
		}
	}
	function tentAt(frame) {
		const k = cfg.track;
		if (frame <= k[0][0]) return null;
		let a = k[0], b = k[k.length - 1];
		for (let i = 1; i < k.length; i++) if (frame <= k[i][0]) { a = k[i - 1]; b = k[i]; break; }
		const t = b[0] === a[0] ? 1 : clamp((frame - a[0]) / (b[0] - a[0]), 0, 1);
		return { u: a[1] + (b[1] - a[1]) * t, v: a[2] + (b[2] - a[2]) * t, w: a[3] + (b[3] - a[3]) * t };
	}

	const mouse = { x: 0, y: 0 }, lean = { x: 0, y: 0 };
	window.addEventListener('pointermove', (e) => { mouse.x = (e.clientX / W) * 2 - 1; mouse.y = (e.clientY / H) * 2 - 1; }, { passive: true });

	// the flares: a schedule of short bursts
	let nextFlare = 2, flareAt = -10;
	function flicker(t, i) {
		if (reduced) return 1;
		const br = 1 + cfg.breath.depth * Math.sin((t / cfg.breath.period) * Math.PI * 2 + phase[i]);
		const tr = 1 + cfg.tremble.depth * Math.sin((t / cfg.tremble.period) * Math.PI * 2 + phase[i] * 2.3) * Math.sin(t * 1.3 + phase[i]);
		const f = t - flareAt;
		const fl = f >= 0 && f < cfg.flare.length ? cfg.flare.depth * Math.sin((f / cfg.flare.length) * Math.PI) : 0;
		return br * tr + fl * (1 - i / cfg.layers.length);   // the flare is the core's, the ember barely sees it
	}

	let last = performance.now(), t = 0;
	function frame(now) {
		const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
		if (t > nextFlare) { flareAt = t; nextFlare = t + cfg.flare.every[0] + Math.random() * (cfg.flare.every[1] - cfg.flare.every[0]); }
		lean.x += (mouse.x - lean.x) * Math.min(1, dt * cfg.mouseEase);
		lean.y += (mouse.y - lean.y) * Math.min(1, dt * cfg.mouseEase);

		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		const f = film?.frame ?? 0;
		const tent = cfg.enabled ? tentAt(f) : null;
		if (tent) {
			const c = cover();
			const tw = tent.w * c.fw;                       // the tent's lit width on screen
			const cx = c.x + tent.u * c.fw + lean.x * cfg.parallax;
			const cy = c.y + tent.v * c.fh - tw * cfg.anchor + lean.y * cfg.parallax * 0.5;
			const on = smooth((f - cfg.fadeIn[0]) / (cfg.fadeIn[1] - cfg.fadeIn[0]));
			ctx.globalCompositeOperation = 'lighter';
			cfg.layers.forEach((l, i) => {
				const k = flicker(t, i);
				const r = l.radius * tw * (0.92 + 0.08 * k) * cfg.spread;
				const wander = reduced ? 0 : cfg.drift * tw * (i / cfg.layers.length);
				const x = cx + Math.sin(t * 0.9 + phase[i]) * wander;
				const y = cy - l.rise * tw * k * cfg.riseScale + Math.cos(t * 0.7 + phase[i] * 1.4) * wander * 0.6;
				const a = clamp(l.alpha * k * on * cfg.intensity, 0, 1);
				if (cfg.shape.length >= 3) drawShape(l.color, a, l.radius * tw * cfg.blur * cfg.spread, cx, cy, tw, x - cx, y - cy);
				else { ctx.globalAlpha = a; ctx.drawImage(sprites[i], x - r, y - r, r * 2, r * 2); }
			});
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = 'source-over';
		}
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);

	return { cfg, tentAt, cover, setPalette };
}
