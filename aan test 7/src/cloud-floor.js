import * as THREE from 'three';

/*
 * cloud-floor.js — a world-fixed "cloud sea" under the mountain.
 *
 * The nine camera-relative cloud quads were laid out for the hero angle; when the
 * camera flies in, drops or is dragged, their borders and the mountain's cut base
 * come into view. This adds a few large, soft, noisy discs around the summit axis
 * that do NOT turn with the camera: the mountain grows out of them, everything
 * below their level (base plate, route end, far peak feet) is swallowed, and they
 * are drawn before the existing clouds so the hero frame looks the same.
 *
 * Layers are depth-tested against the mountain; the bottom layer writes depth so
 * things beneath it (route, markers) disappear into it.
 */

export const CLOUD_FLOOR = {
	enabled: true,
	radius: 340,                 // world units around the summit axis (kept short so the sea dissolves before the horizon)
	segments: 140,               // grid subdivisions (the surface is displaced by noise, so it needs vertices)
	bumpHeight: 4.0,             // world units of vertical lumpiness
	colorDark: 0xcbd5de,         // troughs (matches the cloud quads' shadow tone)
	colorLight: 0xeef2f6,        // crests
	rimFadeStart: 0.38,          // 0..1 of radius where the edge starts to dissolve
	viewFade: [150, 300],        // world distance from the camera over which the sea dissolves (keeps the far horizon dark, as in the hero)
	// top → bottom. y: world height. coverage: 0 = holes everywhere, 1 = solid.
	layers: [
		{ y: -4,  coverage: 0.36, opacity: 0.9,  scale: 0.012, softness: 0.24, seed: 0.0, depthWrite: false },
		{ y: -8,  coverage: 0.62, opacity: 0.95, scale: 0.008, softness: 0.22, seed: 3.1, depthWrite: false },
		{ y: -13, coverage: 1.00, opacity: 1.00, scale: 0.005, softness: 0.18, seed: 7.7, depthWrite: true },
	],
};

const vertex = /* glsl */ `
uniform sampler2D tNoise;
uniform float uTime, uScale, uSeed, uBump;
uniform vec2 uCenter;
varying vec3 vWorld;
varying vec2 vUv;
void main() {
	vUv = uv;
	vec4 w = modelMatrix * vec4(position, 1.);
	vec2 p = (w.xz - uCenter) * uScale + uSeed;
	float t = uTime * 0.02;
	float h = texture2D(tNoise, p * 0.7 + vec2(t, -t * 0.6)).r - 0.5;
	w.y += h * uBump;
	vWorld = w.xyz;
	gl_Position = projectionMatrix * viewMatrix * w;
}`;

const fragment = /* glsl */ `
precision highp float;
uniform sampler2D tNoise, tPerlin;
uniform float uTime, uCoverage, uOpacity, uScale, uSoftness, uSeed, uRadius, uRimFade, uBump;
uniform float uDusk;            // transition: 0 = hero sea, 1 = cooled to uDuskColor
uniform vec2 uCenter, uViewFade;
uniform vec3 uColorDark, uColorLight, uDuskColor;
uniform float uGlow;            // transition: cold light from the ocean below, strongest near the camera
uniform vec3 uGlowColor;
varying vec3 vWorld;
varying vec2 vUv;

void main() {
	vec2 p = (vWorld.xz - uCenter) * uScale + uSeed;
	float t = uTime * 0.02;
	// three octaves of the scene noise, drifting in different directions
	float n = texture2D(tNoise, p + vec2(t, -t * 0.6)).r * 0.55
	        + texture2D(tNoise, p * 2.3 + vec2(-t * 0.8, t * 0.5) + 0.37).r * 0.3
	        + texture2D(tPerlin, p * 5.1 + vec2(t * 0.3, t * 0.9)).r * 0.15;
	float thr = 1.0 - uCoverage;                          // coverage 1 → threshold 0 → solid
	float a = smoothstep(thr - uSoftness, thr + uSoftness, n);
	float d = length(vWorld.xz - uCenter) / uRadius;
	a *= smoothstep(1.0, uRimFade, d);
	a *= smoothstep(uViewFade.y, uViewFade.x, distance(vWorld, cameraPosition));
	a *= uOpacity;
	if (a < 0.015) discard;
	// crests lighter, troughs darker; a touch of extra shadow where the layer is thin
	vec3 color = mix(uColorDark, uColorLight, smoothstep(0.25, 0.85, n));
	color *= 0.96 + 0.04 * a;
	color = mix(color, uDuskColor * (0.8 + 0.4 * smoothstep(0.25, 0.85, n)), uDusk * 0.9);
	float nearK = 1.0 - smoothstep(60.0, 260.0, distance(vWorld, cameraPosition));
	color = mix(color, uGlowColor * 1.1, clamp(uGlow * nearK * (0.35 + 0.65 * smoothstep(0.2, 0.8, n)), 0.0, 0.8));
	gl_FragColor = vec4(color, a);
}`;

export function createCloudFloor({ pivot, noise, perlin, cloudTime }) {
	const cfg = CLOUD_FLOOR;
	const group = new THREE.Group();
	group.name = 'CloudFloor';
	group.visible = cfg.enabled;
	const geometry = new THREE.PlaneGeometry(cfg.radius * 2, cfg.radius * 2, cfg.segments, cfg.segments).rotateX(-Math.PI / 2);
	const layers = cfg.layers.map((l, i) => {
		const material = new THREE.ShaderMaterial({
			vertexShader: vertex,
			fragmentShader: fragment,
			uniforms: {
				tNoise: { value: noise },
				tPerlin: { value: perlin },
				uTime: cloudTime,
				uCoverage: { value: l.coverage },
				uOpacity: { value: l.opacity },
				uScale: { value: l.scale },
				uSoftness: { value: l.softness },
				uSeed: { value: l.seed },
				uRadius: { value: cfg.radius },
				uRimFade: { value: cfg.rimFadeStart },
				uBump: { value: cfg.bumpHeight * (1 - i * 0.25) },
				uCenter: { value: new THREE.Vector2(pivot.x, pivot.z) },
				uViewFade: { value: new THREE.Vector2().fromArray(cfg.viewFade) },
				uColorDark: { value: new THREE.Color(cfg.colorDark) },
				uColorLight: { value: new THREE.Color(cfg.colorLight) },
				uDusk: { value: 0 },
				uDuskColor: { value: new THREE.Color(0x28364c) },
				uGlow: { value: 0 },
				uGlowColor: { value: new THREE.Color(0x2f6fbf) },
			},
			transparent: true,
			depthTest: true,
			depthWrite: !!l.depthWrite,
			side: THREE.DoubleSide,
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(pivot.x, l.y, pivot.z);
		mesh.renderOrder = -3 + i * 0.01;   // before the far peak (-2), the cloud quads (-1 / +1) and the route (0)
		mesh.frustumCulled = false;
		mesh.name = `CloudFloor.${i}`;
		group.add(mesh);
		return mesh;
	});
	return { group, layers };
}
