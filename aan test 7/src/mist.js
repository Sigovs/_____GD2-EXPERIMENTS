import * as THREE from 'three';

/*
 * mist.js — the moving veil that ties the mountain world to the ocean (index_v2.html only).
 *
 * The problem it solves: in v1 the chasm edge "surfaces out of the mist" by tinting the rock toward the cloud colour in
 * the split shader. That mist is a colour, not a substance — it does not move, so the crest reads as a cut-out sliding
 * up in front of a still picture. This layer puts real moving vapour across the crest line, so the seam between the rock
 * and the world behind it is never a line: it is fog.
 *
 * What it is: a camera-relative billboard carrying a generated fog clip (assets/videos/gen-mist-*.mp4, provenance in the
 * .json sidecar beside it), composited as FOG rather than as light — its luminance becomes alpha and its colour is
 * replaced by the scene's own cloud tint, so it can never introduce a second grade or a glow (DNA23, and Alex's
 * "не должно быть швов").
 *
 * Three things keep it seamless:
 *   • all four plate edges are feathered wide (`feather`), so the plate's own border never reads as an edge;
 *   • the veil is a BAND around the crest (`bandWidth`), fading to nothing above and below — no horizon, no straight top;
 *   • the clip's loop wrap is crossfaded between two copies of the video running half a period apart (`loopCrossfade`),
 *     so the moment the file restarts is not a cut.
 *
 * Reduced motion: the videos are paused on a decoded frame and the veil is held still — the composition survives, only
 * the drift goes (DM4 / MJ9).
 */

export const MIST = {
	enabled: true,
	file: 'assets/videos/gen-mist-b.mp4',
	aspect: 2944 / 1248,         // the generated clip's own frame (21:9 request, delivered 2944 × 1248)

	distance: 70,                // world units in front of the camera: nearer than the chasm edge (80), so it passes over it
	widthFrames: 2.0,            // plate width in frame WIDTHS at that depth — wide enough that its sides are never near the frame
	renderOrder: 1.6,            // over the chasm edge (1.5) and the foreground cloud plates (+1): the veil is the nearest thing

	/* Placement: the veil rides the crest line (frame heights, 0 = frame centre), a touch below it. */
	crestOffset: -0.1,
	// How much of the plate's height carries vapour (uv units, centred); the rest fades to nothing.
	// Measured: the plate is ~1.5 frame heights tall, so 0.62 put vapour over ~0.93 of the frame — a general haze that
	// lifted the black Alex asked to keep very dark and competed with the scene's own cloud plates (a second fog system,
	// TASTE §2c device budget / DM6 one depth idea). 0.3 keeps it a BAND at the crest: ~0.15 frame heights at full
	// density, gone within ~0.45. The veil's job is the seam between rock and world, not the weather.
	bandWidth: 0.3,

	/* Strength over the transition (0..1). It comes in with the rim, holds through the middle, and is gone before the
	   ocean becomes the scene — by then there is nothing left to hide and fog over open water is a different weather. */
	strength: [[0, 0], [0.1, 0.3], [0.28, 0.55], [0.5, 0.45], [0.72, 0.18], [0.9, 0], [1, 0]],

	tint: 0xc4ceda,              // the vapour's colour while the clouds are still white
	duskTint: 0x28364c,          // … and once they have cooled (ABYSS_TRANSITION.clouds.duskColor)
	nightTint: 0x0d1420,         // … and at full night, so the veil sinks with the world instead of glowing over it
	luma: [0.1, 0.55],           // the clip's luminance range mapped to alpha — only the denser wisps register
	feather: 0.16,               // uv units of soft edge on all four sides
	density: 0.85,               // overall alpha multiplier
	speed: 0.55,                 // playback rate: the generated drift is faster than this scene's air
	loopCrossfade: true,         // two copies half a period apart, crossfaded — the loop wrap is never a cut
	prewarmAt: 0.75,             // descent progress at which the (hidden) videos start decoding
};

const mistVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

const mistFragment = /* glsl */ `
precision highp float;
uniform sampler2D tA, tB;
uniform float uMix, uStrength, uDensity, uFeather, uBand;
uniform vec2 uLuma;
uniform vec3 uTint;
varying vec2 vUv;
void main() {
	// two copies of the clip, half a period apart: at the wrap one is mid-shot while the other restarts
	vec3 a = texture2D(tA, vUv).rgb, b = texture2D(tB, vUv).rgb;
	vec3 src = mix(a, b, uMix);
	float luma = dot(src, vec3(0.2126, 0.7152, 0.0722));
	// the clip is vapour on black: its luminance IS the density. Its own colour is discarded — the veil takes the
	// scene's cloud tint, so a generated grade can never arrive through the back door.
	float density = smoothstep(uLuma.x, uLuma.y, luma);
	// a band across the middle of the plate: no straight top edge, no horizon, nothing to read as a line
	float band = smoothstep(0.5 + uBand * 0.5, 0.5 + uBand * 0.16, abs(vUv.y - 0.5) + 0.5);
	// all four sides feathered wide: the plate's own border is never an edge in the picture
	float edge = smoothstep(0.0, uFeather, vUv.x) * smoothstep(1.0, 1.0 - uFeather, vUv.x)
	           * smoothstep(0.0, uFeather * 0.8, vUv.y) * smoothstep(1.0, 1.0 - uFeather * 0.8, vUv.y);
	float a2 = density * band * edge * uStrength * uDensity;
	if (a2 < 0.002) discard;
	// slightly brighter where the vapour is thickest, so it keeps some form instead of reading as flat haze
	vec3 c = uTint * (0.72 + 0.5 * density);
	gl_FragColor = vec4(c, a2);
}`;

