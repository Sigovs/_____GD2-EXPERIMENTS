/*
 * ocean.js — VERSION 4 (Alex, 20 Sep): the sea under the last chapter, seen from above — after unitedcarriers.com.
 *
 * Built the way theirs is (read from their OceanScene, written here from scratch): the water is a PBR surface — a
 * mirror-smooth, half-metal plane (MeshStandardMaterial, roughness 0, metalness ~0.6) that REFLECTS A SKY
 * (assets/ocean/ocean-envmap.webp, an equirectangular sky through PMREM) through a fine normal map repeated many
 * times, lit by one strong sun and a soft ambient, ACES tone-mapped. Their top-down ocean texture rides on top as the
 * body's colour. The ripples move (the normal map drifts two ways); the cursor tilts the view a little.
 *
 * Earlier tries — three.js' Water at an angle (a pale sheen: the Fresnel reflection of a flat dome) and a flat
 * unlit texture (mud) — are gone: without a real sky to reflect, no water shader reads as water.
 *
 * Textures are PLACEHOLDERS from unitedcarriers.com (assets/ocean/README.txt). Draws only while the section is on
 * screen; pixel ratio capped at 1.5 (a PBR plane at 2x is heavy for what it is). Numbers in OCEAN.
 */
import * as THREE from 'three';

export const OCEAN = {
	color: '#204462',        // the material's base (theirs)
	roughness: 0, metalness: 0.61,
	normalRepeat: 68, normalScale: 0.7, normalRotation: 1.2,
	drift: [0.012, 0.007],   // normal-map offset per second (the ripples' travel), two directions
	envRotation: 1.47,       // the sky's turn (radians) — where the bright side of it lands on the water
	envIntensity: 1,         // how much sky the surface reflects
	sun: { color: 0xffffff, intensity: 3.9, pos: [26, 53, 8] },
	ambient: 0.9,
	overlay: { strength: 1, brightness: 1.8, saturation: 1.2 },   // their ocean texture as the body's colour
	exposure: 1,
	camera: { fov: 35, height: 80, forward: 10 },
	mouse: 3,                // deg of tilt with the cursor
	edge: 0.28,              // of the height: the top and bottom sink into the page's ground (dithered canvas, no banding)
	ground: '#05080f',
};

