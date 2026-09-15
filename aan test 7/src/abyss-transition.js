import * as THREE from 'three';

/*
 * abyss-transition.js — the structural test of the hand-off from the mountain
 * world to the abyss below (no canyon video yet).
 *
 * The page gets a tail after the descent. Over that tail:
 *   • the camera tilts and sinks, so the mountain leaves through the top of the
 *     frame while keeping its size (descent, not retreat), and eases a touch back;
 *   • the camera-relative cloud quads cool and darken from the bottom up, the
 *     cloud sea does the same and opens a rupture around the summit axis;
 *   • the chasm-edge layer (split1.png on a quad in the cloud rig, so it faces the
 *     camera and turns with a hand drag) rises from below into the rupture, with a
 *     cold rim on its lower edge;
 *   • a deep-blue placeholder glow sits farther down and rises more slowly, so the
 *     three planes (clouds / chasm edge / abyss) part in parallax.
 * Everything is a pure function of the smoothed scroll value.
 */

export const ABYSS_TRANSITION = {
	enabled: true,
	/* Page layout: total viewport heights, of which the first `descentShare` carry the
	   existing descent choreography unchanged; the rest is the transition. */
	totalViewports: 13,
	descentShare: 9 / 13,

	/* Camera (added on top of the descent choreography), keyed by transition progress 0..1 */
	camera: {
		lookDrop: [[0, 0], [0.5, -80], [1, -190]],    // world units: the look-at sinks → the mountain exits through the top
		camDrop:  [[0, 0], [0.5, -16], [1, -40]],     // the camera itself sinks a little
		zoomMul:  [[0, 1], [1, 1.08]],                 // "slightly farther back"; still inside the responsive clamp
	},

	/* Chasm-edge layer (split1.png) — placed in the cloud rig, in rig-local units */
	split: {
		file: 'assets/split/split1.png',
		width: 360,                                    // world units (height follows the image aspect)
		distanceFraction: 0.5,                         // 0 = at the summit axis, 1 = at the camera — how far forward it sits
		yFrom: -220, yTo: -100,                        // rises into the frame over the transition
		rise: [[0, 0], [0.25, 0.05], [0.7, 0.8], [1, 1]],
		fadeIn: [[0.35, 0], [0.65, 1]],                // appears once the sea has ruptured (it is drawn without depth test)
		rimColor: 0x3f86e0,                            // cold light from the abyss relighting the ridge crest (applied where the plate is already lit)
		rimStrength: 2.2,
		rimHeight: 0.3,                                // image-height fraction below which the relight fades out (the dark body stays dark)
		tint: 0xc4d2e6,                                // slight cooling of the rock itself
	},

	/* Placeholder abyss light: a soft deep-blue disc far below, behind the chasm edge */
	abyss: {
		size: 520,
		distanceFraction: 0.3,
		yFrom: -260, yTo: -130,
		rise: [[0, 0], [0.4, 0.2], [1, 1]],
		strength: [[0, 0], [0.25, 0], [0.6, 0.7], [1, 1]],
		color: 0x1550a8,
		coreColor: 0x4aa2ff,
		floorColor: 0x070b16,                          // the void under everything (the sky cylinder has no bottom cap)
	},

	/* Clouds: cooling from the bottom up (camera-relative quads) and the sea's rupture */
	clouds: {
		dusk: [[0, 0], [0.2, 0.12], [0.7, 0.8], [1, 1]],    // 0 = day clouds, 1 = fully cold
		duskColor: 0x1c2a44,                                // the cold, dark cloud tone
		duskThin: 0.85,                                     // the cooled plates also thin out (0 = keep density, 1 = vanish)
		duskBand: [-160, 140],                              // world y where the cooling starts (bottom) and ends (top) at dusk = 1
		seaHole: [[0, 0], [0.15, 0], [0.6, 170], [1, 230]], // radius of the rupture in the cloud sea, world units
		seaHoleOffset: 120,                                 // the rupture opens on the camera's side of the summit axis (world units toward the camera)
		seaCollar: 150,                                     // the sea always stays solid this close to the axis (hides the mountain's cut base)
		seaDusk: [[0, 0], [0.25, 0.2], [0.8, 1], [1, 1]],
	},

	/* The callouts and the hero statement belong to the mountain world: they dissolve over the first part of the tail */
	labelFade: [[0, 1], [0.3, 0]],
	heroTextFade: [[0.05, 1], [0.4, 0]],
};

