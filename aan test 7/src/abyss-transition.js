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
 *   • the camera does NOT move: the whole hero picture (mountain, baby peaks,
 *     clouds, sea) slides up as one image through a LENS SHIFT of the projection
 *     (`camera.shift`, in frame heights) plus a tiny zoom-out — nothing new is
 *     revealed on the models, no undersides, no cut bases;
 *   • the cloud plates and the sea cool to blue-grey from the bottom up;
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

	/* Camera: lens shift of the projection (frame heights the hero picture moves UP) and a small zoom-out */
	camera: {
		shift:   [[0, 0], [0.25, 0.02], [0.55, 0.15], [0.8, 0.45], [1, 0.9]],
		zoomMul: [[0, 1], [0.6, 1.12], [1, 1.15]],   // "slightly backward" — a small size reduction, inside the responsive clamp
	},

	/* Chasm edge — split1.png billboard. `rimY`: the ridge crest in frame heights at its depth (0 = centre, +0.5 = top edge).
	   The crest never drops below the mountain's base line + `rimAboveBase`, so the rocks hide the cut base once the sea is gone. */
	split: {
		file: 'assets/split/split1.png',
		distance: 80,                // world units in front of the camera
		widthFrames: 1.12,           // plate width in frame WIDTHS at that depth (> 1 so its sides never show)
		heightScale: 0.8,            // the plate is squeezed vertically: a thinner dark body, a bigger opening below it
		rimUv: 0.68,                 // where the crest sits in the image (uv.y from the bottom)
		// the crest starts UNDER the bottom edge (the plate's highest side rocks just touch it) and floats up — never a pop-in
		rimY: [[0, -0.78], [0.3, -0.38], [0.55, -0.12], [0.8, 0.2], [1, 0.75]],   // rides up with the mountain's base at the end (see the guard below)
		/* Base guard: the crest never drops below the mountain's base line + `rimAboveBase` — but only once the sea has cooled
		   (a dark sea no longer hides the cut edge). The guard fades in with `seaDusk`, so it never pops the rocks in. */
		rimAboveBase: 0.06,
		guardEase: 1.5,              // frame heights the guard sits below its line while the sea is still white
		baseY: -6,                   // world y of the mountain's cut base (the sea's top layer sits at −4)
		baseRadius: 95,              // footprint radius around the summit axis — the lowest projected point of that circle is the base line
		opacity: [[0, 0], [0.22, 1], [0.93, 1], [1, 0.55]],   // fades in while rising; ends as subtle framing (solid until the base has left the frame)
		bodyOpacity: 0.3,            // the dark body under the crest is this opaque at its darkest (the canyon shows through it)
		/* atmospheric emergence: the crest surfaces out of the cloud mist — takes the cloud colour and is half transparent,
		   then clears as it rises toward the camera. `fog` = strength over time; the effect is strongest at the crest, none low on the body. */
		fog: [[0, 1], [0.3, 0.75], [0.6, 0.3], [1, 0.12]],
		fogCloud: 0xd6dde6,          // the mist colour while the clouds are still white (blends to clouds.duskColor as they cool)
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
		frameY: [[0, -1.1], [0.3, -0.8], [0.55, -0.5], [0.8, -0.25], [1, -0.05]],   // the light shaft (top-centre of the video) rises into the opening
		opacity: [[0.05, 0], [0.3, 0.6], [0.6, 1], [1, 1]],   // surfaces as the edge rises, fully clear by the overlap
		prewarmAt: 0.6,              // descent progress at which the (hidden) video starts playing, so it is decoded before it is needed
		edgeFeather: 0.16,           // soft border (uv units) so the plate never shows a hard edge
		hazeColor: 0x1a2436,         // atmosphere the video surfaces from (blended in where opacity is low)
	},

	/* Clouds: the plates cool from the bottom up and thin into haze; the sea fades before the camera passes it */
	clouds: {
		dusk: [[0, 0], [0.15, 0.3], [0.45, 0.8], [0.7, 1], [1, 1]],   // the low plates are already grey-blue when the rocks surface from them
		duskColor: 0x28364c,         // blue-grey, not black — storyboard 03's fog
		duskBand: [-80, 120],        // world y (rig-relative, the rig follows the camera): cold below, hero above at dusk = 1
		duskThin: 0.6,               // plates lose this much density at full dusk — they stay as haze
		seaDusk: [[0, 0], [0.15, 0.25], [0.5, 0.8], [1, 1]],   // the sea cools with the plates (it is what shows under the hero picture)
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
uniform float uAlpha, uCrest, uBody, uRimUv, uFog;
uniform vec3 uCrestColor, uTint, uFogColor;
varying vec2 vUv;
void main() {
	vec4 t = texture2D(tMap, vUv);
	float a = t.a * uAlpha * smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x);
	// the body below the crest thins toward its lower fade so the canyon reads through it (and the fade start has no shelf)
	a *= mix(1.0, uBody, smoothstep(uRimUv - 0.12, uRimUv - 0.32, vUv.y));
	vec3 c = t.rgb * uTint;
	// cold light from the canyon below relights the already-lit crest; the dark body stays dark
	float lum = clamp(dot(t.rgb, vec3(0.3, 0.5, 0.2)) * 4.0, 0.0, 1.0);
	c += uCrestColor * lum * uCrest;
	// emergence from the mist: the crest is fogged (cloud-coloured, half transparent) and clears as it rises
	float fog = uFog * smoothstep(uRimUv - 0.45, uRimUv + 0.1, vUv.y);
	c = mix(c, uFogColor, fog * 0.9);
	a *= 1.0 - fog * 0.6;
	if (a < 0.004) discard;
	gl_FragColor = vec4(c, a);
}`;

const videoFragment = /* glsl */ `
precision highp float;
uniform sampler2D tVideo, tSplit;
uniform float uAlpha, uFeather, uRimUv, uReady;
uniform vec2 uSplitScale, uSplitOffset;   // this plate's uv → the chasm edge's uv (both are camera billboards)
uniform vec3 uHaze;
varying vec2 vUv;
void main() {
	vec3 c = texture2D(tVideo, vUv).rgb;
	float edge = smoothstep(0.0, uFeather, vUv.x) * smoothstep(1.0, 1.0 - uFeather, vUv.x)
	           * smoothstep(0.0, uFeather * 0.8, vUv.y) * smoothstep(1.0, 1.0 - uFeather * 1.6, vUv.y);
	// the canyon exists only INSIDE the chasm: where the edge plate has coverage (its body and lower fade),
	// and everything below the body; above the crest — over the mountain and the clouds — it is masked out
	vec2 su = (vUv - 0.5) * uSplitScale + 0.5 + uSplitOffset;
	float cover = (su.x < 0.0 || su.x > 1.0 || su.y > 1.0 || su.y < 0.0) ? 0.0 : texture2D(tSplit, su).a;
	float below = 1.0 - smoothstep(uRimUv - 0.34, uRimUv - 0.26, su.y);   // under the body: always open
	float inside = max(smoothstep(0.05, 0.5, cover), below);
	// the picture surfaces out of the cloud haze: at low opacity it is haze-coloured, then clears
	c = mix(uHaze, c, smoothstep(0.0, 1.0, uAlpha) * uReady);   // uReady: haze (not black) until the video has a decoded frame
	float a = edge * uAlpha * inside;
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
			uFog: { value: 1 }, uFogColor: { value: new THREE.Color(cfg.split.fogCloud) },
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
		uniforms: {
			tVideo: { value: videoTex }, tSplit: { value: splitTex }, uAlpha: { value: 0 }, uFeather: { value: cfg.video.edgeFeather },
			uRimUv: { value: cfg.split.rimUv }, uSplitScale: { value: new THREE.Vector2(1, 1) }, uSplitOffset: { value: new THREE.Vector2() },
			uHaze: { value: new THREE.Color(cfg.video.hazeColor) }, uReady: { value: 0 },
		},
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

	const state = { t: 0, shift: 0, zoomMul: 1, dusk: 0, seaDusk: 0, labelFade: 1, heroTextFade: 1, rimY: 0, videoY: 0, baseY: 0 };

	const fogCloud = new THREE.Color(cfg.split.fogCloud), fogDusk = new THREE.Color(cfg.clouds.duskColor);
	let ready = 0, everReady = false, lastNow = performance.now();
	function update(transitionProgress, descentProgress = 1) {
		const t = THREE.MathUtils.clamp(transitionProgress, 0, 1);
		state.t = t;
		// the hidden video starts decoding late in the descent, so it is never a black plate when it surfaces
		if (descentProgress >= cfg.video.prewarmAt) play(); else if (playing && t <= 0.001) { video.pause(); playing = false; }
		const now = performance.now(), dtr = Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
		if (video.readyState >= 2 && video.currentTime > 0) everReady = true;   // sticky: the loop wrap must not flash haze
		ready = everReady ? Math.min(1, ready + dtr * 1.5) : 0;
		videoMat.uniforms.uReady.value = ready;
		state.shift = keys(cfg.camera.shift, t);
		state.zoomMul = keys(cfg.camera.zoomMul, t);
		state.dusk = keys(cfg.clouds.dusk, t);
		state.seaDusk = keys(cfg.clouds.seaDusk, t);
		state.labelFade = keys(cfg.labelFade, t);
		state.heroTextFade = keys(cfg.heroTextFade, t);
		state.rimY = keys(cfg.split.rimY, t);
		state.videoY = keys(cfg.video.frameY, t);
		group.visible = cfg.enabled && t > 0.001;
		if (!group.visible) return;
		play();
		splitMat.uniforms.uAlpha.value = keys(cfg.split.opacity, t);
		splitMat.uniforms.uFog.value = keys(cfg.split.fog, t);
		splitMat.uniforms.uFogColor.value.lerpColors(fogCloud, fogDusk, state.dusk);
		splitMat.uniforms.uCrest.value = keys(cfg.split.crestStrength, t);
		videoMat.uniforms.uAlpha.value = keys(cfg.video.opacity, t);
	}

	/** Lens shift: shear the projection so the whole picture moves up by `shift` frame heights. Call every frame. */
	function applyShift(cam) {
		cam.projectionMatrix.elements[9] = -2 * state.shift;   // y_ndc += 2·shift (a symmetric frustum has 0 here)
		cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
	}

	const dir = new THREE.Vector3(), up = new THREE.Vector3(), basePoint = new THREE.Vector3();
	/** Place the billboards in front of the camera. Call after camera.lookAt() and applyShift(), before the mouse parallax.
	    Frame coordinates are VISIBLE-frame ones (the lens shift moves the geometry up by `shift`, so we place `shift` lower). */
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
		const rim = cfg.split.rimAboveBase == null ? state.rimY
			: Math.max(state.rimY, state.baseY + cfg.split.rimAboveBase - (1 - state.seaDusk) * cfg.split.guardEase);
		const plateHFrames = cfg.split.widthFrames * cam.aspect * (1143 / 1920) * cfg.split.heightScale;
		const splitCentre = rim - (cfg.split.rimUv - 0.5) * plateHFrames;
		const put = (mesh, d, widthFrames, frameY) => {
			const frameH = 2 * d * tanHalf, frameW = frameH * cam.aspect;
			mesh.position.copy(cam.position).addScaledVector(dir, d).addScaledVector(up, (frameY - state.shift) * frameH);
			mesh.quaternion.copy(cam.quaternion);
			mesh.scale.setScalar(widthFrames * frameW);
		};
		put(split, cfg.split.distance, cfg.split.widthFrames, splitCentre);
		split.scale.y *= cfg.split.heightScale;
		put(canyon, cfg.video.distance, cfg.video.widthFrames, state.videoY);
		// video uv → edge uv, in frame units (widths for x, heights for y)
		const videoHFrames = cfg.video.widthFrames * cam.aspect / cfg.video.aspect;
		videoMat.uniforms.uSplitScale.value.set(cfg.video.widthFrames / cfg.split.widthFrames, videoHFrames / plateHFrames);
		videoMat.uniforms.uSplitOffset.value.set(0, (state.videoY - splitCentre) / plateHFrames);
	}

	return { group, split, canyon, video, floor, state, update, place, applyShift, cfg };
}
