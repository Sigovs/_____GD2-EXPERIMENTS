import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mouseVertex, mouseFragment } from './shaders.js';
import { cloudVertex, cloudFragment, mistVertex, mistFragment } from './cloud-shaders.js?v=2026-09-18e';

/*
 * cloud-layer.js — the mountain scene's own clouds, and nothing else, over the film.
 *
 * The hero is a video (hero-scrub.js). A video is flat and does not answer the mouse, so the
 * one thing we keep from the 3-D build is its cloud rig: the nine camera-relative plates from
 * mountains.glb (three "Foreground", six "Middleground" instances) with their mouse wake and
 * their edge feather, drawn on a transparent canvas ABOVE the film. No mountain, no sky.
 *
 *   • two kinds — the rig's own split: Foreground is the VEIL (near, thin, stretched, streams
 *                 past the lens), Middleground the PUFF (behind it, denser, rounder, slower);
 *   • white    — moonlit white only, translucent; the film's dark is the shadow. No grade;
 *   • loop     — each plate breathes on its own phase and its vapour drifts, always;
 *   • mouse    — the rig sways and the wake pushes the vapour (the film cannot do this);
 *   • scroll   — the band rises, thins from the bottom and fades toward the end of the film;
 *   • hold     — the plates part behind the statement while it is up (DM5);
 *   • reduced  — one still frame: no drift, no breath, no mouse.
 */

export const CLOUD_LAYER = {
	enabled: true,
	file: 'assets/models/mountains.glb',
	edgeFeather: 0.15,
	lit: 0xffffff,             // the rim, in the moon
	shade: 0xe6eef9,           // the body — still white, a touch cold; density does the shading
	floorCut: [-44, 6],        // rig y: the low plates are gone — the film owns the bottom of the frame; a wide band, noise-torn (cloud-shaders.js)
	parallax: 1.5,             // mouse parallax intensity (the rig sways with the cursor)
	wake: { push: 0.18, clear: 0.7 },   // the cursor's wake: how far it pushes the vapour, how much of the plate it clears
	kinds: {
		//        density  sideways stretch  edge softness  vapour drift (s/s)  breath (world units)
		veil: { alpha: 0.42, stretch: 1.9, soft: 1.0,  drift: 0.9,  sway: 3.0 },
		puff: { alpha: 0.56, stretch: 1.0, soft: 0.25, drift: 0.45, sway: 1.6 },
	},
	byName: { Foreground: 'veil', Middleground: 'puff' },
	/* MIST — the third kind: small groups of strands, stretched sideways, in the lower frame,
	   in screen space (NDC). The film's own mist is a still wherever the scroll rests; these move.
	   strips: [x, y, w, h] in NDC · seeds: [seed, phase, drift (uv/s)] */
	mist: {
		enabled: false,            // CUT (Alex, 17 Sep: "убери их вообще") — the strands read as bands over the film. Set true to restore; nothing else changes.
		alpha: 0.5,
		lit: 0xffffff,
		shade: 0xdbe6f6,
		breath: 0.07,              // NDC: the lateral sway of a strip
		strips: [
			// group A — left, low
			[-0.70, -0.62, 0.50, 0.20], [-0.52, -0.72, 0.42, 0.16], [-0.84, -0.50, 0.36, 0.14],
			// group B — centre, lowest
			[0.05, -0.80, 0.56, 0.22], [0.24, -0.66, 0.44, 0.16], [-0.14, -0.90, 0.48, 0.18],
			// group C — right
			[0.62, -0.50, 0.46, 0.18], [0.78, -0.62, 0.40, 0.16], [0.48, -0.38, 0.32, 0.12],
			// one high, loose
			[-0.20, -0.30, 0.60, 0.13],
		],
		seeds: [[0.13, 0.4, 0.028], [0.47, 2.1, 0.022], [0.71, 4.0, 0.034], [0.22, 1.2, 0.030], [0.58, 3.3, 0.024], [0.86, 5.1, 0.036], [0.35, 0.8, 0.026], [0.64, 2.7, 0.031], [0.92, 4.6, 0.02], [0.05, 1.9, 0.018]],
		opacity: [[0, 0.55], [0.6, 0.7], [1, 1]],   // fuller toward the camp, where nothing else moves
		blurSpeed: 7,              // scroll progress/s at which the mist is fully out of focus (1/7 of the page per second)
	},
	// the hero rig from the 3-D build: the plates were laid out for THIS eye, so we keep it
	camera: { position: [175.856, 45.821, -51.137], lookAt: [-5.934, -4.881, 54.620], fov: 55 },
	// scroll choreography (0..1 of the page): the band rises and thins as the film descends
	rise: [[0, 0], [1, 34]],   // world units up
	thin: [[0, 0], [0.55, 0.35], [1, 0.9]],
	scale: [[0, 1], [1, 1.18]],
	opacity: [[0, 1], [0.7, 1], [1, 0.4]],   // the tent shot at the end is the film's: the plates step back
	holdPad: [0.06, 0.05],     // NDC padding around the statement's box (x, y)
	/* the intro's cloud mass (intro.js → setIntro): where the rig goes and how big it gets at k = 1 */
	introMass: { rise: 34, scale: 1.5 },
	/* standby: with no scroll and no mouse for a while, the plates stir more on their own —
	   the breath and the vapour's drift multiplied; the first input eases them back */
	standby: { after: 1.5, over: 2.5, sway: 4.0, tempo: 1.35, drift: 1.8, rock: 0.03, drift_x: 10, bob: 3 },   // sway ×, breath tempo ×, vapour drift ×, rig roll (rad), rig side-drift and bob (world units)
};

