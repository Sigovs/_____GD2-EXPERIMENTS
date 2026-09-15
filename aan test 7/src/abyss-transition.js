import * as THREE from 'three';

/*
 * abyss-transition.js — the hand-off from the mountain world to the canyon / ocean
 * (assets/videos/canyon-a.mp4), after the storyboard:
 *
 *   01  mountain dominant, the rocky chasm edge (split1.png) enters from below,
 *       the lower clouds start to cool;
 *   02  mountain in the upper part, the chasm edge frames the lower part, the
 *       canyon video is clearly visible through the opening;
 *   03  the mountain world has left through the TOP, the canyon is the scene,
 *       the chasm edge is only rocky framing.
 *
 * How it is built (2.5-D layers, each at its own depth in front of the camera):
 *   • the camera TRANSLATES down (position and look-at by the same amount, tiny
 *     zoom-out) — the hero view angle never changes, so the mountain slides out
 *     through the top at its size and its cut base is never seen from below;
 *   • the cloud rig follows most of that drop (`cloudFollow`): the plates linger
 *     as a cooling, thinning haze that keeps hiding the mountain's base;
 *   • the world-fixed cloud sea fades out before the camera passes its level;
 *   • the chasm edge and the video are billboards placed every frame at fixed
 *     distances in front of the camera; their vertical position is choreographed
 *     in FRAME HEIGHTS at their own depth (0 = frame centre, +0.5 = top edge),
 *     so the parallax reads as mountain (slowest) / video (deeper) / edge (fastest).
 * Everything is a pure function of the smoothed scroll value.
 */

export const ABYSS_TRANSITION = {
	enabled: true,
	/* Page layout: total viewport heights; the first `descentShare` carry the existing descent unchanged. */
	totalViewports: 13,
	descentShare: 9 / 13,

	/* Camera: vertical translation added to the descent choreography (world units) and a small zoom-out */
	camera: {
		drop:    [[0, 0], [0.25, -5], [0.55, -22], [0.8, -62], [1, -125]],   // ≈ 0.2 frame heights per 25 units at the mountain's depth
		zoomMul: [[0, 1], [1, 1.06]],
		cloudFollow: 0.5,            // how much of the drop the cloud rig follows (1 = plates screen-locked, 0 = they leave with the mountain)
	},

	/* Chasm edge — split1.png billboard. `rimY`: the ridge crest in frame heights at its depth (0 = centre, +0.5 = top edge).
	   The crest never drops below the mountain's base line + `rimAboveBase`, so the rocks hide the cut base once the sea is gone. */
	split: {
		file: 'assets/split/split1.png',
		distance: 80,                // world units in front of the camera
		widthFrames: 1.12,           // plate width in frame WIDTHS at that depth (> 1 so its sides never show)
		rimUv: 0.68,                 // where the crest sits in the image (uv.y from the bottom)
		rimY: [[0, -0.62], [0.2, -0.3], [0.55, -0.05], [0.8, 0.2], [1, 0.45]],
		rimAboveBase: 0.06,
		baseY: -6,                   // world y of the mountain's cut base (the sea's top layer sits at −4)
		baseRadius: 95,              // footprint radius around the summit axis — the lowest projected point of that circle is the base line
		opacity: [[0, 1], [0.7, 1], [1, 0.4]],   // ends as subtle framing, the canyon shows through
		bodyOpacity: 0.6,            // the dark body under the crest is this opaque at its darkest (the canyon shows through it)
		tint: 0xb9c6d8,              // cools the rock a touch
		crestLight: 0x5d8fd6,        // cold light on the already-lit ridge crest (from the canyon below)
		crestStrength: [[0, 0.3], [0.55, 0.9], [1, 1.2]],
	},

	/* Canyon / ocean video billboard, deeper than the edge */
	video: {
		file: 'assets/videos/canyon-a.mp4',
		distance: 150,
		widthFrames: 1.25,
		aspect: 16 / 9,
		frameY: [[0, -1.0], [0.2, -0.72], [0.55, -0.32], [0.8, -0.15], [1, -0.05]],   // the light shaft (top-centre of the video) rises into the opening
		opacity: [[0.02, 0], [0.2, 0.65], [0.5, 1], [1, 1]],   // already there as the edge rises, fully clear by the overlap
		edgeFeather: 0.16,           // soft border (uv units) so the plate never shows a hard edge
		hazeColor: 0x1a2436,         // atmosphere the video surfaces from (blended in where opacity is low)
	},

	/* Clouds: the plates cool from the bottom up and thin into haze; the sea fades before the camera passes it */
	clouds: {
		dusk: [[0, 0], [0.2, 0.2], [0.6, 0.85], [0.8, 1], [1, 1]],
		duskColor: 0x28364c,         // blue-grey, not black — storyboard 03's fog
		duskBand: [-80, 120],        // world y (rig-relative, the rig follows the camera): cold below, hero above at dusk = 1
		duskThin: 0.85,              // plates lose this much density at full dusk — they stay as haze
		seaFade: [[0, 1], [0.25, 1], [0.5, 0]],   // gone before the camera passes its level; by then the chasm edge covers the base
	},

	/* Callouts and hero statement belong to the mountain world */
	labelFade: [[0, 1], [0.3, 0]],
	heroTextFade: [[0.05, 1], [0.4, 0]],
	floorColor: 0x05070d,          // the void under everything (the sky cylinder is open at the bottom)
};

