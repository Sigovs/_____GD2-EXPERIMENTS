import * as THREE from 'three';

/*
 * hero-text.js — the hero statement, rendered INSIDE the 3-D scene.
 *
 * Each line is its own textured quad parented to the camera (screen-locked,
 * like the cloud quads), drawn between the middle-ground clouds (renderOrder −1)
 * and the foreground clouds (+1), so the foreground cloud plates genuinely pass
 * in front of the lower lines. On load the lines slide in from the left one
 * after another (staircase). Nothing happens to the text on scroll.
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
varying vec2 vUv;
void main() {
	float ta = texture2D(tText, vUv).a;
	// the highlighter stroke: a box from the phrase's left edge to uMark of its width, soft-edged by ~a pixel
	float right = mix(uMarkX.x, uMarkX.y, clamp(uMark, 0.0, 1.06));
	float inX = smoothstep(uMarkX.x - uMarkPx.x, uMarkX.x + uMarkPx.x, vUv.x) * (1.0 - smoothstep(right - uMarkPx.x, right + uMarkPx.x, vUv.x));
	float inY = smoothstep(uMarkY.x - uMarkPx.y, uMarkY.x + uMarkPx.y, vUv.y) * (1.0 - smoothstep(uMarkY.y - uMarkPx.y, uMarkY.y + uMarkPx.y, vUv.y));
	float mark = inX * inY * step(0.0001, uMark);
	vec3 textCol = mix(uColor, uMarkTextColor, mark);    // covered glyphs take the ink colour
	vec3 col = mix(uMarkColor, textCol, ta);             // glyphs over the stroke
	col = mix(uColor, col, max(mark, ta));               // outside the stroke: plain text colour (alpha does the rest)
	float a = max(ta, mark) * uAlpha;
	if (a < 0.003) discard;
	gl_FragColor = vec4(col, a);
}`;

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
		return {
			tex, aspect: canvas.width / canvas.height, padFrac: pad / canvas.width,
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
			},
			transparent: true, depthTest: false, depthWrite: false,
		});
		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
		mesh.renderOrder = cfg.renderOrder;
		mesh.frustumCulled = false;
		group.add(mesh);
		return { mesh, material, aspect: t.aspect, padFrac: t.padFrac, baseX: 0 };
	});

	const base = { screenW: 1 };
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
			l.mesh.scale.set(w, lineH, 1);
			// the canvas has padding; shift so the glyphs' left edge sits on the block's left edge
			l.baseX = left + w / 2 - l.padFrac * w;
			l.mesh.position.set(l.baseX, top - lineH * (i + 0.5), -D);
		});
		base.screenW = screenW;
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
	let fade = 1;                // external multiplier (the abyss transition dissolves the statement with the mountain world)
	function update(dt) {
		if (!group.visible) return;
		t += dt;
		lines.forEach((l, i) => {
			const k = THREE.MathUtils.clamp((t - i * cfg.reveal.stagger) / cfg.reveal.duration, 0, 1);
			const e = 1 - Math.pow(1 - k, 3);   // ease-out cubic
			l.mesh.position.x = l.baseX - (1 - e) * cfg.reveal.slide * base.screenW;
			l.material.uniforms.uAlpha.value = e * fade;
		});
		markOrder.forEach((li, n) => {
			lines[li].material.uniforms.uMark.value = spring(t - markStart - n * mk.gap, mk.stiffness, mk.damping);
		});
	}
	function setFade(f) { fade = f; }

	/** Debug / capture helper: jump the load-in clock to `seconds` after page ready. */
	function setTime(seconds) { t = seconds - cfg.reveal.delay; update(0); }

	return { group, lines, update, layout, setTime, setFade };
}
