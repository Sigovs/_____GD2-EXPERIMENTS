import * as THREE from 'three';

/*
 * hero-text.js — the hero statement, rendered INSIDE the 3-D scene.
 *
 * Each line is its own textured quad parented to the camera (screen-locked,
 * like the cloud quads), drawn between the middle-ground clouds (renderOrder −1)
 * and the foreground clouds (+1), so the foreground cloud plates genuinely pass
 * in front of the lower lines. On load the lines slide in from the left one
 * after another (staircase). In the abyss transition the statement flies up and
 * away into blur like the clouds (setExit, driven by scroll).
 */

export const HERO_TEXT = {
	enabled: true,
	lines: ['THE DEEPER', 'YOU GO,THE', 'MORE YOU', 'KNOW.'],
	font: { family: 'Inter Tight', weight: 800, sizePx: 200, lineHeight: 0.9, tracking: -0.035 },
	color: 0xffffff,
	// placement, as fractions of the viewport (re-laid out on resize)
	distance: 60,       // units in front of the camera
	left: 0.07,         // block left edge
	top: 0.265,         // block top edge
	height: 0.30,       // block height (all lines)
	renderOrder: 0.5,   // between the cloud quads: middle-ground −1 … foreground +1
	// load-in: every line slides in from the left and fades in; the next line starts `stagger` seconds later
	reveal: { delay: 0.5, duration: 1.3, stagger: 0.22, slide: 0.10 },  // slide = fraction of viewport width
	/* Marker highlight on "MORE YOU KNOW." (after the marker-highlight reference: a highlighter stroke springs
	   in from the left across the phrase, the covered text turns to the ink colour). Lines are indexes into
	   `lines`; the stroke runs line after line. The spring is Remotion's (stiffness 100, mass 1) — closed form,
	   so it is a pure function of time and scrubs with setTime(). */
	marker: {
		enabled: true,
		lines: [2, 3],
		color: 0x00ecff,          // the instrument cyan — the site's one accent
		textColor: 0x0b0f1e,      // the covered text takes the GD2 ground ink
		delay: 0.35,              // s after the first marked line has finished sliding in
		gap: 0.42,                // s between one line's stroke start and the next
		damping: 14,
		stiffness: 80,           // the reference's 100 settles in ~0.3 s; a touch slower reads better at this size
		inset: 0.1,               // em — the stroke overhangs the glyphs left and right
		bleed: [0.06, 0.02],      // em — below the baseline / above the cap height
		edge: 0.6,                // px of softness on the stroke's edges
	},
	/* Exit in the abyss transition (Alex, 2026-09-15: "fly away как облака, наверх в blur"): each line rises (the top
	   one leads), grows a little, blurs and frays into noise before it is gone. Driven by ABYSS_TRANSITION.heroTextExit
	   (scroll, reversible); reduced motion: a plain fade in place. */
	exit: {
		rise: 0.55,               // fraction of the viewport height a line travels up
		drift: 0.02,              // … and to the right (viewport widths)
		grow: 0.12,               // scale gained on the way
		stagger: 0.14,            // exit units between one line and the next (top first)
		// the blur is a soft copy of each line, blurred once at load (a real Gaussian: a live mip / 12-tap blur read
		// blocky and noise erosion punched holes in the letters); the exit crossfades sharp → soft
		softTexPx: 60,            // blur sigma in texture px (≈ 22 screen px on a 1440×900 viewport)
		softGain: 1.5,            // the blurred copy's alpha is lifted a little (thin strokes average down)
		expand: [0.16, 0.95],     // quad grown by this much uv on each side (x, y): room for the soft copy to spread
	},
};

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`;

const fragment = /* glsl */ `
precision highp float;
uniform sampler2D tText;
uniform float uAlpha, uMark;          // uMark: 0..1 (spring, may overshoot) — how far the stroke has run
uniform vec2 uMarkX, uMarkY, uMarkPx; // stroke extent in uv (x: start..end, y: bottom..top); uv size of one texture pixel
uniform vec3 uColor, uMarkColor, uMarkTextColor;
uniform sampler2D tSoft;              // the line blurred once at load, with a margin for the spread
uniform vec4 uSoftMap;                // texture uv → soft uv: xy scale, zw offset
uniform vec2 uExpand;                 // the quad is grown by uExpand uv on each side (room for the soft copy)
uniform float uExit, uAspect;         // uExit: 0..1 this line's exit
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
bool outside(vec2 uv) { return uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0; }
void main() {
	vec2 uv = (vUv - 0.5) * (1.0 + 2.0 * uExpand) + 0.5;   // quad uv → texture uv (the margin is empty)
	float ta = outside(uv) ? 0.0 : texture2D(tText, uv, 2.0 * smoothstep(0.0, 0.3, uExit)).a;   // the letters soften a touch …
	if (uExit > 0.0) {
		vec2 su = uv * uSoftMap.xy + uSoftMap.zw;
		float soft = outside(su) ? 0.0 : texture2D(tSoft, su).a;
		ta = mix(ta, soft, smoothstep(0.1, 0.6, uExit));                                       // … then melt into the soft copy
	}
	// the highlighter stroke: a box from the phrase's left edge to uMark of its width, soft-edged by ~a pixel;
	// on the way out it softens and is gone in the first stretch, before the letters
	float markOut = smoothstep(0.0, 0.4, uExit);
	vec2 px = uMarkPx * (1.0 + 40.0 * markOut);
	float right = mix(uMarkX.x, uMarkX.y, clamp(uMark, 0.0, 1.06));
	float inX = smoothstep(uMarkX.x - px.x, uMarkX.x + px.x, uv.x) * (1.0 - smoothstep(right - px.x, right + px.x, uv.x));
	float inY = smoothstep(uMarkY.x - px.y, uMarkY.x + px.y, uv.y) * (1.0 - smoothstep(uMarkY.y - px.y, uMarkY.y + px.y, uv.y));
	float mark = inX * inY * step(0.0001, uMark) * (1.0 - markOut);
	vec3 textCol = mix(uColor, uMarkTextColor, mark);    // covered glyphs take the ink colour
	vec3 col = mix(uMarkColor, textCol, ta);             // glyphs over the stroke
	col = mix(uColor, col, max(mark, ta));               // outside the stroke: plain text colour (alpha does the rest)
	float a = max(ta, mark) * uAlpha;
	// wisps, not holes: the soft shape thins unevenly, like a cloud, as it goes
	if (uExit > 0.0) {
		vec2 q = vec2(uv.x * uAspect, uv.y) * 1.6 + vec2(0.0, -uExit * 0.8);
		float n = vnoise(q) * 0.65 + vnoise(q * 2.3 + 3.1) * 0.35;
		a *= mix(1.0, 0.25 + 0.75 * n, smoothstep(0.3, 1.0, uExit));
	}
	if (a < 0.003) discard;
	gl_FragColor = vec4(col, a);
}`;

/** Separable running-sum box blur on a Float32 alpha buffer (edges clamp); three passes ≈ a Gaussian. */
function boxBlur(a, w, h, r) {
	const tmp = new Float32Array(a.length), inv = 1 / (2 * r + 1);
	for (let y = 0; y < h; y++) {
		const row = y * w;
		let s = 0;
		for (let x = -r; x <= r; x++) s += a[row + Math.min(w - 1, Math.max(0, x))];
		for (let x = 0; x < w; x++) {
			tmp[row + x] = s * inv;
			s += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
		}
	}
	for (let x = 0; x < w; x++) {
		let s = 0;
		for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
		for (let y = 0; y < h; y++) {
			a[y * w + x] = s * inv;
			s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
		}
	}
}

/** One canvas texture per line; all lines share the same height (line box) so they stack evenly. */
async function makeLineTextures(cfg) {
	const f = cfg.font;
	const spec = `${f.weight} ${f.sizePx}px "${f.family}"`;
	try { await document.fonts.load(spec); } catch { /* fall back to the stack below */ }
	const family = document.fonts.check(spec) ? `"${f.family}"` : 'system-ui, "Helvetica Neue", Arial, sans-serif';
	const font = `${f.weight} ${f.sizePx}px ${family}`;
	const tracking = `${f.tracking * f.sizePx}px`;
	const pad = f.sizePx * 0.12;
	const lineH = Math.ceil(f.sizePx * f.lineHeight);
	const measure = document.createElement('canvas').getContext('2d');
	measure.font = font; measure.letterSpacing = tracking;
	return cfg.lines.map((text) => {
		const canvas = document.createElement('canvas');
		canvas.width = Math.ceil(measure.measureText(text).width + pad * 2);
		canvas.height = lineH;
		const ctx = canvas.getContext('2d');
		ctx.font = font; ctx.letterSpacing = tracking;
		ctx.textBaseline = 'alphabetic';
		ctx.fillStyle = '#fff';
		ctx.fillText(text, pad, f.sizePx * 0.78);
		const tex = new THREE.CanvasTexture(canvas);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.anisotropy = 4;
		tex.minFilter = THREE.LinearMipmapLinearFilter;
		// the stroke box in uv: glyph span ± inset horizontally, baseline − bleed .. cap height + bleed vertically
		const m = cfg.marker, capH = 0.73;
		const glyphW = canvas.width - pad * 2;
		// the soft copy for the exit: drawn at 1/4 size with a margin, alpha blurred (3 box passes ≈ Gaussian), upsampled by the GPU
		const ex = cfg.exit, k = 4;
		const mg = Math.ceil(ex.softTexPx * 2.5);                       // margin, full-res px
		const sw = Math.ceil((canvas.width + 2 * mg) / k), sh = Math.ceil((canvas.height + 2 * mg) / k);
		const soft = document.createElement('canvas');
		soft.width = sw; soft.height = sh;
		const sctx = soft.getContext('2d', { willReadFrequently: true });
		sctx.drawImage(canvas, mg / k, mg / k, canvas.width / k, canvas.height / k);
		const img = sctx.getImageData(0, 0, sw, sh), A = new Float32Array(sw * sh);
		for (let i = 0; i < A.length; i++) A[i] = img.data[i * 4 + 3] / 255;
		const sr = Math.max(1, Math.round(ex.softTexPx / k));
		for (let p = 0; p < 3; p++) boxBlur(A, sw, sh, sr);
		for (let i = 0; i < A.length; i++) {
			img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
			img.data[i * 4 + 3] = Math.min(255, A[i] * 255 * ex.softGain);
		}
		sctx.putImageData(img, 0, 0);
		const softTex = new THREE.CanvasTexture(soft);
		softTex.colorSpace = THREE.SRGBColorSpace;
		// texture uv (flipY: v from the bottom) → soft uv; the soft canvas is sw·k × sh·k full-res px
		const SW = sw * k, SH = sh * k;
		const softMap = [canvas.width / SW, canvas.height / SH, mg / SW, (SH - canvas.height - mg) / SH];
		return {
			tex, aspect: canvas.width / canvas.height, padFrac: pad / canvas.width, texH: canvas.height, soft: softTex, softMap,
			markX: [(pad - m.inset * f.sizePx) / canvas.width, (pad + glyphW + m.inset * f.sizePx) / canvas.width],
			markY: [1 - (f.sizePx * (0.78 + m.bleed[0])) / lineH, 1 - (f.sizePx * (0.78 - capH - m.bleed[1])) / lineH],
			px: [m.edge / canvas.width, m.edge / lineH],
		};
	});
}

export async function createHeroText({ camera }) {
	const cfg = HERO_TEXT;
	const textures = await makeLineTextures(cfg);
	const group = new THREE.Group();
	group.name = 'HeroText';
	group.visible = cfg.enabled;
	camera.add(group);

	const lines = textures.map((t) => {
		const material = new THREE.ShaderMaterial({
			vertexShader: vertex,
			fragmentShader: fragment,
			uniforms: {
				tText: { value: t.tex }, uAlpha: { value: 0 }, uColor: { value: new THREE.Color(cfg.color) },
				uMark: { value: 0 }, uMarkX: { value: new THREE.Vector2().fromArray(t.markX) }, uMarkY: { value: new THREE.Vector2().fromArray(t.markY) },
				uMarkPx: { value: new THREE.Vector2().fromArray(t.px) },
				uMarkColor: { value: new THREE.Color(cfg.marker.color) }, uMarkTextColor: { value: new THREE.Color(cfg.marker.textColor) },
				tSoft: { value: t.soft }, uSoftMap: { value: new THREE.Vector4().fromArray(t.softMap) }, uExit: { value: 0 }, uAspect: { value: t.aspect },
				uExpand: { value: new THREE.Vector2().fromArray(cfg.exit.expand) },
			},
			transparent: true, depthTest: false, depthWrite: false,
		});
		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
		mesh.renderOrder = cfg.renderOrder;
		mesh.frustumCulled = false;
		group.add(mesh);
		return { mesh, material, aspect: t.aspect, padFrac: t.padFrac, texH: t.texH, baseX: 0, baseY: 0, w: 1, lineH: 1 };
	});

	const base = { screenW: 1, screenH: 1 };
	const ex = cfg.exit;
	function layout() {
		const D = cfg.distance;
		const screenH = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
		const screenW = screenH * camera.aspect;
		const blockH = cfg.height * screenH;
		const lineH = blockH / lines.length;
		const left = -screenW / 2 + cfg.left * screenW;
		const top = screenH / 2 - cfg.top * screenH;
		lines.forEach((l, i) => {
			const w = lineH * l.aspect;
			l.w = w; l.lineH = lineH;
			// the quad is grown by exit.expand on every side (uv remapped in the shader), so the exit blur has room to spread
			l.mesh.scale.set(w * (1 + 2 * ex.expand[0]), lineH * (1 + 2 * ex.expand[1]), 1);
			// the canvas has padding; shift so the glyphs' left edge sits on the block's left edge
			l.baseX = left + w / 2 - l.padFrac * w;
			l.baseY = top - lineH * (i + 0.5);
			l.mesh.position.set(l.baseX, l.baseY, -D);
		});
		base.screenW = screenW; base.screenH = screenH;
	}
	layout();

	/** Underdamped spring 0 → 1 (mass 1), closed form — Remotion's spring() for the same stiffness / damping. */
	function spring(time, stiffness, damping) {
		if (time <= 0) return 0;
		const w0 = Math.sqrt(stiffness), zeta = damping / (2 * Math.sqrt(stiffness));
		if (zeta >= 1) return 1 - Math.exp(-w0 * time) * (1 + w0 * time);
		const wd = w0 * Math.sqrt(1 - zeta * zeta);
		return 1 - Math.exp(-zeta * w0 * time) * (Math.cos(wd * time) + (zeta * w0 / wd) * Math.sin(wd * time));
	}
	const mk = cfg.marker;
	const markOrder = mk.enabled ? mk.lines.filter((i) => lines[i]) : [];
	// the strokes start after the first marked line has slid in, then one after another
	const markStart = markOrder.length ? markOrder[0] * cfg.reveal.stagger + cfg.reveal.duration + mk.delay : 0;

	let t = -cfg.reveal.delay;   // seconds since the reveal started (negative = waiting)
	let fade = 1;                // external multiplier
	let exit = 0;                // 0..1 — the abyss transition: the statement flies up and away into blur, like the clouds
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	function update(dt) {
		if (!group.visible) return;
		t += dt;
		const still = reducedMotion.matches, n = lines.length;
		lines.forEach((l, i) => {
			const k = THREE.MathUtils.clamp((t - i * cfg.reveal.stagger) / cfg.reveal.duration, 0, 1);
			const e = 1 - Math.pow(1 - k, 3);   // ease-out cubic
			const u = l.material.uniforms;
			// exit: the top line leads, each next one follows exit.stagger behind; the rise accelerates like a lifting cloud
			const x = THREE.MathUtils.clamp(exit * (1 + ex.stagger * (n - 1)) - i * ex.stagger, 0, 1);
			const lift = still ? 0 : Math.pow(x, 1.6);
			const grow = 1 + ex.grow * lift;
			l.mesh.position.x = l.baseX - (1 - e) * cfg.reveal.slide * base.screenW + ex.drift * lift * base.screenW;
			l.mesh.position.y = l.baseY + ex.rise * lift * base.screenH;
			l.mesh.scale.set(l.w * grow * (1 + 2 * ex.expand[0]), l.lineH * grow * (1 + 2 * ex.expand[1]), 1);
			u.uExit.value = still ? 0 : x;                      // the shader melts sharp → soft copy and thins it into wisps
			const out = still ? 1 - x : 1 - THREE.MathUtils.smoothstep(x, 0.55, 1);
			u.uAlpha.value = e * fade * out;
		});
		markOrder.forEach((li, n) => {
			lines[li].material.uniforms.uMark.value = spring(t - markStart - n * mk.gap, mk.stiffness, mk.damping);
		});
	}
	function setFade(f) { fade = f; }
	function setExit(v) { exit = THREE.MathUtils.clamp(v, 0, 1); }

	/** Debug / capture helper: jump the load-in clock to `seconds` after page ready. */
	function setTime(seconds) { t = seconds - cfg.reveal.delay; update(0); }

	return { group, lines, update, layout, setTime, setFade, setExit };
}
