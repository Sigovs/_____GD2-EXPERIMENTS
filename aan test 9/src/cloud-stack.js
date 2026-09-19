import * as THREE from 'three';

/*
 * cloud-stack.js — clouds over the film, built as LAYERS, not plates.
 *
 * The plate rig (cloud-layer.js) drew nine rectangles wider than the screen; every straight
 * bound in them — core, floor cut, hold — was a line across the frame. This has no plates:
 * each layer is one full-screen quad whose alpha is a pure noise field (fbm) shaped by a soft
 * vertical band. There is no edge to show, at any size, at any scroll position.
 *
 *   layer  = { scale, speed, band, width, opacity, parallax, lit, shade }
 *   mouse  → each layer slides by its parallax (near layers more) — depth without geometry
 *   scroll → the bands rise and thin (`rise`, `thin`), so the film's own clouds take over below
 *   time   → the fields drift slowly; two octaves drift against each other so nothing loops visibly
 *
 * Colour: lit / shade per layer, mixed by the field's density — the film's night light, not day.
 */

export const CLOUD_STACK = {
	enabled: true,
	layers: [
		//  scale   speed  band   width  opacity parallax  lit       shade
		{ scale: 1.0,  speed: 0.010, band: 0.16, width: 0.34, opacity: 0.65, parallax: 0.010, lit: 0xb9c6d6, shade: 0x1a2431 },   // far: the wide bank at the foot
		{ scale: 1.6,  speed: 0.016, band: 0.22, width: 0.28, opacity: 0.75, parallax: 0.022, lit: 0xcfd9e5, shade: 0x1f2a38 },   // mid
		{ scale: 2.4,  speed: 0.024, band: 0.30, width: 0.22, opacity: 0.75, parallax: 0.040, lit: 0xe0e7ee, shade: 0x26313e },   // near
		{ scale: 3.6,  speed: 0.036, band: 0.40, width: 0.16, opacity: 0.50, parallax: 0.065, lit: 0xeef2f6, shade: 0x2b3542 },   // nearest: wisps rising past the shoulder
	],
	coverage: 0.50,          // 0..1 — how much of the field reads as cloud (lower = more sky)
	softness: 0.12,          // width of the cloud edge in field units (higher = mistier)
	// scroll choreography (0..1 of the page)
	rise: [[0, 0], [1, 0.55]],          // bands move up by this much of the frame
	thin: [[0, 0], [0.5, 0.15], [1, 0.7]],
	mouseEase: 2.4,
};

const keys = (k, t) => {
	if (t <= k[0][0]) return k[0][1];
	for (let i = 1; i < k.length; i++) if (t <= k[i][0]) { const [t0, v0] = k[i - 1], [t1, v1] = k[i]; return v0 + (v1 - v0) * THREE.MathUtils.smoothstep(t, t0, t1); }
	return k[k.length - 1][1];
};

const vertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const fragment = /* glsl */ `
precision highp float;
uniform sampler2D tNoise;   // assets/textures/cloud-noise.png — four independent tiling fbm fields in r,g,b,a
uniform float uTime, uScale, uSpeed, uBand, uWidth, uOpacity, uCoverage, uSoft, uAspect, uThin, uRise;
uniform vec2 uShift;
uniform vec3 uLit, uShade;
varying vec2 vUv;

// the cloud field: one big shape (r), folded by a slow warp (b, a), with finer detail (g) drifting against it
float field(vec2 p, float t) {
	vec2 warp = vec2(texture2D(tNoise, p * 0.55 + vec2(t * 0.4, 0.0)).b, texture2D(tNoise, p * 0.55 - vec2(0.0, t * 0.3)).a) - 0.5;
	float big = texture2D(tNoise, p + warp * 0.28 + vec2(t, -t * 0.2)).r;
	float fine = texture2D(tNoise, p * 2.7 + warp * 0.15 - vec2(t * 0.6, t * 0.4)).g;
	return big * 0.72 + fine * 0.28;
}

void main() {
	vec2 uv = vUv;
	vec2 p = (uv - 0.5) * vec2(uAspect, 1.0) * uScale * 0.22 + uShift;
	float t = uTime * uSpeed;
	float f = field(p, t);
	float density = smoothstep(uCoverage - uSoft, uCoverage + uSoft, f);
	density *= 0.6 + 0.4 * smoothstep(uCoverage, uCoverage + 0.2, f);   // dense hearts, thin skirts

	// the band: where in the frame this layer lives (0 = bottom, 1 = top), soft above and below,
	// its centre pushed by the field so the band's own limits are never a line
	float centre = uBand + uRise + (f - 0.5) * 0.3;
	float band = 1.0 - smoothstep(0.0, uWidth, abs(uv.y - centre));
	band = pow(band, 0.7);

	float alpha = density * band * uOpacity * (1.0 - uThin);
	// light: the tops catch the moon — where the field is denser than just above it — the hearts stay in shade
	float above = field(p + vec2(0.0, 0.03), t);
	float lit = clamp((f - above) * 9.0 + 0.55, 0.0, 1.0);
	vec3 col = mix(uShade, uLit, lit * 0.85 + 0.1);
	gl_FragColor = vec4(col, alpha);
}`;

export function createCloudStack({ canvas, noise, cfg = CLOUD_STACK }) {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
	renderer.setClearAlpha(0);
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	const scene = new THREE.Scene();
	const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	const geo = new THREE.PlaneGeometry(2, 2);

	const layers = cfg.layers.map((l, i) => {
		const mat = new THREE.ShaderMaterial({
			vertexShader: vertex, fragmentShader: fragment,
			uniforms: {
				tNoise: { value: noise }, uTime: { value: i * 37.0 },
				uScale: { value: l.scale }, uSpeed: { value: l.speed }, uBand: { value: l.band }, uWidth: { value: l.width },
				uOpacity: { value: l.opacity }, uCoverage: { value: cfg.coverage }, uSoft: { value: cfg.softness },
				uAspect: { value: 1 }, uThin: { value: 0 }, uRise: { value: 0 },
				uShift: { value: new THREE.Vector2(i * 1.7, i * 0.9) },
				uLit: { value: new THREE.Color(l.lit) }, uShade: { value: new THREE.Color(l.shade) },
			},
			transparent: true, depthTest: false, depthWrite: false,
		});
		const mesh = new THREE.Mesh(geo, mat);
		mesh.renderOrder = i;
		mesh.frustumCulled = false;
		scene.add(mesh);
		return { cfg: l, mat, base: new THREE.Vector2(i * 1.7, i * 0.9) };
	});

	const mouse = new THREE.Vector2(), lerped = new THREE.Vector2();
	window.addEventListener('pointermove', (e) => { mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); }, { passive: true });

	function resize() {
		const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 1.5);
		renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
		layers.forEach((l) => { l.mat.uniforms.uAspect.value = w / h; });
	}
	addEventListener('resize', resize); resize();

	let progress = 0;
	function setProgress(p) { progress = THREE.MathUtils.clamp(p, 0, 1); }

	let last = performance.now();
	function frame(now) {
		const dt = Math.min(0.1, (now - last) / 1000); last = now;
		lerped.lerp(mouse, dt * cfg.mouseEase);
		const rise = keys(cfg.rise, progress), thin = keys(cfg.thin, progress);
		layers.forEach((l) => {
			const u = l.mat.uniforms;
			u.uTime.value += dt;
			u.uRise.value = rise;
			u.uThin.value = thin;
			u.uShift.value.set(l.base.x - lerped.x * l.cfg.parallax, l.base.y - lerped.y * l.cfg.parallax * 0.6);
		});
		renderer.render(scene, camera);
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);

	return { renderer, layers, setProgress, cfg, setIntro() {} };
}
