import * as THREE from 'three';

/*
 * hero-text.js — the hero statement, rendered INSIDE the 3-D scene.
 *
 * It is a textured quad parented to the camera (screen-locked, like the cloud
 * quads), drawn between the middle-ground clouds (renderOrder −1) and the
 * foreground clouds (+1), so the foreground cloud plates genuinely pass in front
 * of the lower lines. Slides up from below on load; on scroll it wipes to
 * transparency left → right, line by line in a staircase.
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
	// on scroll: a wipe to transparency that travels left → right, staggered per line ("staircase")
	dissolve: { start: 0.015, end: 0.2, stairStep: 0.16, softness: 0.025, driftRight: 0.05 },
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
uniform float uAlpha, uDissolve, uLines, uStair, uSoft, uDrift;
uniform vec3 uColor;
varying vec2 vUv;

void main() {
	float d = uDissolve;
	// line index from the top (0 = first line); each line starts its wipe a little later
	float line = floor((1.0 - vUv.y) * uLines);
	float lead = uStair * line;
	float total = 1.0 + uStair * (uLines - 1.0) + 2.0 * uSoft;
	float front = d * total - lead - uSoft;                 // wipe front in block-x for this line
	float wipe = smoothstep(front - uSoft, front + uSoft, vUv.x);   // left of the front → transparent
	vec2 uv = vUv - vec2(d * uDrift, 0.);                   // the text slides a touch to the right as it goes
	float a = texture2D(tText, uv).a * wipe * uAlpha;
	if (a < 0.003) discard;
	gl_FragColor = vec4(uColor, a);
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
			uAlpha: { value: 0 },
			uDissolve: { value: 0 },
			uLines: { value: cfg.lines.length },
			uStair: { value: cfg.dissolve.stairStep },
			uSoft: { value: cfg.dissolve.softness },
			uDrift: { value: cfg.dissolve.driftRight },
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
