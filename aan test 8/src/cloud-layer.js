import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cloudVertex, cloudFragment, mouseVertex, mouseFragment } from './shaders.js';

/*
 * cloud-layer.js — the mountain scene's own clouds, and nothing else, over the film.
 *
 * The hero is a video (hero-scrub.js). A video is flat and does not answer the mouse, so the
 * one thing we keep from the 3-D build is its cloud rig: the nine camera-relative quads from
 * mountains.glb with their drift, their mouse wake and their edge feather, drawn on a
 * transparent canvas ABOVE the film. No mountain, no sky, no route — one foreground layer.
 *
 *   • mouse  — the quads shift and the wake pushes the vapour (the film cannot do this);
 *   • scroll — the band drifts up and thins, so the plate hands over to whatever comes next;
 *   • never  — no colour grade of its own: the clouds take the film's own light (uLightColor).
 */

export const CLOUD_LAYER = {
	enabled: true,
	file: 'assets/models/mountains.glb',
	speed: 0.28,               // drift time scale (mountain.js SETTINGS.cloudSpeed)
	edgeFeather: 0.15,
	light: 0x9fb0c6,           // the film's own light: these clouds must sit in ITS night, not in the old hero's day
	dark: 0x243243,
	floorCut: [-26, 2],        // world y (rig-relative): the low plates are gone — the film owns the bottom of the frame
	thinBase: 0.45,            // the band is thinner than the hero's: a veil in front of the film, not a sea
	parallax: 1,               // mouse parallax intensity
	// the hero rig from the 3-D build: the quads were laid out for THIS eye, so we keep it
	camera: { position: [175.856, 45.821, -51.137], lookAt: [-5.934, -4.881, 54.620], fov: 55 },
	// scroll choreography (0..1 of the page): the band rises and thins as the film descends
	rise: [[0, 0], [1, 34]],   // world units up
	thin: [[0, 0], [0.55, 0.15], [1, 0.75]],
	scale: [[0, 1], [1, 1.18]],
	opacity: [[0, 1], [0.85, 1], [1, 0.45]],
};

const keys = (k, t) => {
	if (t <= k[0][0]) return k[0][1];
	for (let i = 1; i < k.length; i++) if (t <= k[i][0]) {
		const [t0, v0] = k[i - 1], [t1, v1] = k[i];
		return v0 + (v1 - v0) * THREE.MathUtils.smoothstep(t, t0, t1);
	}
	return k[k.length - 1][1];
};

export async function createCloudLayer({ canvas, textures }) {
	const cfg = CLOUD_LAYER;
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
		uCloudTime: { value: 0 },
		uResolution: { value: new THREE.Vector2(1, 1) },
		uRatio: { value: 1 },
		uLightColor: { value: new THREE.Color(cfg.light) },
		uDarkColor: { value: new THREE.Color(cfg.dark) },
	};

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
	const material = new THREE.ShaderMaterial({
		vertexShader: cloudVertex,
		fragmentShader: cloudFragment,
		uniforms: {
			uTime: shared.uCloudTime,
			uRatio: shared.uRatio,
			uSize: { value: new THREE.Vector2(1, 1) },
			uResolution: shared.uResolution,
			uEdgeFeather: { value: cfg.edgeFeather },
			uDusk: { value: 0 },
			uDuskUpper: { value: 1 },
			uDuskThin: { value: 0 },
			uDuskBand: { value: new THREE.Vector2(-80, 120) },
			uDuskColor: { value: new THREE.Color(0x28364c) },
			uGlow: { value: 0 },
			uGlowColor: { value: new THREE.Color(0x3a86d8) },
			uCrestNdc: { value: -2 },
			uFloorCut: { value: new THREE.Vector2().fromArray(cfg.floorCut) },
			tPerlin: { value: textures.perlin },
			tNoise: { value: textures.noise },
			tMouse: { value: trail.texture },
			uLightColor: shared.uLightColor,
			uDarkColor: shared.uDarkColor,
		},
		transparent: true,
		depthWrite: false,
		depthTest: false,
		side: THREE.FrontSide,
	});

	const rig = new THREE.Group();
	scene.add(rig);

	const gltf = await new GLTFLoader().loadAsync(cfg.file);
	const clouds = gltf.scene.getObjectByName('Clouds');
	if (!clouds) throw new Error('cloud-layer: no "Clouds" node in ' + cfg.file);
	clouds.traverse((o) => {
		if (!o.isMesh) return;
		o.material = material;
		o.renderOrder = o.userData.renderOrder ?? 0;
		o.frustumCulled = false;
	});
	rig.add(clouds);

	const baseY = clouds.position.y;
	const mouse = new THREE.Vector2();
	const lerped = new THREE.Vector2();
	window.addEventListener('pointermove', (e) => {
		mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
	}, { passive: true });

	function resize() {
		const w = window.innerWidth, h = window.innerHeight;
		const dpr = Math.min(window.devicePixelRatio, 2);
		renderer.setPixelRatio(dpr);
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		shared.uResolution.value.set(w * dpr, h * dpr);
		shared.uRatio.value = w / h;

	}
	window.addEventListener('resize', resize);
	resize();

	let progress = 0;
	function setProgress(p) { progress = THREE.MathUtils.clamp(p, 0, 1); }

	let last = performance.now();
	function frame(now) {
		const dt = Math.min(0.1, (now - last) / 1000); last = now;
		shared.uTime.value += dt;
		shared.uCloudTime.value += dt * cfg.speed;

		// scroll: the band rises, thins and grows a little — it hands the frame over
		rig.position.y = keys(cfg.rise, progress);
		const s = keys(cfg.scale, progress);
		rig.scale.setScalar(s);
		const thin = Math.min(1, cfg.thinBase + keys(cfg.thin, progress));
		material.uniforms.uDuskThin.value = thin;
		material.uniforms.uDusk.value = Math.max(0.5, thin);   // the thinning needs dusk > 0 to apply
		material.uniforms.uDuskUpper.value = 1;

		// mouse: the whole rig sways, and the wake pushes the vapour (tMouse)
		lerped.lerp(mouse, dt * 2.2);
		camera.position.copy(camBase);
		camera.lookAt(camLook);
		camera.translateX(lerped.x * 2.2 * cfg.parallax);
		camera.translateY(lerped.y * 1.4 * cfg.parallax);
		camera.rotateY(-lerped.x * 0.02 * cfg.parallax);
		camera.rotateX(lerped.y * 0.02 * cfg.parallax);
		trail.update(dt, lerped);

		renderer.render(scene, camera);
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);

	return { renderer, scene, camera, material, rig, setProgress, cfg, baseY };
}
