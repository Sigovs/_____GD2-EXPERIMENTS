/*
 * vignette.js — the frame's darkening, drawn on a canvas WITH DITHER.
 *
 * A CSS gradient is quantised to 8 bits: over a dark, smooth ground every 1/255 step lands on
 * one screen row and reads as a straight line across the frame. Easing the stops made the
 * lines finer, not gone (Alex, 18 Sep: "полоса стала уже, но не исчезла"). Here the same
 * shape is computed per pixel and rounded with random noise (±1 level), so no two pixels on
 * a row round the same way and there is no step to see.
 *
 * Shape: a cool darkening at the top and the bottom (eased, no kinks) plus a soft radial
 * fall-off to the corners — the same intent as the old .stage__vignette rule.
 */

export const VIGNETTE = {
	color: [5, 8, 15],
	top: { to: 0.34, amount: 0.55 },        // from the top edge down to `to` of the height
	bottom: { from: 0.50, amount: 0.60 },   // from `from` of the height to the bottom edge
	radial: { cx: 0.5, cy: 0.45, rx: 1.2, ry: 0.8, start: 0.3, amount: 0.45 },
	maxWidth: 1600,                          // the canvas is drawn at most this wide and stretched — the dither survives the scale
};

const ease = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };   // smoothstep: zero slope at both ends
const easeIn = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * t; };            // starts flat, darkens toward the edge

export function createVignette({ canvas, cfg = VIGNETTE }) {
	const ctx = canvas.getContext('2d');
	const [cr, cg, cb] = cfg.color;

	function draw() {
		const vw = window.innerWidth, vh = window.innerHeight;
		const scale = Math.min(1, cfg.maxWidth / vw);
		const W = Math.max(2, Math.round(vw * scale)), H = Math.max(2, Math.round(vh * scale));
		canvas.width = W; canvas.height = H;
		const img = ctx.createImageData(W, H);
		const d = img.data;
		const { top, bottom, radial } = cfg;
		for (let y = 0; y < H; y++) {
			const v = y / (H - 1);
			// the vertical bands: eased, flat where they start, so nothing bends
			const aTop = top.amount * easeIn(1 - v / top.to);
			const aBot = bottom.amount * easeIn((v - bottom.from) / (1 - bottom.from));
			for (let x = 0; x < W; x++) {
				const u = x / (W - 1);
				const dx = (u - radial.cx) / radial.rx, dy = (v - radial.cy) / radial.ry;
				const r = Math.sqrt(dx * dx + dy * dy) * 2;   // 1 at the ellipse's edge
				const aRad = radial.amount * ease((r - radial.start) / (1 - radial.start));
				// the layers composite like the two CSS gradients did: one over the other
				const a = 1 - (1 - Math.min(1, aTop + aBot)) * (1 - aRad);
				// dither: random rounding, so the step between two levels is spread over many pixels
				const a8 = Math.min(255, Math.max(0, Math.floor(a * 255 + Math.random())));
				const i = (y * W + x) * 4;
				d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = a8;
			}
		}
		ctx.putImageData(img, 0, 0);
	}

	let t = 0;
	window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 120); });
	draw();
	return { draw, cfg };
}
