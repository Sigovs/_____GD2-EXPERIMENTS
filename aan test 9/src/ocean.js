/*
 * ocean.js — VERSION 4 (Alex, 20 Sep): a live sea surface under the last chapter, seen from above at night — after
 * unitedcarriers.com (their water textures stand in: assets/ocean/README.txt). three.js Water (addons): a normal-mapped
 * plane with a low sun, our night blue, fog to the page's ground so the horizon dissolves into it.
 *
 * Draws only while its section is on screen (IntersectionObserver); dpr capped at 1.5; the cursor tilts the view a
 * little. Under reduced motion the surface still moves (it is the picture, not a transition), just slower.
 */
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';

export const OCEAN = {
	color: 0x0a2a4e,       // the water's own colour (night)
	sun: 0xe6eeff,         // the low light on the ripples (a moon)
	sunDir: [0.2, 0.22, -1],
	sky: 0x0d1c30,         // what the surface reflects (a dome, no picture)
	distortion: 3.6,
	size: 6,               // ripple scale (Water's `size`)
	speed: 0.45,           // time scale
	tilt: 34,              // deg: the camera looks down at the surface (90 = straight down); low = the moon's path stretches toward us
	height: 26,            // camera height
	fog: 0x05080f,         // the page's ground
	fogNear: 30, fogFar: 260,
	mouse: 2.5,            // deg of tilt with the cursor
};

export function createOcean({ canvas, section, cfg = OCEAN }) {
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
	renderer.setClearColor(cfg.fog, 1);
	const scene = new THREE.Scene();
	scene.fog = new THREE.Fog(cfg.fog, cfg.fogNear, cfg.fogFar);
	const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 400);
	const sun = new THREE.Vector3(...cfg.sunDir).normalize();
	const normals = new THREE.TextureLoader().load('assets/ocean/water-normal.webp', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
	const water = new Water(new THREE.PlaneGeometry(600, 600), {
		textureWidth: 512, textureHeight: 512,
		waterNormals: normals,
		sunDirection: sun, sunColor: cfg.sun, waterColor: cfg.color,
		distortionScale: cfg.distortion, fog: true,
	});
	water.rotation.x = -Math.PI / 2;
	water.material.uniforms.size.value = cfg.size;
	scene.add(water);
	// a dome for the surface to reflect — one dark tone; the ripples read against it
	scene.add(new THREE.Mesh(new THREE.SphereGeometry(380, 24, 16), new THREE.MeshBasicMaterial({ color: cfg.sky, side: THREE.BackSide, fog: false })));

	const mouse = { x: 0, y: 0 }, lean = { x: 0, y: 0 };
	addEventListener('pointermove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });

	let W = 0, H = 0;
	function resize() {
		const r = section.getBoundingClientRect();
		W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
		renderer.setSize(W, H, false);
		camera.aspect = W / H; camera.updateProjectionMatrix();
	}
	addEventListener('resize', resize); resize();

	let on = false, last = performance.now(), raf = 0;
	const io = new IntersectionObserver((es) => { on = es.some((e) => e.isIntersecting); if (on && !raf) raf = requestAnimationFrame(frame); }, { threshold: 0.01 });
	io.observe(section);
	function frame(now) {
		raf = 0;
		const dt = Math.min(0.1, (now - last) / 1000); last = now;
		lean.x += (mouse.x - lean.x) * Math.min(1, dt * 2); lean.y += (mouse.y - lean.y) * Math.min(1, dt * 2);
		water.material.uniforms.time.value += dt * cfg.speed * (reduced ? 0.4 : 1);
		const tilt = THREE.MathUtils.degToRad(cfg.tilt + lean.y * cfg.mouse), yaw = THREE.MathUtils.degToRad(lean.x * cfg.mouse);
		camera.position.set(Math.sin(yaw) * 4, cfg.height, 0);
		camera.lookAt(Math.sin(yaw) * 4, 0, -cfg.height / Math.tan(tilt));
		renderer.render(scene, camera);
		if (on) raf = requestAnimationFrame(frame);
	}
	return { cfg, water, renderer };
}