function keys(k, t) {
	if (t <= k[0][0]) return k[0][1];
	for (let i = 1; i < k.length; i++) if (t <= k[i][0]) {
		const [t0, v0] = k[i - 1], [t1, v1] = k[i];
		return v0 + (v1 - v0) * THREE.MathUtils.smoothstep(t, t0, t1);
	}
	return k[k.length - 1][1];
}

const plateVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

const splitFragment = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
uniform float uAlpha, uCrest, uBody, uRimUv;
uniform vec3 uCrestColor, uTint;
varying vec2 vUv;
void main() {
	vec4 t = texture2D(tMap, vUv);
	float a = t.a * uAlpha * smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x);
	// the body below the crest thins toward its lower fade so the canyon reads through it (and the fade start has no shelf)
	a *= mix(1.0, uBody, smoothstep(uRimUv - 0.04, uRimUv - 0.3, vUv.y));
	if (a < 0.004) discard;
	vec3 c = t.rgb * uTint;
	// cold light from the canyon below relights the already-lit crest; the dark body stays dark
	float lum = clamp(dot(t.rgb, vec3(0.3, 0.5, 0.2)) * 4.0, 0.0, 1.0);
	c += uCrestColor * lum * uCrest;
	gl_FragColor = vec4(c, a);
}`;

const videoFragment = /* glsl */ `
precision highp float;
uniform sampler2D tVideo;
uniform float uAlpha, uFeather;
uniform vec3 uHaze;
varying vec2 vUv;
void main() {
	vec3 c = texture2D(tVideo, vUv).rgb;
	float edge = smoothstep(0.0, uFeather, vUv.x) * smoothstep(1.0, 1.0 - uFeather, vUv.x)
	           * smoothstep(0.0, uFeather * 0.8, vUv.y) * smoothstep(1.0, 1.0 - uFeather * 1.6, vUv.y);
	// the picture surfaces out of the cloud haze: at low opacity it is haze-coloured, then clears
	c = mix(uHaze, c, smoothstep(0.0, 1.0, uAlpha));
	float a = edge * uAlpha;
	if (a < 0.003) discard;
	gl_FragColor = vec4(c, a);
}`;

export function createAbyssTransition({ textureLoader, pivot }) {
	const cfg = ABYSS_TRANSITION;
	const group = new THREE.Group();
	group.name = 'AbyssTransition';

	/* chasm edge */
	const splitTex = textureLoader.load(cfg.split.file);
	splitTex.colorSpace = THREE.SRGBColorSpace;
	splitTex.anisotropy = 4;
	const splitMat = new THREE.ShaderMaterial({
		vertexShader: plateVertex, fragmentShader: splitFragment,
		uniforms: {
			tMap: { value: splitTex }, uAlpha: { value: 0 }, uCrest: { value: 0 }, uBody: { value: cfg.split.bodyOpacity }, uRimUv: { value: cfg.split.rimUv },
			uCrestColor: { value: new THREE.Color(cfg.split.crestLight) }, uTint: { value: new THREE.Color(cfg.split.tint) },
		},
		transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
	});
	const split = new THREE.Mesh(new THREE.PlaneGeometry(1, 1143 / 1920), splitMat);
	split.name = 'ChasmEdge';
	split.renderOrder = 1.5;    // in front of the cloud plates (−1 / +1): the rocks cut the clouds, as in the storyboard
	split.frustumCulled = false;

	/* canyon video */
	const video = document.createElement('video');
	video.src = cfg.video.file;
	video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
	video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
	const videoTex = new THREE.VideoTexture(video);
	videoTex.colorSpace = THREE.SRGBColorSpace;
	videoTex.minFilter = THREE.LinearFilter; videoTex.magFilter = THREE.LinearFilter; videoTex.generateMipmaps = false;
	let playing = false;
	const play = () => { if (playing) return; playing = true; video.play().catch(() => { playing = false; }); };
	const videoMat = new THREE.ShaderMaterial({
		vertexShader: plateVertex, fragmentShader: videoFragment,
		uniforms: { tVideo: { value: videoTex }, uAlpha: { value: 0 }, uFeather: { value: cfg.video.edgeFeather }, uHaze: { value: new THREE.Color(cfg.video.hazeColor) } },
		transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
	});
	const canyon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1 / cfg.video.aspect), videoMat);
	canyon.name = 'CanyonVideo';
	canyon.renderOrder = 1.4;   // in front of the cloud plates too (its own haze blend does the surfacing), just behind the chasm edge
	canyon.frustumCulled = false;

	/* the void: a camera-following dark disc far below */
	const floor = new THREE.Mesh(
		new THREE.CircleGeometry(900, 48).rotateX(-Math.PI / 2),
		new THREE.MeshBasicMaterial({ color: cfg.floorColor, depthWrite: false, depthTest: false }),
	);
	floor.name = 'AbyssFloor';
	floor.renderOrder = -9;
	floor.frustumCulled = false;
	floor.onBeforeRender = (_r, _s, cam) => { floor.position.set(cam.position.x, cam.position.y - 350, cam.position.z); floor.updateMatrixWorld(); };

	group.add(canyon, split, floor);
	group.visible = false;

	const state = { t: 0, drop: 0, zoomMul: 1, dusk: 0, seaFade: 1, labelFade: 1, heroTextFade: 1, rimY: 0, videoY: 0, baseY: 0 };

	function update(transitionProgress) {
		const t = THREE.MathUtils.clamp(transitionProgress, 0, 1);
		state.t = t;
		state.drop = keys(cfg.camera.drop, t);
		state.zoomMul = keys(cfg.camera.zoomMul, t);
		state.dusk = keys(cfg.clouds.dusk, t);
		state.seaFade = keys(cfg.clouds.seaFade, t);
		state.labelFade = keys(cfg.labelFade, t);
		state.heroTextFade = keys(cfg.heroTextFade, t);
		state.rimY = keys(cfg.split.rimY, t);
		state.videoY = keys(cfg.video.frameY, t);
		group.visible = cfg.enabled && t > 0.001;
		if (!group.visible) { if (playing && !video.paused) { video.pause(); playing = false; } return; }
		play();
		splitMat.uniforms.uAlpha.value = keys(cfg.split.opacity, t);
		splitMat.uniforms.uCrest.value = keys(cfg.split.crestStrength, t);
		videoMat.uniforms.uAlpha.value = keys(cfg.video.opacity, t);
	}

	const dir = new THREE.Vector3(), up = new THREE.Vector3(), basePoint = new THREE.Vector3();
	/** Place the billboards in front of the camera. Call after camera.lookAt(), before the mouse parallax. */
	function place(cam) {
		if (!group.visible) return;
		cam.updateMatrixWorld();
		cam.getWorldDirection(dir);
		up.set(0, 1, 0).applyQuaternion(cam.quaternion);
		const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
		// the mountain's base line in frame heights (NDC y / 2): the lowest point of the footprint circle — the crest stays above it
		let lowest = Infinity;
		for (let i = 0; i < 12; i++) {
			const a = (i / 12) * Math.PI * 2;
			basePoint.set(pivot.x + Math.cos(a) * cfg.split.baseRadius, cfg.split.baseY, pivot.z + Math.sin(a) * cfg.split.baseRadius).project(cam);
			if (basePoint.z < 1) lowest = Math.min(lowest, basePoint.y / 2);
		}
		state.baseY = lowest;
		const rim = Math.max(state.rimY, state.baseY + cfg.split.rimAboveBase);
		const plateHFrames = cfg.split.widthFrames * cam.aspect * (1143 / 1920);
		const splitCentre = rim - (cfg.split.rimUv - 0.5) * plateHFrames;
		const put = (mesh, d, widthFrames, frameY) => {
			const frameH = 2 * d * tanHalf, frameW = frameH * cam.aspect;
			mesh.position.copy(cam.position).addScaledVector(dir, d).addScaledVector(up, frameY * frameH);
			mesh.quaternion.copy(cam.quaternion);
			mesh.scale.setScalar(widthFrames * frameW);
		};
		put(split, cfg.split.distance, cfg.split.widthFrames, splitCentre);
		put(canyon, cfg.video.distance, cfg.video.widthFrames, state.videoY);
	}

	return { group, split, canyon, video, floor, state, update, place, cfg };
}
