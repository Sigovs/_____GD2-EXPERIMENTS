import * as THREE from 'three';

/*
 * hero-text.js — the hero statement, rendered INSIDE the 3-D scene.
 *
 * It is a textured quad parented to the camera (screen-locked, like the cloud
 * quads), drawn between the middle-ground clouds (renderOrder −1) and the
 * foreground clouds (+1), so the foreground cloud plates genuinely pass in front
 * of the lower lines. Slides up from below on load; on scroll it smears and
 * erodes sideways into the clouds.
 */

export const HERO_TEXT = {
	enabled: true,
	lines: ['THE DEEPER', 'YOU GO,THE', 'MORE YOU', 'KNOW.'],
	font: { family: 'Inter Tight', weight: 800, sizePx: 200, lineHeight: 0.9, tracking: -0.035 },
	color: 0xffffff,
	// placement, as fractions of the viewport (the quad is re-laid out on resize)
	distance: 60,       // units in front of the camera
	left: 0.07,         // block left edge
	top: 0.265,         // block top edge
	height: 0.30,       // block height
	renderOrder: 0.5,   // between the cloud quads: middle-ground −1 … foreground +1
	reveal: { delay: 0.5, duration: 1.7, rise: 0.14 },       // slide in from below; rise = fraction of viewport height
	dissolve: { start: 0.015, end: 0.2, drift: 0.16, blur: 0.035 },  // scroll range; drift/blur as fractions of block width
};

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`;

const fragment = /* glsl */ `
precision highp float;
uniform sampler2D tText, tNoise;
uniform float uTime, uAlpha, uDissolve, uDrift, uBlur;
uniform vec3 uColor;
varying vec2 vUv;

void main() {
	float d = uDissolve;
	// low-frequency cloud noise drives both the sideways smear and the erosion
	float n = texture2D(tNoise, vUv * vec2(1.6, 3.2) + vec2(uTime * 0.012, 0.)).r;
	float n2 = texture2D(tNoise, vUv * vec2(5.0, 9.0) + vec2(-uTime * 0.02, 0.37)).r;
	float w = 0.35 + 0.65 * n;
	vec2 shift = vec2(-d * uDrift * w, 0.);
	// a few taps along x → horizontal streaks as the text is carried into the clouds
	float blur = d * uBlur * w;
	float a = 0.;
	for (int i = -5; i <= 5; i++) {
		a += texture2D(tText, vUv + shift + vec2(float(i) * blur / 5.0, 0.)).a;
	}
	a /= 11.0;
	// the lower lines sink into the cloud first
	float sink = (1.0 - vUv.y) * 0.45 * d;
	float erode = smoothstep(0.0, 1.0, (n * 0.6 + n2 * 0.4) * 1.15 + sink - (1.2 - d * 1.9));
	a *= (1.0 - erode) * (1.0 - smoothstep(0.55, 1.0, d));
	a *= uAlpha;
	if (a < 0.003) discard;
	vec3 color = mix(uColor, vec3(0.90, 0.93, 0.97), d * 0.8);  // cools toward the cloud tone while dissolving
	gl_FragColor = vec4(color, a);
}`;

async function makeTextTexture(cfg) {
	const f = cfg.font;
	const spec = `${f.weight} ${f.sizePx}px "${f.family}"`;
	try { await document.fonts.load(spec); } catch { /* fall back to the stack below */ }
	const family = document.fonts.check(spec) ? `"${f.family}"` : 'system-ui, "Helvetica Neue", Arial, sans-serif';
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	ctx.font = `${f.weight} ${f.sizePx}px ${family}`;
	ctx.letterSpacing = `${f.tracking * f.sizePx}px`;
	const pad = f.sizePx * 0.12;
	const lineH = f.sizePx * f.lineHeight;
	let width = 0;
	cfg.lines.forEach((l) => { width = Math.max(width, ctx.measureText(l).width); });
	canvas.width = Math.ceil(width + pad * 2);
	canvas.height = Math.ceil(lineH * cfg.lines.length + pad * 2);
	ctx.font = `${f.weight} ${f.sizePx}px ${family}`;
	ctx.letterSpacing = `${f.tracking * f.sizePx}px`;
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#fff';
	cfg.lines.forEach((l, i) => ctx.fillText(l, pad, pad + lineH * i + f.sizePx * 0.78));
	const tex = new THREE.CanvasTexture(canvas);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	tex.minFilter = THREE.LinearMipmapLinearFilter;
	return { tex, aspect: canvas.width / canvas.height };
}

export async function createHeroText({ camera, noise, cloudTime }) {
	const cfg = HERO_TEXT;
	const { tex, aspect } = await makeTextTexture(cfg);
	const material = new THREE.ShaderMaterial({
		vertexShader: vertex,
		fragmentShader: fragment,
		uniforms: {
			tText: { value: tex },
			tNoise: { value: noise },
			uTime: cloudTime,
			uAlpha: { value: 0 },
			uDissolve: { value: 0 },
			uDrift: { value: cfg.dissolve.drift },
			uBlur: { value: cfg.dissolve.blur },
			uColor: { value: new THREE.Color(cfg.color) },
		},
		transparent: true,
		depthTest: false,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
	mesh.renderOrder = cfg.renderOrder;
	mesh.frustumCulled = false;
	mesh.visible = cfg.enabled;
	camera.add(mesh);

	const base = { x: 0, y: 0, screenH: 1 };
	function layout() {
		const D = cfg.distance;
		const screenH = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
		const screenW = screenH * camera.aspect;
		const h = cfg.height * screenH, w = h * aspect;
		mesh.scale.set(w, h, 1);
		base.x = -screenW / 2 + cfg.left * screenW + w / 2;
		base.y = screenH / 2 - cfg.top * screenH - h / 2;
		base.screenH = screenH;
		mesh.position.set(base.x, base.y, -D);
	}
	layout();

	let revealT = -cfg.reveal.delay;   // seconds since the reveal started (negative = waiting)
	function update(dt, scrollProgress) {
		if (!mesh.visible) return;
		revealT += dt;
		const k = THREE.MathUtils.clamp(revealT / cfg.reveal.duration, 0, 1);
		const e = 1 - Math.pow(1 - k, 3);           // ease-out cubic
		mesh.position.y = base.y - (1 - e) * cfg.reveal.rise * base.screenH;
		material.uniforms.uAlpha.value = e;
		material.uniforms.uDissolve.value = THREE.MathUtils.smoothstep(scrollProgress, cfg.dissolve.start, cfg.dissolve.end);
	}

	return { mesh, material, update, layout };
}
