import * as THREE from 'three';

/*
 * hero-text.js — the hero statement, rendered INSIDE the 3-D scene.
 *
 * Each line is its own textured quad parented to the camera (screen-locked,
 * like the cloud quads), drawn between the middle-ground clouds (renderOrder −1)
 * and the foreground clouds (+1), so the foreground cloud plates genuinely pass
 * in front of the lower lines. On load the lines slide up from below one after
 * another (staircase). Nothing happens to the text on scroll.
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
	// load-in: every line rises from below and fades in; the next line starts `stagger` seconds later
	reveal: { delay: 0.5, duration: 1.3, stagger: 0.22, rise: 0.12 },   // rise = fraction of viewport height
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
uniform float uAlpha;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
	float a = texture2D(tText, vUv).a * uAlpha;
	if (a < 0.003) discard;
	gl_FragColor = vec4(uColor, a);
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
		return { tex, aspect: canvas.width / canvas.height, padFrac: pad / canvas.width };
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
			uniforms: { tText: { value: t.tex }, uAlpha: { value: 0 }, uColor: { value: new THREE.Color(cfg.color) } },
			transparent: true, depthTest: false, depthWrite: false,
		});
		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
		mesh.renderOrder = cfg.renderOrder;
		mesh.frustumCulled = false;
		group.add(mesh);
		return { mesh, material, aspect: t.aspect, padFrac: t.padFrac, baseY: 0 };
	});

	const base = { screenH: 1 };
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
			l.baseY = top - lineH * (i + 0.5);
			l.mesh.position.set(left + w / 2 - l.padFrac * w, l.baseY, -D);
		});
		base.screenH = screenH;
	}
	layout();

	let t = -cfg.reveal.delay;   // seconds since the reveal started (negative = waiting)
	function update(dt) {
		if (!group.visible) return;
		t += dt;
		lines.forEach((l, i) => {
			const k = THREE.MathUtils.clamp((t - i * cfg.reveal.stagger) / cfg.reveal.duration, 0, 1);
			const e = 1 - Math.pow(1 - k, 3);   // ease-out cubic
			l.mesh.position.y = l.baseY - (1 - e) * cfg.reveal.rise * base.screenH;
			l.material.uniforms.uAlpha.value = e;
		});
	}

	/** Debug / capture helper: jump the load-in clock to `seconds` after page ready. */
	function setTime(seconds) { t = seconds - cfg.reveal.delay; update(0); }

	return { group, lines, update, layout, setTime };
}
