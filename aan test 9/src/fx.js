/*
 * fx.js — two finishing layers over the stage, tuned from the editor (G): GRAIN and a RADIAL.
 *
 *   grain  — film grain: four tiles of dithered noise cycle at `fps`, drawn as a pattern at `size`, blended
 *            (overlay / soft-light / …) at `amount`. Alive even when the scroll rests; free when amount is 0.
 *   radial — one radial gradient in a colour: centre (x, y of the frame), size, softness, blend and amount —
 *            drawn DITHERED on a canvas (a CSS radial-gradient steps in rings on a dark picture; see vignette.js).
 *
 * Both read a config object (TENT_GLOW.grain / .radial — kept with the other dials) through apply*().
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/* ---------------- grain ---------------- */
let grainCanvas = null, grainCtx = null, tiles = [], grainCfg = null, grainRaf = 0, lastTile = 0, tileAt = 0;
function makeTiles(n = 4, size = 256) {
	// FILM grain, not white noise: a gaussian-ish distribution (three randoms summed), a small chroma part
	// (the layers of a colour negative do not grain identically), then a soft 3x3 blur so a grain is a blob
	// of ~1.5-2 px, never a single hard pixel
	const out = [];
	const gauss = () => (Math.random() + Math.random() + Math.random()) / 3 - 0.5;   // -0.5..0.5, peaked at 0
	for (let k = 0; k < n; k++) {
		const L = new Float32Array(size * size), C = new Float32Array(size * size * 3);
		for (let i = 0; i < size * size; i++) { L[i] = gauss(); C[i * 3] = gauss() * 0.35; C[i * 3 + 1] = gauss() * 0.3; C[i * 3 + 2] = gauss() * 0.4; }
		const c = document.createElement('canvas'); c.width = c.height = size;
		const x = c.getContext('2d'); const img = x.createImageData(size, size); const d = img.data;
		const at = (i, j) => ((i + size) % size) * size + ((j + size) % size);   // tiling blur
		for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
			let l = 0, r = 0, g = 0, b = 0;
			for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
				const w = (di === 0 && dj === 0) ? 0.36 : (di === 0 || dj === 0) ? 0.1 : 0.06;
				const q = at(i + di, j + dj); l += L[q] * w; r += C[q * 3] * w; g += C[q * 3 + 1] * w; b += C[q * 3 + 2] * w;
			}
			const o = (i * size + j) * 4;
			d[o] = 128 + (l + r) * 255 * 1.9; d[o + 1] = 128 + (l + g) * 255 * 1.9; d[o + 2] = 128 + (l + b) * 255 * 1.9; d[o + 3] = 255;
		}
		x.putImageData(img, 0, 0); out.push(c);
	}
	return out;
}
function grainFrame(now) {
	grainRaf = 0;
	const g = grainCfg;
	if (!g || g.amount <= 0) return;
	if (now - tileAt >= 1000 / Math.max(1, g.fps)) {
		tileAt = now; lastTile = (lastTile + 1) % tiles.length;
		const W = grainCanvas.width, H = grainCanvas.height;
		const p = grainCtx.createPattern(tiles[lastTile], 'repeat');
		grainCtx.setTransform(1, 0, 0, 1, 0, 0); grainCtx.clearRect(0, 0, W, H);
		const s = g.size; grainCtx.setTransform(s, 0, 0, s, -Math.random() * 256 * s, -Math.random() * 256 * s);
		grainCtx.fillStyle = p; grainCtx.fillRect(0, 0, (W + 256 * s) / s, (H + 256 * s) / s);
	}
	grainRaf = requestAnimationFrame(grainFrame);
}
export function applyGrain(g) {
	grainCfg = g;
	if (!grainCanvas) {
		grainCanvas = document.getElementById('fx-grain'); if (!grainCanvas) return;
		grainCtx = grainCanvas.getContext('2d'); tiles = makeTiles();
		const size = () => { const d = innerWidth > 2000 ? 1 : Math.min(devicePixelRatio || 1, 2); grainCanvas.width = Math.round(innerWidth * d); grainCanvas.height = Math.round(innerHeight * d); tileAt = 0; };   // on a big screen the grain is drawn at 1x — the tiles are soft blobs anyway
		addEventListener('resize', size); size();
	}
	grainCanvas.style.opacity = String(clamp(g.amount, 0, 1));
	grainCanvas.style.mixBlendMode = g.blend || 'overlay';
	grainCanvas.style.visibility = g.amount > 0 ? 'visible' : 'hidden';
	tileAt = 0;
	if (g.amount > 0 && !grainRaf) grainRaf = requestAnimationFrame(grainFrame);
}

/* ---------------- radial ---------------- */
let radialCanvas = null, radialCfg = null, radialTimer = 0;
function drawRadial() {
	const r = radialCfg; if (!r || !radialCanvas) return;
	const ctx = radialCanvas.getContext('2d');
	const vw = innerWidth, vh = innerHeight, scale = Math.min(1, 1200 / vw);
	const W = Math.max(2, Math.round(vw * scale)), H = Math.max(2, Math.round(vh * scale));
	radialCanvas.width = W; radialCanvas.height = H;
	if (r.amount <= 0) { ctx.clearRect(0, 0, W, H); return; }
	const [cr, cg, cb] = hex(r.color);
	const img = ctx.createImageData(W, H), d = img.data;
	const aspect = vw / vh;
	for (let y = 0; y < H; y++) {
		const v = y / (H - 1);
		for (let x = 0; x < W; x++) {
			const u = x / (W - 1);
			const dx = (u - r.x) * aspect, dy = (v - r.y);
			const dist = Math.sqrt(dx * dx + dy * dy) / Math.max(0.01, r.size);   // 1 at the edge of the disc
			let a = r.invert ? clamp((dist - (1 - r.soft)) / Math.max(0.001, r.soft), 0, 1) : 1 - clamp((dist - (1 - r.soft)) / Math.max(0.001, r.soft), 0, 1);
			a = a * a * (3 - 2 * a);
			const i = (y * W + x) * 4;
			d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = clamp(Math.floor(a * 255 + Math.random()), 0, 255);
		}
	}
	ctx.putImageData(img, 0, 0);
}
export function applyRadial(r) {
	radialCfg = r;
	if (!radialCanvas) {
		radialCanvas = document.getElementById('fx-radial'); if (!radialCanvas) return;
		addEventListener('resize', () => { clearTimeout(radialTimer); radialTimer = setTimeout(drawRadial, 150); });
	}
	radialCanvas.style.opacity = String(clamp(r.amount, 0, 1));
	radialCanvas.style.mixBlendMode = r.blend || 'multiply';
	radialCanvas.style.visibility = r.amount > 0 ? 'visible' : 'hidden';
	clearTimeout(radialTimer); radialTimer = setTimeout(drawRadial, 30);   // the dials fire fast; one redraw per pause
}
