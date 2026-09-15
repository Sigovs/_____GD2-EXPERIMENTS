/*
 * glass.js — a real glass plate for the route callouts, after Figma's Glass effect:
 * refraction (the backdrop bends through a thick, rounded edge), dispersion (the three
 * channels refract by slightly different amounts → the rainbow fringe), frost (a light
 * blur), light (a specular ring, done in route.css).
 *
 * Refraction and dispersion are an SVG filter applied with `backdrop-filter: url(#…)`:
 * a canvas-drawn displacement map (R = x, G = y, 128 = none) of the plate's own size —
 * a bevel band along the rounded edge that pulls the sample point inward (a convex lens),
 * strongest at the edge, nearly flat in the middle so the text sits on a calm backdrop.
 * One filter per plate (its map is its size); `fit(w, h)` redraws it. Where url() is not
 * accepted in backdrop-filter (Safari, Firefox) the plain blur declaration before it wins.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
let host = null;

function ensureHost(root) {
	if (host) return host;
	host = document.createElementNS(SVG_NS, 'svg');
	host.setAttribute('width', '0');
	host.setAttribute('height', '0');
	host.setAttribute('aria-hidden', 'true');
	host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
	(root ?? document.body).appendChild(host);
	return host;
}

/** signed distance to a rounded rectangle centred at the origin (positive inside) */
function sdRoundRect(px, py, hw, hh, r) {
	const qx = Math.abs(px) - hw + r, qy = Math.abs(py) - hh + r;
	const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
	const inside = Math.min(Math.max(qx, qy), 0);
	return -(outside + inside - r);
}

/**
 * @param {object} o
 * @param {string} o.id          unique filter id
 * @param {HTMLElement} [o.root] where the hidden <svg> with the filters lives
 * @param {number} o.radius      corner radius (px) — must match the plate's border-radius
 * @param {number} o.bevelPx     width of the refracting edge band (px)
 * @param {number} o.refractPx   how far the backdrop is displaced at the very edge (px)
 * @param {number} o.dispersion  0..1 — channel spread (R less, B more than G)
 * @param {number} o.frostPx     blur (px) after refraction
 * @param {number} [o.profile]   edge profile exponent: 1 linear, 2 lens-like (default 1.6)
 * @param {number} [o.magnify]   0..0.2 — the slab is a weak convex lens: the interior samples toward the centre
 */
export function createGlassFilter({ id, root, radius = 8, bevelPx = 22, refractPx = 28, dispersion = 0.18, frostPx = 1.2, profile = 1.6, magnify = 0 }) {
	const svg = ensureHost(root);
	const filter = document.createElementNS(SVG_NS, 'filter');
	filter.setAttribute('id', id);
	filter.setAttribute('filterUnits', 'userSpaceOnUse');
	filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
	filter.setAttribute('color-interpolation-filters', 'sRGB');
	filter.setAttribute('x', '0'); filter.setAttribute('y', '0');

	const image = document.createElementNS(SVG_NS, 'feImage');
	image.setAttribute('x', '0'); image.setAttribute('y', '0');
	image.setAttribute('preserveAspectRatio', 'none');
	image.setAttribute('result', 'map');

	// three refractions (R short, G, B long), each reduced to its channel, added back with screen
	const channels = [['R', 1 - dispersion, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'],
	                  ['G', 1,              '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'],
	                  ['B', 1 + dispersion, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0']];
	const disp = [];
	const parts = [image];
	for (const [ch, k, matrix] of channels) {
		const d = document.createElementNS(SVG_NS, 'feDisplacementMap');
		d.setAttribute('in', 'SourceGraphic'); d.setAttribute('in2', 'map');
		d.setAttribute('xChannelSelector', 'R'); d.setAttribute('yChannelSelector', 'G');
		d.setAttribute('scale', (refractPx * 2 * k).toFixed(2));   // map values span ±0.5 → ±scale/2
		d.setAttribute('result', `d${ch}`);
		const m = document.createElementNS(SVG_NS, 'feColorMatrix');
		m.setAttribute('in', `d${ch}`); m.setAttribute('type', 'matrix'); m.setAttribute('values', matrix);
		m.setAttribute('result', `c${ch}`);
		disp.push(d);
		parts.push(d, m);
	}
	const b1 = document.createElementNS(SVG_NS, 'feBlend');
	b1.setAttribute('in', 'cR'); b1.setAttribute('in2', 'cG'); b1.setAttribute('mode', 'screen'); b1.setAttribute('result', 'cRG');
	const b2 = document.createElementNS(SVG_NS, 'feBlend');
	b2.setAttribute('in', 'cRG'); b2.setAttribute('in2', 'cB'); b2.setAttribute('mode', 'screen'); b2.setAttribute('result', 'refracted');
	const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
	blur.setAttribute('in', 'refracted'); blur.setAttribute('stdDeviation', String(frostPx));
	parts.push(b1, b2, blur);
	parts.forEach((p) => filter.appendChild(p));
	svg.appendChild(filter);

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	let fitted = '';

	/** Draw the displacement map for a plate of w × h css px (device-pixel resolution). */
	function fit(w, h) {
		w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
		const key = `${w}x${h}`;
		if (key === fitted) return;
		fitted = key;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		const W = Math.round(w * dpr), H = Math.round(h * dpr);
		canvas.width = W; canvas.height = H;
		const img = ctx.createImageData(W, H);
		const data = img.data;
		const hw = w / 2, hh = h / 2, r = Math.min(radius, hw, hh);
		const eps = 0.5;
		for (let j = 0; j < H; j++) {
			const py = (j + 0.5) / dpr - hh;
			for (let i = 0; i < W; i++) {
				const px = (i + 0.5) / dpr - hw;
				const d = sdRoundRect(px, py, hw, hh, r);
				// map value ±0.5 ↔ ±refractPx of displacement (the filter's scale is 2·refractPx)
				// the lens body: sample toward the centre → the backdrop is magnified through the slab
				let dx = -px * magnify / (2 * refractPx), dy = -py * magnify / (2 * refractPx);
				if (d < bevelPx) {
					// the thick edge: outward normal from the SDF gradient, magnitude rising to the edge with the lens profile
					const gx = (sdRoundRect(px + eps, py, hw, hh, r) - sdRoundRect(px - eps, py, hw, hh, r)) / (2 * eps);
					const gy = (sdRoundRect(px, py + eps, hw, hh, r) - sdRoundRect(px, py - eps, hw, hh, r)) / (2 * eps);
					const len = Math.hypot(gx, gy) || 1;
					const t = Math.max(0, 1 - Math.max(d, 0) / bevelPx);
					const mag = Math.pow(t, profile) * 0.5;
					// INWARD (+gradient): the edge shows the backdrop from further inside, like a convex lens —
				// sampling outward would read past the element's clipped backdrop and go transparent
				dx += gx / len * mag; dy += gy / len * mag;
				}
				const o = (j * W + i) * 4;
				data[o] = Math.round(Math.min(1, Math.max(0, 0.5 + dx)) * 255);
				data[o + 1] = Math.round(Math.min(1, Math.max(0, 0.5 + dy)) * 255);
				data[o + 2] = 0;
				data[o + 3] = 255;
			}
		}
		ctx.putImageData(img, 0, 0);
		const url = canvas.toDataURL('image/png');
		image.setAttribute('href', url);
		image.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
		image.setAttribute('width', String(w)); image.setAttribute('height', String(h));
		filter.setAttribute('width', String(w)); filter.setAttribute('height', String(h));
	}

	return { id, filter, fit, css: `url(#${id})` };
}
