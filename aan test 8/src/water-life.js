/*
 * water-life.js — what moves in the water while the film is a still: caustics, the suspension, bubbles.
 *
 * The water film is scrubbed by the scroll, so wherever the reader stops, the picture stops. This layer
 * keeps it alive, on a clock, over the film and under the vignette:
 *
 *   • caustics   — light through a rippled surface, two tileable ridged-noise fields (assets/textures/
 *                  caustics.png, r and g) drifting against each other, screened onto the frame; strongest
 *                  near the surface, gone with depth
 *   • suspension — motes: slow, small, many; they rise as we sink (the scroll speeds them), sway, and
 *                  lean with the cursor by depth (the near ones more)
 *   • bubbles    — few, and REAL (Alex: "только если максимально реалистичные"): each one is a lens —
 *                  the film behind it is drawn again inside the circle, inverted and magnified, as a
 *                  sphere of air refracts; a thin bright rim, a darker limb, one specular at the top, a
 *                  soft lit arc at the bottom (the surface light coming through). They rise by size,
 *                  wobble, flatten a little against the water, and are gone at the surface.
 *
 * Everything scales with the act: it comes in with the water (descent.js hands the progress in), the
 * caustics thin out with depth, the rest stays to the floor.
 */

export const WATER_LIFE = {
	enabled: true,
	caustics: { alpha: 0.085, scale: 0.7, speed: [0.011, -0.007], tint: '#9fd8ff', depthFade: [0.62, 0.86] },   // faint, fine — light on rock, never a pattern   // depthFade in page progress
	motes: { count: 90, size: [0.6, 2.2], alpha: [0.18, 0.6], rise: [4, 14], sway: 6, parallax: 18, scrollPush: 0.9 },
	bubbles: { enabled: false,   // OFF (Alex, 18 Sep: "убери пузыри") — the code stays; true brings them back
		max: 12, every: [0.6, 2.2], size: [5, 34], rise: [26, 70], wobble: 0.35, magnify: 1.7, rim: 0.7, parallax: 26, scrollPush: 1.1 },
	mouseEase: 2.0,
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

export function createWaterLife({ canvas, waterCanvas, textureUrl = 'assets/textures/caustics.png', cfg = WATER_LIFE }) {
	const ctx = canvas.getContext('2d');
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	let W = 0, H = 0, dpr = 1;
	let on = 0, depth = 0;   // on: the act's presence 0..1; depth: page progress

	function resize() {
		W = window.innerWidth; H = window.innerHeight;
		dpr = Math.min(window.devicePixelRatio || 1, W < 700 ? 1 : 1.5);   // the life is soft too: a phone draws it at 1x
		canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
		canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
	}
	window.addEventListener('resize', resize); resize();

	// ---- caustics: the texture's two channels become two tinted, tileable sprites
	const tiles = [];
	const tex = new Image();
	tex.onload = () => {
		const [r, g, b] = [parseInt(cfg.caustics.tint.slice(1, 3), 16), parseInt(cfg.caustics.tint.slice(3, 5), 16), parseInt(cfg.caustics.tint.slice(5, 7), 16)];
		for (const ch of [0, 1]) {
			const c = document.createElement('canvas'); c.width = tex.width; c.height = tex.height;
			const x = c.getContext('2d'); x.drawImage(tex, 0, 0);
			const img = x.getImageData(0, 0, c.width, c.height), d = img.data;
			for (let i = 0; i < d.length; i += 4) { const v = d[i + ch]; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = v; }
			x.putImageData(img, 0, 0);
			tiles.push({ canvas: c, pattern: ctx.createPattern(c, 'repeat'), ox: Math.random() * 512, oy: Math.random() * 512 });
		}
	};
	tex.src = textureUrl;

	function caustics(t) {
		if (!tiles.length) return;
		const c = cfg.caustics;
		const fade = 1 - smooth((depth - c.depthFade[0]) / (c.depthFade[1] - c.depthFade[0]));
		const a = c.alpha * on * fade;
		if (a <= 0.002) return;
		const s = (Math.max(W, H) / 1400) * c.scale;   // the tile at a size that reads as light on rock, not a pattern
		ctx.globalCompositeOperation = 'screen';
		// light falls from above: the caustics fade toward the bottom of the frame
		const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.4)'); g.addColorStop(0.8, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(255,255,255,0)');
		tiles.forEach((tile, i) => {
			const dx = tile.ox + t * c.speed[i] * 512 * (i ? -1 : 1), dy = tile.oy + t * c.speed[i] * 220;
			ctx.save();
			ctx.globalAlpha = a * (i ? 0.7 : 1);
			ctx.translate(dx * s % (512 * s), dy * s % (512 * s));
			ctx.scale(s, s);
			ctx.fillStyle = tile.pattern;
			ctx.fillRect(-1024, -1024, (W + 2048) / s + 2048, (H + 2048) / s + 2048);
			ctx.restore();
		});
		// the depth mask, multiplied in
		ctx.globalCompositeOperation = 'destination-in';
		ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
		ctx.globalCompositeOperation = 'source-over';
	}

	// ---- the suspension
	const motes = Array.from({ length: cfg.motes.count }, () => spawnMote(true));
	function spawnMote(anywhere) {
		const z = Math.random();   // depth: 0 far, 1 near
		return { x: Math.random() * W, y: anywhere ? Math.random() * H : H + 10, z, r: cfg.motes.size[0] + z * (cfg.motes.size[1] - cfg.motes.size[0]), a: rnd(cfg.motes.alpha[0], cfg.motes.alpha[1]) * (0.5 + 0.5 * z), v: rnd(cfg.motes.rise[0], cfg.motes.rise[1]) * (0.5 + z), ph: Math.random() * Math.PI * 2 };
	}
	function drawMotes(dt, t, push) {
		ctx.globalCompositeOperation = 'lighter';
		for (const m of motes) {
			m.y -= (m.v + push * cfg.motes.scrollPush * (0.4 + m.z)) * dt;
			m.x += Math.sin(t * 0.6 + m.ph) * cfg.motes.sway * dt;
			if (m.y < -10 || m.y > H + 20) Object.assign(m, spawnMote(false), { y: m.y < -10 ? H + 10 : -10 });
			const px = m.x + lean.x * cfg.motes.parallax * m.z, py = m.y + lean.y * cfg.motes.parallax * 0.5 * m.z;
			ctx.globalAlpha = m.a * on * (0.7 + 0.3 * Math.sin(t * 1.7 + m.ph));
			ctx.fillStyle = '#cfe6ff';
			ctx.beginPath(); ctx.arc(px, py, m.r, 0, Math.PI * 2); ctx.fill();
		}
		ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
	}

	// ---- bubbles
	const bubbles = [];
	let nextBubble = 1;
	function spawnBubble() {
		const s = rnd(cfg.bubbles.size[0], cfg.bubbles.size[1]);
		const k = (s - cfg.bubbles.size[0]) / (cfg.bubbles.size[1] - cfg.bubbles.size[0]);
		bubbles.push({ x: rnd(W * 0.08, W * 0.92), y: H + s * 2, r: s, k, v: cfg.bubbles.rise[0] + k * (cfg.bubbles.rise[1] - cfg.bubbles.rise[0]), ph: Math.random() * Math.PI * 2, wf: rnd(1.6, 2.8), born: 0 });
	}
	function drawBubble(b, t) {
		const wob = Math.sin(t * b.wf + b.ph);
		const x = b.x + wob * b.r * cfg.bubbles.wobble * 2 + lean.x * cfg.bubbles.parallax * (0.3 + 0.7 * b.k);
		const y = b.y + lean.y * cfg.bubbles.parallax * 0.5 * (0.3 + 0.7 * b.k);
		const r = b.r, sq = 1 + 0.06 * Math.abs(wob);   // a rising bubble flattens a little: wider than tall
		const alpha = on * smooth(b.born / 0.5) * smooth((y + r) / (r * 3));   // fades in when born, out at the surface

		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.translate(x, y); ctx.scale(sq, 1 / sq);
		ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
		// the lens: the film behind, inverted through the centre and magnified — the refraction of a sphere of air
		if (waterCanvas && waterCanvas.width) {
			const m = cfg.bubbles.magnify, sw = (r * 2 * m) * dpr, sh = sw;
			const sx = (x - r * m) * dpr, sy = (y - r * m) * dpr;
			ctx.save(); ctx.scale(-1, -1);
			ctx.drawImage(waterCanvas, sx, sy, sw, sh, -r, -r, r * 2, r * 2);
			ctx.restore();
		}
		// the limb: darker toward the rim (the light bends away), the centre clear
		let g = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r);
		g.addColorStop(0, 'rgba(0, 12, 28, 0)'); g.addColorStop(1, 'rgba(0, 12, 28, 0.42)');
		ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
		// the lit arc at the bottom: the surface light refracted through and out
		g = ctx.createRadialGradient(0, r * 0.35, r * 0.2, 0, r * 0.35, r * 0.95);
		g.addColorStop(0, 'rgba(190, 230, 255, 0.28)'); g.addColorStop(1, 'rgba(190, 230, 255, 0)');
		ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
		ctx.restore();

		// the rim: a thin bright ring, thinner and brighter at the top-left where the light hits
		ctx.save();
		ctx.globalAlpha = alpha * cfg.bubbles.rim;
		ctx.translate(x, y); ctx.scale(sq, 1 / sq);
		ctx.lineWidth = Math.max(0.8, r * 0.07);
		const rg = ctx.createLinearGradient(-r, -r, r, r);
		rg.addColorStop(0, 'rgba(235, 248, 255, 0.95)'); rg.addColorStop(0.5, 'rgba(180, 215, 245, 0.45)'); rg.addColorStop(1, 'rgba(220, 240, 255, 0.8)');
		ctx.strokeStyle = rg;
		ctx.beginPath(); ctx.arc(0, 0, r - ctx.lineWidth / 2, 0, Math.PI * 2); ctx.stroke();
		// the specular: one small hot point up and to the left
		ctx.globalAlpha = alpha * 0.85;
		ctx.fillStyle = '#ffffff';
		ctx.beginPath(); ctx.ellipse(-r * 0.42, -r * 0.45, r * 0.16, r * 0.1, -0.7, 0, Math.PI * 2); ctx.fill();
		ctx.restore();
	}
	function drawBubbles(dt, t, push) {
		if (on > 0.05 && t > nextBubble && bubbles.length < cfg.bubbles.max) { spawnBubble(); nextBubble = t + rnd(cfg.bubbles.every[0], cfg.bubbles.every[1]); }
		for (let i = bubbles.length - 1; i >= 0; i--) {
			const b = bubbles[i];
			b.born += dt;
			b.y -= (b.v + push * cfg.bubbles.scrollPush * (0.5 + b.k)) * dt;
			if (b.y < -b.r * 3) { bubbles.splice(i, 1); continue; }
			drawBubble(b, t);
		}
	}

	// ---- input
	const mouse = { x: 0, y: 0 }, lean = { x: 0, y: 0 };
	window.addEventListener('pointermove', (e) => { mouse.x = (e.clientX / W) * 2 - 1; mouse.y = (e.clientY / H) * 2 - 1; }, { passive: true });
	let lastScroll = window.scrollY, push = 0;

	let last = performance.now(), t = 0;
	function frame(now) {
		const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
		lean.x += (mouse.x - lean.x) * Math.min(1, dt * cfg.mouseEase);
		lean.y += (mouse.y - lean.y) * Math.min(1, dt * cfg.mouseEase);
		// the scroll's push: sinking makes everything rise past us, then it settles
		const dy = window.scrollY - lastScroll; lastScroll = window.scrollY;
		push += dy * 0.35; push *= Math.pow(0.02, dt);   // decays over ~1 s
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		if (cfg.enabled && on > 0.002 && !reduced) {
			caustics(t);
			drawMotes(dt, t, push);
			if (cfg.bubbles.enabled) drawBubbles(dt, t, push);
		}
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);

	return { cfg, setPresence(p, P) { on = clamp(p, 0, 1); depth = P; } };
}