function keys(k, t) {
	if (t <= k[0][0]) return k[0][1];
	for (let i = 1; i < k.length; i++) if (t <= k[i][0]) {
		const [t0, v0] = k[i - 1], [t1, v1] = k[i];
		return v0 + (v1 - v0) * THREE.MathUtils.smoothstep(t, t0, t1);
	}
	return k[k.length - 1][1];
}

const splitVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

const splitFragment = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
uniform float uAlpha, uRimStrength, uRimHeight;
uniform vec3 uRim, uTint;
varying vec2 vUv;
void main() {
	vec4 t = texture2D(tMap, vUv);
	float a = t.a * uAlpha * smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);   // no hard side seams
	if (a < 0.004) discard;
	vec3 c = t.rgb * uTint;
	// cold light from the abyss: relights the already-lit ridge crest, leaves the dark body dark
	float lum = clamp(dot(t.rgb, vec3(0.3, 0.5, 0.2)) * 4.0, 0.0, 1.0);
	float rim = lum * smoothstep(uRimHeight - 0.15, uRimHeight + 0.15, vUv.y) * uRimStrength;
	c += uRim * rim;
	gl_FragColor = vec4(c, a);
}`;

const abyssFragment = /* glsl */ `
precision highp float;
uniform float uStrength;
uniform vec3 uColor, uCore;
varying vec2 vUv;
void main() {
	vec2 p = (vUv - 0.5) * vec2(1.0, 1.35);
	float d = length(p);
	float g = exp(-d * d * 9.0);
	float core = exp(-d * d * 40.0);
	vec3 c = uColor * g + uCore * core * 0.6;
	float a = (g * 0.9 + core * 0.4) * uStrength;
	if (a < 0.003) discard;
	gl_FragColor = vec4(c, a);
}`;

export function createAbyssTransition({ cloudRig, pivot, cameraOffset, textureLoader }) {
	const cfg = ABYSS_TRANSITION;
	// direction from the summit axis toward the camera, in rig-local space (the rig turns with the camera)
	const toCam = new THREE.Vector3(cameraOffset.x, 0, cameraOffset.z);
	const camDist = toCam.length();
	toCam.normalize();

	const splitTex = textureLoader.load(cfg.split.file);
	splitTex.colorSpace = THREE.SRGBColorSpace;
	splitTex.anisotropy = 4;
	const splitMat = new THREE.ShaderMaterial({
		vertexShader: splitVertex, fragmentShader: splitFragment,
		uniforms: {
			tMap: { value: splitTex }, uAlpha: { value: 0 },
			uRim: { value: new THREE.Color(cfg.split.rimColor) }, uRimStrength: { value: cfg.split.rimStrength }, uRimHeight: { value: cfg.split.rimHeight },
			uTint: { value: new THREE.Color(cfg.split.tint) },
		},
		// no depth test: the plate rises from under the cloud sea (whose bottom layer writes depth) and must show through the rupture
		transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
	});
	const splitH = cfg.split.width * (1143 / 1920);
	const split = new THREE.Mesh(new THREE.PlaneGeometry(cfg.split.width, splitH), splitMat);
	split.name = 'ChasmEdge';
	split.renderOrder = -2.5;   // after the cloud sea (−3…) so it shows through the rupture, before the peaks / route
	split.frustumCulled = false;
	split.visible = false;

	const abyssMat = new THREE.ShaderMaterial({
		vertexShader: splitVertex, fragmentShader: abyssFragment,
		uniforms: { uStrength: { value: 0 }, uColor: { value: new THREE.Color(cfg.abyss.color) }, uCore: { value: new THREE.Color(cfg.abyss.coreColor) } },
		transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	});
	const abyss = new THREE.Mesh(new THREE.PlaneGeometry(cfg.abyss.size, cfg.abyss.size * 0.8), abyssMat);
	abyss.name = 'AbyssLight';
	abyss.renderOrder = -2.4;   // right after the chasm edge: the light sits inside the bowl
	abyss.frustumCulled = false;
	abyss.visible = false;

	// the void: a camera-following dark disc far below (the sky cylinder is open at the bottom → the clear colour would show)
	const floor = new THREE.Mesh(
		new THREE.CircleGeometry(900, 48).rotateX(-Math.PI / 2),
		new THREE.MeshBasicMaterial({ color: cfg.abyss.floorColor, depthWrite: false, depthTest: false }),
	);
	floor.name = 'AbyssFloor';
	floor.renderOrder = -9;     // right after the sky (−10)
	floor.frustumCulled = false;
	floor.visible = false;
	floor.onBeforeRender = (_r, _s, cam) => { floor.position.set(cam.position.x, cam.position.y - 350, cam.position.z); floor.updateMatrixWorld(); };

	// both face the camera: the rig's local +X/+Z toward the camera; the planes' normal points at the camera
	for (const m of [split, abyss]) {
		cloudRig.add(m);
		m.lookAt(toCam.clone().multiplyScalar(1000));
	}

	const state = { t: 0, lookDrop: 0, camDrop: 0, zoomMul: 1, dusk: 0, seaHole: 0, seaDusk: 0, abyssLight: 0, labelFade: 1, heroTextFade: 1 };
	const holeCenter = new THREE.Vector2();
	/** World xz of the sea rupture for the current total orbit angle (it stays on the camera's side of the axis). */
	function seaHoleCenter(totalAngle) {
		const v = toCam.clone().multiplyScalar(cfg.clouds.seaHoleOffset).applyAxisAngle(THREE.Object3D.DEFAULT_UP, totalAngle);
		return holeCenter.set(pivot.x + v.x, pivot.z + v.z);
	}

	function update(transitionProgress) {
		const t = THREE.MathUtils.clamp(transitionProgress, 0, 1);
		state.t = t;
		state.lookDrop = keys(cfg.camera.lookDrop, t);
		state.camDrop = keys(cfg.camera.camDrop, t);
		state.zoomMul = keys(cfg.camera.zoomMul, t);
		state.dusk = keys(cfg.clouds.dusk, t);
		state.seaHole = keys(cfg.clouds.seaHole, t);
		state.seaDusk = keys(cfg.clouds.seaDusk, t);
		state.abyssLight = keys(cfg.abyss.strength, t);
		state.labelFade = keys(cfg.labelFade, t);
		state.heroTextFade = keys(cfg.heroTextFade, t);

		const active = t > 0.001;
		split.visible = abyss.visible = floor.visible = active && cfg.enabled;
		if (!active) return;

		const sd = toCam.clone().multiplyScalar(camDist * cfg.split.distanceFraction);
		const sy = THREE.MathUtils.lerp(cfg.split.yFrom, cfg.split.yTo, keys(cfg.split.rise, t));
		split.position.set(sd.x, sy, sd.z);
		splitMat.uniforms.uAlpha.value = keys(cfg.split.fadeIn, t);
		splitMat.uniforms.uRimStrength.value = cfg.split.rimStrength * state.abyssLight;

		const ad = toCam.clone().multiplyScalar(camDist * cfg.abyss.distanceFraction);
		const ay = THREE.MathUtils.lerp(cfg.abyss.yFrom, cfg.abyss.yTo, keys(cfg.abyss.rise, t));
		abyss.position.set(ad.x, ay, ad.z);
		abyssMat.uniforms.uStrength.value = state.abyssLight;
	}

	return { split, abyss, floor, state, update, seaHoleCenter, cfg };
}
