import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/*
 * rock-rim.js — a 3-D rocky rim between the mountain world and the ocean (prototype).
 * Free "Cliffs and Rock Formations" pack (snow variants): Cliff C spires + Rock Formation D
 * boulders, arranged as a foreground shelf in front of the camera. The group is a
 * camera-relative card (positioned every frame like the billboards) but its contents are
 * real geometry: real silhouettes, real light, real parallax when the mouse moves.
 *
 * Lighting: one directional "moon" + a fill on a private layer (ROCK_LAYER) so the rest of
 * the scene (custom shaders anyway) is untouched. Depth: the rim is drawn last with the
 * depth buffer cleared first, so it occludes everything (clouds, sea, video) and still
 * self-occludes correctly.
 */

export const ROCK_LAYER = 3;

export const ROCK_RIM = {
	enabled: true,
	distance: 80,                // units in front of the camera (the card's origin)
	// layout in the card's frame: x across (units), y up, z toward the camera; the frame at 80 units is ~50 units tall
	// layout is authored for a frame 50 units tall (the card is scaled to the real frame height); `xFrac` = fraction of the
	// frame's HALF-WIDTH (−1 = left edge, +1 = right edge), so the gate hugs the edges on every aspect
	pieces: [
		{ model: 'cliffC', xFrac: -0.86, pos: [0, -96, 6], rot: [0.05, 0.35, 0.12],  scale: 1.65 },
		{ model: 'cliffC', xFrac: 0.88,  pos: [0, -92, 2], rot: [0.05, 2.15, -0.1],  scale: 1.5 },
	],
	textures: 'plain',
	light: { dir: [-0.45, 0.8, 0.5], color: 0xb9c8e6, intensity: 1.7, fill: 0x1c2940, fillIntensity: 1.1 },
	rimLight: { dir: [0.1, -1, 0.35], color: 0x3a7fc4, intensity: 2.6 },   // cool blue from the ocean below, on the undersides / inner edges
	tint: 0x4e5868,              // dark charcoal-navy stone (reads against the black canyon, not lost in it)
	envMapIntensity: 0.2,
};

function centreGeometry(mesh) {
	mesh.geometry.computeBoundingBox();
	const b = mesh.geometry.boundingBox;
	const c = new THREE.Vector3(); b.getCenter(c);
	mesh.geometry.translate(-c.x, -b.min.y, -c.z);   // stand on y = 0, centred in x / z
	mesh.geometry.computeVertexNormals();
}

export function createRockRim({ textureLoader, envMap }) {
	const cfg = ROCK_RIM;
	const group = new THREE.Group();
	group.name = 'RockRim';
	group.visible = false;

	const tex = (f, srgb) => { const t = textureLoader.load(`assets/rocks/${f}`); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
	const v = cfg.textures === 'snow' ? '_snow' : '';
	const mat = (n) => new THREE.MeshStandardMaterial({ map: tex(`${n}${v}_basecolor.jpg`, true), normalMap: tex(`${n}${v}_normal.jpg`), roughnessMap: tex(`${n}${v}_roughness.jpg`), envMap, envMapIntensity: cfg.envMapIntensity, color: cfg.tint, roughness: 1, metalness: 0 });
	const materials = { cliffC: mat('cliffC'), rockD: mat('rockD') };

	// lights on the private layer
	const sun = new THREE.DirectionalLight(cfg.light.color, cfg.light.intensity);
	sun.position.fromArray(cfg.light.dir).multiplyScalar(100);
	sun.layers.set(ROCK_LAYER);
	const fill = new THREE.HemisphereLight(cfg.light.fill, 0x05070d, cfg.light.fillIntensity);
	fill.layers.set(ROCK_LAYER);
	const rimLight = new THREE.DirectionalLight(cfg.rimLight.color, cfg.rimLight.intensity);
	rimLight.position.fromArray(cfg.rimLight.dir).multiplyScalar(100);
	rimLight.layers.set(ROCK_LAYER);
	group.add(sun, sun.target, fill, rimLight, rimLight.target);

	const loader = new OBJLoader();
	const loaded = {};
	const meshes = [];
	let lastClear = -1;
	const build = () => {
		cfg.pieces.forEach((p) => {
			const src = loaded[p.model];
			if (!src) return;
			const m = new THREE.Mesh(src, materials[p.model]);
			m.userData.piece = p;
			m.position.fromArray(p.pos);
			m.rotation.set(...(p.rot ?? [0, p.rotY ?? 0, 0]));
			m.scale.setScalar(p.scale);
			m.layers.set(ROCK_LAYER);
			m.renderOrder = 1.45;         // after the ocean plate (1.4)
			m.frustumCulled = false;
			// drawn last: clear the depth once per frame before the FIRST rim mesh actually drawn (the sort order among
			// equal renderOrders is by depth, so any of them can be first) — the rim then occludes clouds / sea / video
			m.onBeforeRender = (renderer) => {
				const f = renderer.info.render.frame;
				if (lastClear !== f) { lastClear = f; renderer.state.buffers.depth.setMask(true); renderer.clearDepth(); }   // glClear honours the depth mask: the previous (video) material left it off
			};
			group.add(m);
			meshes.push(m);
		});
	};
	for (const [name, file] of [['cliffC', 'cliffC.obj'], ['rockD', 'rockD.obj']]) {
		loader.load(`assets/rocks/${file}`, (obj) => {
			// the OBJ is several sub-objects (a formation): merge them into one geometry
			const parts = [];
			obj.traverse((o) => { if (o.isMesh) { const g = o.geometry.clone(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); parts.push(g); } });
			const geo = parts.length > 1 ? mergeGeometries(parts, false) : parts[0];
			const mesh = new THREE.Mesh(geo);
			centreGeometry(mesh);
			loaded[name] = geo;
			if (loaded.cliffC && loaded.rockD) build();
		});
	}

	// the rocks are opaque but must sort AFTER the transparent ocean plate → mark them transparent (opacity 1)
	Object.values(materials).forEach((m) => { m.transparent = true; m.opacity = 1; m.depthWrite = true; });

	/** Fit the layout to the real frame: `frameH`, `frameW` in world units at the card's distance. */
	function fit(frameH, frameW) {
		const k = frameH / 50;
		group.scale.setScalar(k);
		meshes.forEach((m) => { const p = m.userData.piece; m.position.x = p.xFrac != null ? p.xFrac * (frameW / 2) / k : p.pos[0]; });
	}
	return { group, meshes, materials, cfg, fit };
}