function keys(k, t) {
	if (t <= k[0][0]) return k[0][1];
	for (let i = 1; i < k.length; i++) if (t <= k[i][0]) {
		const [t0, v0] = k[i - 1], [t1, v1] = k[i];
		return v0 + (v1 - v0) * THREE.MathUtils.smoothstep(t, t0, t1);
	}
	return k[k.length - 1][1];
}

/** One muted, looping, inline video element + its texture. Never carries audio (Alex: every generated video is silent). */
function makeVideo(file, rate) {
	const v = document.createElement('video');
	v.src = file;
	v.muted = true; v.defaultMuted = true; v.volume = 0;
	v.loop = true; v.playsInline = true; v.preload = 'auto';
	v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
	v.playbackRate = rate;
	const tex = new THREE.VideoTexture(v);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
	return { el: v, tex };
}

export function createMist({ reducedMotion } = {}) {
	const cfg = MIST;
	const still = reducedMotion?.matches ?? false;

	const a = makeVideo(cfg.file, cfg.speed);
	const b = cfg.loopCrossfade ? makeVideo(cfg.file, cfg.speed) : a;

	const material = new THREE.ShaderMaterial({
		vertexShader: mistVertex, fragmentShader: mistFragment,
		uniforms: {
			tA: { value: a.tex }, tB: { value: b.tex },
			uMix: { value: 0 }, uStrength: { value: 0 }, uDensity: { value: cfg.density },
			uFeather: { value: cfg.feather }, uBand: { value: cfg.bandWidth },
			uLuma: { value: new THREE.Vector2().fromArray(cfg.luma) },
			uTint: { value: new THREE.Color(cfg.tint) },
		},
		transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
	});

	const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1 / cfg.aspect), material);
	mesh.name = 'Mist';
	mesh.renderOrder = cfg.renderOrder;
	mesh.frustumCulled = false;
	mesh.visible = false;

	const dayTint = new THREE.Color(cfg.tint), duskTint = new THREE.Color(cfg.duskTint), nightTint = new THREE.Color(cfg.nightTint);
	const tmpTint = new THREE.Color();
	let playing = false, offsetSet = false;
	const state = { strength: 0 };

	function play() {
		if (playing || still) return;
		playing = true;
		a.el.play().catch(() => { playing = false; });
		if (b !== a) b.el.play().catch(() => {});
	}

	/** t = transition progress, descentProgress prewarms the decode, dusk / night keep the veil in the world's light. */
	function update(t, descentProgress = 1, dusk = 0, night = 0) {
		if (descentProgress >= cfg.prewarmAt) play();
		state.strength = keys(cfg.strength, THREE.MathUtils.clamp(t, 0, 1));
		mesh.visible = cfg.enabled && state.strength > 0.002;
		if (!mesh.visible) return;
		play();
		// the second copy runs half a period behind the first, so one is always mid-shot
		if (b !== a && !offsetSet && a.el.readyState >= 2 && a.el.duration > 0) {
			b.el.currentTime = (a.el.currentTime + a.el.duration / 2) % a.el.duration;
			offsetSet = true;
		}
		// crossfade window around each wrap: |phase| near the ends of the clip hands over to the other copy
		let mix = 0;
		if (b !== a && a.el.duration > 0) {
			const half = a.el.duration / 2, phase = (a.el.currentTime % a.el.duration) / a.el.duration;
			const near = Math.min(phase, 1 - phase);              // 0 at the wrap, 0.5 mid-clip
			mix = 1 - THREE.MathUtils.smoothstep(near, 0.0, 0.12); // hand over only close to the wrap
			if (half <= 0) mix = 0;
		}
		material.uniforms.uMix.value = mix;
		material.uniforms.uStrength.value = state.strength;
		tmpTint.copy(dayTint).lerp(duskTint, THREE.MathUtils.clamp(dusk, 0, 1)).lerp(nightTint, THREE.MathUtils.clamp(night, 0, 1));
		material.uniforms.uTint.value.copy(tmpTint);
		if (still) { a.el.pause(); if (b !== a) b.el.pause(); }
	}

	const dir = new THREE.Vector3(), up = new THREE.Vector3();
	/** Place the veil in front of the camera, centred on the crest line. Call where abyss.place() is called. */
	function place(cam, crestFrameY, shift = 0) {
		if (!mesh.visible) return;
		cam.updateMatrixWorld();
		cam.getWorldDirection(dir);
		up.set(0, 1, 0).applyQuaternion(cam.quaternion);
		const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
		const frameH = 2 * cfg.distance * tanHalf, frameW = frameH * cam.aspect;
		const y = crestFrameY + cfg.crestOffset;
		mesh.position.copy(cam.position).addScaledVector(dir, cfg.distance).addScaledVector(up, (y - shift) * frameH);
		mesh.quaternion.copy(cam.quaternion);
		mesh.scale.setScalar(cfg.widthFrames * frameW);
	}

	function dispose() {
		material.dispose(); mesh.geometry.dispose();
		a.tex.dispose(); a.el.pause(); a.el.removeAttribute('src'); a.el.load();
		if (b !== a) { b.tex.dispose(); b.el.pause(); b.el.removeAttribute('src'); b.el.load(); }
	}

	return { mesh, material, state, update, place, dispose, cfg, videos: b === a ? [a.el] : [a.el, b.el] };
}