const lerp = (a, b, t) => a + (b - a) * t;
const keys = (k, t) => {
	if (t <= k[0][0]) return k[0][1];
	for (let i = 1; i < k.length; i++) if (t <= k[i][0]) {
		const [t0, v0] = k[i - 1], [t1, v1] = k[i];
		return v0 + (v1 - v0) * THREE.MathUtils.smoothstep(t, t0, t1);
	}
	return k[k.length - 1][1];
};

export async function createCloudLayer({ canvas, textures, hold = null }) {
	const cfg = CLOUD_LAYER;
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
	renderer.setClearAlpha(0);
	renderer.outputColorSpace = THREE.SRGBColorSpace;

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(cfg.camera.fov, 1, 0.1, 4000);
	const camBase = new THREE.Vector3().fromArray(cfg.camera.position);
	const camLook = new THREE.Vector3().fromArray(cfg.camera.lookAt);
	camera.position.copy(camBase);
	camera.lookAt(camLook);
	scene.add(camera);

	const shared = {
		uTime: { value: 0 },
		uSwayTime: { value: 0 },
		uResolution: { value: new THREE.Vector2(1, 1) },
		uThin: { value: 0 },
		uHold: { value: new THREE.Vector4(2, 2, 2, 2) },   // off-screen until measured
		uHoldAmount: { value: 0 },
		uGather: { value: 0 },     // intro.js → setIntro: the mass over the centre
		uDense: { value: 0 },
	};
	let intro = 0;   // 1 = inside the cloud, 0 = the everyday layer

	/* the mouse wake: the same ping-pong buffer the 3-D build used (shaders.js mouseVertex/Fragment) */
	const trail = (() => {
		const size = 512;
		const geometry = new THREE.BufferGeometry()
			.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3))
			.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
		const mat = new THREE.ShaderMaterial({
			vertexShader: mouseVertex, fragmentShader: mouseFragment,
			uniforms: { tLast: { value: null }, uMouse: { value: new THREE.Vector2() }, uMouseVelocity: { value: new THREE.Vector2() }, tNoise: { value: textures.noise }, uTime: shared.uTime },
			dithering: true, depthTest: false, depthWrite: false,
		});
		const mesh = new THREE.Mesh(geometry, mat); mesh.frustumCulled = false;
		const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		const opts = { type: THREE.HalfFloatType, depthBuffer: false };
		const rt1 = new THREE.WebGLRenderTarget(size, size, opts), rt2 = new THREE.WebGLRenderTarget(size, size, opts);
		let frame = 0; const velocity = new THREE.Vector2();
		return {
			get texture() { return rt1.texture; },
			update(dt, target) {
				const u = mat.uniforms;
				velocity.subVectors(target, u.uMouse.value);
				u.uMouseVelocity.value.lerp(velocity, dt * 2);
				u.uMouse.value.lerp(target, dt * 3);
				const [write, read] = frame++ % 2 === 0 ? [rt1, rt2] : [rt2, rt1];
				u.tLast.value = read.texture;
				renderer.setRenderTarget(write); renderer.clear(); renderer.render(mesh, cam); renderer.setRenderTarget(null);
			},
		};
	})();

	/* one material per kind — same shader, its own density, stretch, softness, clock and breath */
	const kinds = {};
	for (const [name, k] of Object.entries(cfg.kinds)) {
		const uTime = { value: 0 };   // this kind's own vapour clock
		kinds[name] = {
			k,
			uTime,
			material: new THREE.ShaderMaterial({
				vertexShader: cloudVertex,
				fragmentShader: cloudFragment,
				uniforms: {
					uTime,
					uSwayTime: shared.uSwayTime,
					uSway: { value: reduced ? 0 : k.sway },
					uGather: shared.uGather,
					uDense: shared.uDense,
					uResolution: shared.uResolution,
					uEdgeFeather: { value: cfg.edgeFeather },
					uLit: { value: new THREE.Color(cfg.lit) },
					uShade: { value: new THREE.Color(cfg.shade) },
					uAlpha: { value: k.alpha },
					uStretch: { value: k.stretch },
					uSoft: { value: k.soft },
					uThin: shared.uThin,
					uFloorCut: { value: new THREE.Vector2().fromArray(cfg.floorCut) },
					uHold: shared.uHold,
					uHoldAmount: shared.uHoldAmount,
					uWakePush: { value: cfg.wake.push },
					uWakeClear: { value: cfg.wake.clear },
					tPerlin: { value: textures.perlin },
					tNoise: { value: textures.noise },
					tMouse: { value: trail.texture },
				},
				transparent: true,
				depthWrite: false,
				depthTest: false,
				side: THREE.FrontSide,
			}),
		};
	}

	const rig = new THREE.Group();
	scene.add(rig);

	const gltf = await new GLTFLoader().loadAsync(cfg.file);
	const clouds = gltf.scene.getObjectByName('Clouds');
	if (!clouds) throw new Error('cloud-layer: no "Clouds" node in ' + cfg.file);
	clouds.traverse((o) => {
		if (!o.isMesh) return;
		const kind = kinds[cfg.byName[o.name]];
		if (!kind) throw new Error('cloud-layer: no kind for plate "' + o.name + '"');
		o.material = kind.material;
		o.renderOrder = o.userData.renderOrder ?? 0;
		o.frustumCulled = false;
	});
	rig.add(clouds);

	/* the mist: one instanced screen-space quad per strip, drawn after the plates (off unless cfg.mist.enabled) */
	const mist = (() => {
		const m = cfg.mist;
		if (!m.enabled) return { mesh: null, mat: { uniforms: { uParallax: { value: new THREE.Vector2() }, uBlur: { value: 0 } } }, uAlpha: { value: 0 }, cfg: m };
		const geo = new THREE.InstancedBufferGeometry();
		geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
		geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
		geo.setIndex([0, 1, 2, 0, 2, 3]);
		geo.setAttribute('aStrip', new THREE.InstancedBufferAttribute(new Float32Array(m.strips.flat()), 4));
		geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(m.seeds.flat()), 3));
		geo.instanceCount = m.strips.length;
		const uAlpha = { value: m.alpha };
		const mat = new THREE.ShaderMaterial({
			vertexShader: mistVertex, fragmentShader: mistFragment,
			uniforms: {
				uTime: shared.uTime, uBreath: { value: reduced ? 0 : m.breath }, uParallax: { value: new THREE.Vector2() },
				uResolution: shared.uResolution, tPerlin: { value: textures.perlin }, tNoise: { value: textures.noise }, tMouse: { value: trail.texture },
				uLit: { value: new THREE.Color(m.lit) }, uShade: { value: new THREE.Color(m.shade) }, uAlpha,
				uHold: shared.uHold, uHoldAmount: shared.uHoldAmount, uWakeClear: { value: cfg.wake.clear },
				uBlur: { value: 0 },
			},
			transparent: true, depthWrite: false, depthTest: false,
		});
		const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 10;
		scene.add(mesh);
		return { mesh, mat, uAlpha, cfg: m };
	})();
	/* the mist defocuses while the page scrolls and comes back into focus at rest:
	   the scroll's speed (progress / s) drives it — a fast attack, a slower release */
	let blur = 0, lastProgress = 0;
	function focus(dt) {
		const speed = Math.abs(progress - lastProgress) / Math.max(dt, 1e-3); lastProgress = progress;
		const target = Math.min(1, speed * cfg.mist.blurSpeed);
		blur += (target - blur) * Math.min(1, dt * (target > blur ? 9 : 2.2));
		mist.mat.uniforms.uBlur.value = blur;
	}

	const mouse = new THREE.Vector2();
	const lerped = new THREE.Vector2();
	let lastInput = performance.now();   // standby clock: reset by the mouse and by the scroll
	if (!reduced) window.addEventListener('pointermove', (e) => {
		mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
		lastInput = performance.now();
	}, { passive: true });

	/* the hold: the statement's box in NDC, re-measured on resize (it moves at the phone breakpoint) */
	function measureHold() {
		if (!hold) return;
		const r = hold.getBoundingClientRect();
		const w = window.innerWidth, h = window.innerHeight;
		const [px, py] = cfg.holdPad;
		shared.uHold.value.set(
			(r.left / w) * 2 - 1 - px, -((r.bottom / h) * 2 - 1) - py,
			(r.right / w) * 2 - 1 + px, -((r.top / h) * 2 - 1) + py);
	}

	function resize() {
		const w = window.innerWidth, h = window.innerHeight;
		const dpr = Math.min(window.devicePixelRatio, 2);
		renderer.setPixelRatio(dpr);
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		shared.uResolution.value.set(w * dpr, h * dpr);
		measureHold();
		if (reduced) render();
	}
	window.addEventListener('resize', resize);

	let progress = 0;
	function setProgress(p) {
		const q = THREE.MathUtils.clamp(p, 0, 1);
		if (q !== progress) lastInput = performance.now();
		progress = q;
		if (reduced) render();
	}
	/* intro.js: 1 = inside the cloud mass, 0 = the everyday layer; never under reduced motion */
	function setIntro(k) { intro = reduced ? 0 : THREE.MathUtils.clamp(k, 0, 1); }

	function applyScroll() {
		// the band rises, thins from the bottom and grows a little — it hands the frame over to the film
		rig.position.y = keys(cfg.rise, progress) + cfg.introMass.rise * intro;             // the mass climbs onto the mountain
		rig.scale.setScalar(keys(cfg.scale, progress) * lerp(1, cfg.introMass.scale, intro));   // and grows
		shared.uThin.value = keys(cfg.thin, progress) * (1 - intro);
		shared.uGather.value = intro;
		shared.uDense.value = intro;
		const layer = keys(cfg.opacity, progress);
		for (const kind of Object.values(kinds)) kind.material.uniforms.uAlpha.value = lerp(kind.k.alpha * layer, 1, intro);   // the mass is opaque
		mist.uAlpha.value = mist.cfg.alpha * keys(mist.cfg.opacity, progress) * (1 + 0.9 * intro);
		// the hold follows the statement out: hero-scrub.js writes its opacity, we read it — and it waits for the intro
		shared.uHoldAmount.value = (hold ? parseFloat(hold.style.opacity || '1') : 0) * (1 - intro);
	}

	function render() {
		applyScroll();
		camera.position.copy(camBase);
		camera.lookAt(camLook);
		renderer.render(scene, camera);
	}

	let last = performance.now(), idle = 0;
	function frame(now) {
		const dt = Math.min(0.1, (now - last) / 1000); last = now;
		// standby: how long since the last input, eased in over cfg.standby.over seconds
		const sb = cfg.standby, since = (now - lastInput) / 1000;
		const idleTarget = THREE.MathUtils.smoothstep(since, sb.after, sb.after + sb.over);
		idle += (idleTarget - idle) * Math.min(1, dt * (idleTarget > idle ? 0.8 : 3));   // slow to stir, quick to settle
		shared.uTime.value += dt;
		shared.uSwayTime.value += dt * (1 + (sb.tempo - 1) * idle);   // the breath a touch quicker, never jittery
		for (const kind of Object.values(kinds)) {
			kind.uTime.value += dt * kind.k.drift * (1 + (sb.drift - 1) * idle);
			kind.material.uniforms.uSway.value = kind.k.sway * (1 + (sb.sway - 1) * idle);   // …and much wider: the plates float
		}

		applyScroll();
		focus(dt);
		// standby: the whole rig rocks — a slow roll and a side-drift on unrelated periods
		const ts = shared.uSwayTime.value;
		rig.rotation.z = idle * sb.rock * Math.sin(ts / 7.3);
		rig.position.x = idle * sb.drift_x * Math.sin(ts / 9.1 + 1.2);
		rig.position.y += idle * sb.bob * Math.sin(ts / 5.7 + 0.4);   // on top of the scroll's rise (applyScroll set it this frame)

		// mouse: the whole rig sways, and the wake pushes the vapour (tMouse)
		lerped.lerp(mouse, dt * 2.2);
		camera.position.copy(camBase);
		camera.lookAt(camLook);
		camera.translateX(lerped.x * 2.2 * cfg.parallax);
		camera.translateY(lerped.y * 1.4 * cfg.parallax);
		camera.rotateY(-lerped.x * 0.02 * cfg.parallax);
		camera.rotateX(lerped.y * 0.02 * cfg.parallax);
		mist.mat.uniforms.uParallax.value.set(lerped.x * 0.03 * cfg.parallax, lerped.y * 0.02 * cfg.parallax);
		trail.update(dt, lerped);

		renderer.render(scene, camera);
		requestAnimationFrame(frame);
	}

	resize();
	if (reduced) render(); else requestAnimationFrame(frame);

	return { renderer, scene, camera, kinds, mist, rig, setProgress, setIntro, measureHold, cfg };
}