export function createOcean({ canvas, section, cfg = OCEAN }) {
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
	renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = cfg.exposure;
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.setClearColor(new THREE.Color(cfg.ground), 1);
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(cfg.camera.fov, 1, 0.1, 500);
	camera.position.set(0, cfg.camera.height, cfg.camera.forward); camera.lookAt(0, 0, 0);
	scene.add(new THREE.AmbientLight(0xffffff, cfg.ambient));
	const sun = new THREE.DirectionalLight(cfg.sun.color, cfg.sun.intensity); sun.position.set(...cfg.sun.pos); scene.add(sun);

	const loader = new THREE.TextureLoader();
	const load = (src) => new Promise((res, rej) => loader.load(src, res, undefined, rej));
	let water = null, normal = null;
	Promise.all([load('assets/ocean/water-normal.webp'), load('assets/ocean/ocean-envmap.webp'), load('assets/ocean/ocean-overlay.webp')]).then(([n, env, overlay]) => {
		// the sky the water reflects
		const pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader();
		env.colorSpace = THREE.SRGBColorSpace; env.mapping = THREE.EquirectangularReflectionMapping;
		scene.environment = pmrem.fromEquirectangular(env).texture; scene.environmentRotation = new THREE.Euler(0, cfg.envRotation, 0); scene.environmentIntensity = cfg.envIntensity;
		pmrem.dispose();
		// the ripples
		normal = n; n.wrapS = n.wrapT = THREE.RepeatWrapping; n.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy()); n.center.set(0.5, 0.5); n.rotation = cfg.normalRotation; n.repeat.set(cfg.normalRepeat, cfg.normalRepeat);
		// the body's colour: their top-down ocean, brightened and saturated a little (a map, so the PBR light still shapes it)
		overlay.colorSpace = THREE.SRGBColorSpace; overlay.wrapS = overlay.wrapT = THREE.RepeatWrapping;
		const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(cfg.color), roughness: cfg.roughness, metalness: cfg.metalness, normalMap: n, normalScale: new THREE.Vector2(cfg.normalScale, cfg.normalScale), map: overlay });
		mat.onBeforeCompile = (sh) => {
			sh.uniforms.uOv = { value: cfg.overlay.strength }; sh.uniforms.uOvB = { value: cfg.overlay.brightness }; sh.uniforms.uOvS = { value: cfg.overlay.saturation };
			sh.fragmentShader = sh.fragmentShader
				.replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform float uOv, uOvB, uOvS;')
				.replace('#include <map_fragment>', `
					#ifdef USE_MAP
					vec4 ovc = texture2D( map, vMapUv );
					vec3 ov = ovc.rgb * uOvB;
					float lum = dot(ov, vec3(0.299, 0.587, 0.114));
					ov = mix(vec3(lum), ov, uOvS);
					diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * ov * 2.0, uOv);
					#endif`);
		};
		water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 1, 1), mat);
		water.rotation.x = -Math.PI / 2;
		scene.add(water);
	}).catch((e) => console.warn('ocean textures', e));

	// the edges: a dithered fade to the page's ground over the WebGL canvas (a CSS gradient would band on this dark)
	const veil = document.createElement('canvas'); veil.className = 'work__ocean-veil'; canvas.after(veil);
	const vctx = veil.getContext('2d');
	function paintVeil(W, H) {
		veil.width = Math.max(2, Math.round(W / 4)); veil.height = Math.max(2, Math.round(H / 2));
		const img = vctx.createImageData(veil.width, veil.height), d = img.data, g = new THREE.Color(cfg.ground);
		const e = cfg.edge;
		for (let y = 0; y < veil.height; y++) {
			const v = y / (veil.height - 1);
			const t = v < e ? 1 - v / e : v > 1 - e ? 1 - (1 - v) / e : 0;
			const a = t * t * (3 - 2 * t);
			for (let x = 0; x < veil.width; x++) { const i = (y * veil.width + x) * 4; d[i] = g.r * 255; d[i + 1] = g.g * 255; d[i + 2] = g.b * 255; d[i + 3] = Math.max(0, Math.min(255, Math.floor(a * 255 + Math.random()))); }
		}
		vctx.putImageData(img, 0, 0);
	}

	const mouse = { x: 0, y: 0 }, lean = { x: 0, y: 0 };
	addEventListener('pointermove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
	function resize() {
		const r = section.getBoundingClientRect();
		const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
		renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
		paintVeil(W, H);
	}
	addEventListener('resize', resize); resize();

	let on = false, last = performance.now(), raf = 0;
	const io = new IntersectionObserver((es) => { on = es.some((e) => e.isIntersecting); if (on && !raf) raf = requestAnimationFrame(frame); }, { threshold: 0.01 });
	io.observe(section);
	function frame(now) {
		raf = 0;
		const dt = Math.min(0.1, (now - last) / 1000); last = now;
		lean.x += (mouse.x - lean.x) * Math.min(1, dt * 2); lean.y += (mouse.y - lean.y) * Math.min(1, dt * 2);
		if (normal) { const k = reduced ? 0.4 : 1; normal.offset.x += cfg.drift[0] * dt * k; normal.offset.y += cfg.drift[1] * dt * k; }
		const t = THREE.MathUtils.degToRad(cfg.mouse);
		camera.position.set(Math.sin(lean.x * t) * cfg.camera.height, cfg.camera.height, cfg.camera.forward + Math.sin(lean.y * t) * cfg.camera.height * 0.5);
		camera.lookAt(0, 0, 0);
		renderer.render(scene, camera);
		if (on) raf = requestAnimationFrame(frame);
	}
	return { cfg, renderer, scene, get water() { return water; } };
}
