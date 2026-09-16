import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import {
	mountainVertex, mountainFragment,
	peaksVertex, peaksFragment,
	cloudVertex, cloudFragment,
	skyVertex, skyFragment,
	nightSkyVertex, nightSkyFragment,
	mouseVertex, mouseFragment,
} from './shaders.js';
import { MAIN_MOUNTAIN, BABY_MOUNTAINS } from './mountain-config.js';
import { SKY, NIGHT_SKY } from './sky-config.js';
import { MOUNTAIN_DESCENT } from './descent-config.js';
import { createDescent } from './descent.js';
import { createCloudFloor, CLOUD_FLOOR } from './cloud-floor.js';
import { createHeroText, HERO_TEXT } from './hero-text.js';
import { createAbyssTransition, ABYSS_TRANSITION } from './abyss-transition.js';
import { createDebugLayer } from './debug-layer.js';

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

/*
 * Responsive zoom-out limit. The cloud block has a finite width, so the wider
 * the viewport (larger horizontal FOV) the closer the camera must stay to keep
 * the outer cloud quads and the dark gap below them out of frame. Measured on
 * the current cloud placement: 16:9 → 1.45, 21:9 → ~1.25, 32:9 → ~0.78.
 * Linear in aspect, clamped; recomputed on every resize.
 */
const ZOOM_LIMIT = {
	baseMaxZoomOut: 1.45,        // 16:9 and narrower
	referenceAspect: 16 / 9,
	aspectFalloff: 0.38,         // zoom removed per unit of aspect beyond the reference
	ultrawideMaxZoomOut: 0.7,    // floor for extreme aspects
};
function getResponsiveZoomLimit(aspect) {
	const over = Math.max(0, aspect - ZOOM_LIMIT.referenceAspect);
	return THREE.MathUtils.clamp(ZOOM_LIMIT.baseMaxZoomOut - ZOOM_LIMIT.aspectFalloff * over, ZOOM_LIMIT.ultrawideMaxZoomOut, ZOOM_LIMIT.baseMaxZoomOut);
}
let zoomLimit = ZOOM_LIMIT.baseMaxZoomOut;
let descentRef = null; // set once the descent route exists (resize needs it)
let heroTextRef = null;

const SETTINGS = {
	autoRotateSpeed: 0.035,  // rad/s, full turn ≈ 180 s. 0 = off
	cloudSpeed: 0.28,        // time scale of the cloud drift (1 = original mont-fort speed; tuned 2026-09-15)
	cloudEdgeFeather: 0.15,  // softness of the cloud quads' solid core edge (0.1 = original mont-fort)
	dragSpeed: 0.005,        // rad per px
	zoomMin: 0.55,
	zoomMax: ZOOM_LIMIT.baseMaxZoomOut, // 16:9 value; the live limit is getResponsiveZoomLimit(camera.aspect)
	zoom: 1,                 // 1 = original hero camera distance
	parallax: 1,             // mouse parallax intensity, 0 = off
	mouseTrail: true,        // mouse wake in clouds / snow
	debug: new URLSearchParams(location.search).has('debug'), // debug overlay, also toggled with `D`
};

// Fixed scene rig (from the original homepage preset) — not mountain-specific.
// the mountain's and the peaks' distance haze (also the day sky's light colour). Night value set by
// Alex in the tuning panel (2026-09-14); the original homepage rig had 0xe8ecef.
const LIGHT_COLOR = new THREE.Color(0x2b3740);
const DARK_COLOR = new THREE.Color(0x5c7183);
const CAMERA_POSITION = new THREE.Vector3(175.856, 45.821, -51.137);
const CAMERA_LOOK_AT = new THREE.Vector3(-5.934, -4.881, 54.620);
const SCENE_FILE = 'assets/models/mountains.glb'; // Skybox + Clouds (+ authored camera paths) live here

// Everything below that mentions a mountain comes from mountain-config.js.
const SUMMIT = new THREE.Vector3().fromArray(MAIN_MOUNTAIN.summit);
const PIVOT = new THREE.Vector3(SUMMIT.x, 0, SUMMIT.z); // orbit axis through the summit
const BAKED_LIGHT_DIR = new THREE.Vector3().fromArray(MAIN_MOUNTAIN.relight.bakedLightDir).normalize();

/* ------------------------------------------------------------------ */
/* Renderer / scene                                                    */
/* ------------------------------------------------------------------ */

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setClearColor(0xffffff, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 1, 1000);

const shared = {
	uTime: { value: 0 },
	uResolution: { value: new THREE.Vector2() },
	uRatio: { value: 1 },
	uLightColor: { value: LIGHT_COLOR },
	uDarkColor: { value: DARK_COLOR },
	uPixelAngle: { value: 0.001 },
	uCloudTime: { value: 0 },   // clouds run on their own clock so their drift speed can be tuned
};

function resize() {
	const w = window.innerWidth, h = window.innerHeight;
	const dpr = Math.min(2, window.devicePixelRatio);
	renderer.setPixelRatio(dpr);
	renderer.setSize(w, h);
	camera.aspect = w / h;
	camera.updateProjectionMatrix();
	zoomLimit = getResponsiveZoomLimit(camera.aspect);
	shared.uResolution.value.set(w * dpr, h * dpr);
	shared.uRatio.value = w / h;
	descentRef?.resize(shared.uResolution.value);
	heroTextRef?.layout();
	shared.uPixelAngle.value = THREE.MathUtils.degToRad(camera.fov) / (h * dpr); // angular size of one device pixel (night sky star sizing)
}
window.addEventListener('resize', resize);
resize();

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
const exrLoader = new EXRLoader();

const loadTexture = (url, repeat = true) => url ? textureLoader.loadAsync(url).then((t) => {
	if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
	return t;
}) : Promise.resolve(null);

const gltfCache = new Map();
const loadGltf = (url) => {
	if (!gltfCache.has(url)) gltfCache.set(url, gltfLoader.loadAsync(url));
	return gltfCache.get(url);
};

const [
	sceneGltf, mainGltf, babyGltf, envExr,
	noise, perlin,
	rockNormal, rockDiffuse, snowRockMix, lightmap, babyBaseColor,
] = await Promise.all([
	loadGltf(SCENE_FILE),
	loadGltf(MAIN_MOUNTAIN.file),
	loadGltf(BABY_MOUNTAINS.file),
	exrLoader.loadAsync('assets/textures/envmap-min.exr'),
	loadTexture('assets/textures/noise.webp'),
	loadTexture('assets/textures/perlinNoise.webp'),
	loadTexture(MAIN_MOUNTAIN.textures.rockNormal),
	loadTexture(MAIN_MOUNTAIN.textures.rockDiffuse),
	loadTexture(MAIN_MOUNTAIN.textures.snowRockMix, false),
	loadTexture(MAIN_MOUNTAIN.textures.lightmap, false),
	loadTexture(BABY_MOUNTAINS.textures.baseColor, false),
]);

// PMREM environment, same layout constants as the original pipeline
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const envMap = pmrem.fromEquirectangular(envExr).texture;
const envHeight = envMap.image.height;
const envDefines = {
	CUBEUV_MAX_MIP: `${Math.log2(envHeight) - 2}.0`,
	CUBEUV_TEXEL_WIDTH: 1 / (3 * Math.max(Math.pow(2, Math.log2(envHeight) - 2), 112)),
	CUBEUV_TEXEL_HEIGHT: 1 / envHeight,
};
envExr.dispose();
pmrem.dispose();

const whiteTexture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
whiteTexture.needsUpdate = true;

/* ------------------------------------------------------------------ */
/* Mouse trail                                                         */
/* ------------------------------------------------------------------ */

class MouseTrail {
	constructor(size = 512) {
		const geometry = new THREE.BufferGeometry()
			.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3))
			.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
		this.material = new THREE.ShaderMaterial({
			vertexShader: mouseVertex,
			fragmentShader: mouseFragment,
			uniforms: {
				tLast: { value: null },
				uMouse: { value: new THREE.Vector2() },
				uMouseVelocity: { value: new THREE.Vector2() },
				tNoise: { value: noise },
				uTime: shared.uTime,
			},
			dithering: true,
			depthTest: false,
			depthWrite: false,
		});
		this.mesh = new THREE.Mesh(geometry, this.material);
		this.mesh.frustumCulled = false;
		this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		const opts = { type: THREE.HalfFloatType, depthBuffer: false };
		this.rt1 = new THREE.WebGLRenderTarget(size, size, opts);
		this.rt2 = new THREE.WebGLRenderTarget(size, size, opts);
		this.frame = 0;
		this.velocity = new THREE.Vector2();
	}
	update(dt, target) {
		const u = this.material.uniforms;
		this.velocity.subVectors(target, u.uMouse.value);
		u.uMouseVelocity.value.lerp(this.velocity, dt * 2);
		u.uMouse.value.lerp(target, dt * 3);
		const [write, read] = this.frame++ % 2 === 0 ? [this.rt1, this.rt2] : [this.rt2, this.rt1];
		u.tLast.value = read.texture;
		renderer.setRenderTarget(write);
		renderer.clear();
		renderer.render(this.mesh, this.camera);
		renderer.setRenderTarget(null);
	}
	get texture() { return this.rt1.texture; }
}
const mouseTrail = new MouseTrail();

const uvTransform = (repeatX, repeatY) => new THREE.Matrix3().setUvTransform(0, 0, repeatX, repeatY, 0, 0, 0);
const envRotation = (y) => new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, y, 0)));

/* ------------------------------------------------------------------ */
/* Mountain helpers (config-driven)                                    */
/* ------------------------------------------------------------------ */

const DEG = THREE.MathUtils.degToRad;

/** First mesh in a glTF scene, or the mesh with the given name. */
function pickMesh(root, name) {
	let mesh = name ? root.getObjectByName(name) : null;
	if (mesh && !mesh.isMesh) mesh = null;
	if (!mesh) root.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
	if (!mesh) throw new Error(`No mesh found in ${root.name || 'glTF'} (wanted "${name}")`);
	return mesh;
}

/** Apply a config transform ({position, rotation(deg XYZ), scale}) or keep the file's. */
function applyTransform(object, transform) {
	if (!transform) return;
	if (transform.position) object.position.fromArray(transform.position);
	if (transform.rotation) object.rotation.set(DEG(transform.rotation[0]), DEG(transform.rotation[1]), DEG(transform.rotation[2]), 'XYZ');
	if (transform.scale) object.scale.fromArray(transform.scale);
}

/** Make sure the geometry has what the shaders need; warn about what it lacks. */
function checkGeometry(mesh, label) {
	const g = mesh.geometry;
	if (!g.attributes.normal) { g.computeVertexNormals(); console.warn(`[${label}] no normals in file — computed`); }
	if (!g.attributes.uv) console.warn(`[${label}] no UVs — lightmap / mix map / rock texture cannot be sampled correctly`);
	// Tangents are not required: the shaders build a tangent frame from screen-space derivatives.
}

/* ------------------------------------------------------------------ */
/* Main mountain                                                       */
/* ------------------------------------------------------------------ */

const sceneRoot = sceneGltf.scene;
const skybox = sceneRoot.getObjectByName('Skybox');
const cloudsGroup = sceneRoot.getObjectByName('Clouds');

const mountain = pickMesh(mainGltf.scene, MAIN_MOUNTAIN.node);
// Detach from its file hierarchy: the world transform is the node's own transform
// (the current file has no parent transforms above the mountain node).
mountain.removeFromParent();
applyTransform(mountain, MAIN_MOUNTAIN.transform);
checkGeometry(mountain, 'MainMountain');

// The asset's own PBR material (kept for the 'rodin' and 'hybrid' material modes)
const sourceMaterial = mountain.material;
const materialMode = new URLSearchParams(location.search).get('material') || MAIN_MOUNTAIN.materialMode || 'gd2';
const hasSourceMaps = !!(sourceMaterial?.map && sourceMaterial?.normalMap);

const mm = MAIN_MOUNTAIN.material;
const mountainDefines = { ...envDefines };
if (!lightmap) mountainDefines.NO_LIGHTMAP = 1;
if (!snowRockMix) mountainDefines.NO_MIXMAP = 1;
if (materialMode === 'hybrid' && hasSourceMaps) mountainDefines.USE_SOURCE_MAPS = 1;
if (materialMode === 'hybrid' && !hasSourceMaps) console.warn('[MainMountain] hybrid mode requested but the GLB has no diffuse+normal maps — using gd2');

const gd2Material = new THREE.ShaderMaterial({
	vertexShader: mountainVertex,
	fragmentShader: mountainFragment,
	defines: mountainDefines,
	uniforms: {
		uColor: { value: new THREE.Color(mm.color) },
		uMetalness: { value: mm.metalness },
		uRoughness: { value: mm.roughness },
		uAmbient: { value: new THREE.Color(mm.ambient) },
		uAmbientIntensity: { value: mm.ambientIntensity },
		tMap2: { value: rockDiffuse },
		uMap2Transform: { value: uvTransform(mm.rockRepeat[0], mm.rockRepeat[1]) },
		tMixMap: { value: snowRockMix ?? whiteTexture },
		tArmMap: { value: lightmap ?? whiteTexture },
		tRockNormal: { value: rockNormal },
		tNoise: { value: noise },
		tPerlin: { value: perlin },
		tMouse: { value: mouseTrail.texture },
		tEnvMap: { value: envMap },
		uEnvMapRotation: { value: envRotation(mm.envMapRotationY) },
		uEnvMapIntensity: { value: mm.envMapIntensity },
		uFogNear: { value: mm.fogNear },
		uFogFar: { value: mm.fogFar },
		uFog: { value: 1 },
		uNight: { value: 0 },
		uNightColor: { value: new THREE.Color(ABYSS_TRANSITION.mountain.nightColor) },
		uBakedLightDir: { value: BAKED_LIGHT_DIR },
		uLightDir: { value: BAKED_LIGHT_DIR.clone() },
		uLightK: { value: MAIN_MOUNTAIN.relight.k },
		uLightBase: { value: MAIN_MOUNTAIN.relight.base },
		uPivot: { value: new THREE.Vector2(PIVOT.x, PIVOT.z) },
		uFrontDir: { value: new THREE.Vector2(CAMERA_POSITION.x - PIVOT.x, CAMERA_POSITION.z - PIVOT.z).normalize() },
		uSideOnly: { value: MAIN_MOUNTAIN.authoredForHeroSideOnly ? 1 : 0 },
		tSrcDiffuse: { value: sourceMaterial?.map ?? whiteTexture },
		tSrcNormal: { value: sourceMaterial?.normalMap ?? whiteTexture },
		tSrcMR: { value: sourceMaterial?.roughnessMap ?? sourceMaterial?.metalnessMap ?? whiteTexture },
		uSrcNormalScale: { value: MAIN_MOUNTAIN.hybrid?.normalScale ?? 1 },
		uSnowCoverage: { value: MAIN_MOUNTAIN.hybrid?.snowCoverage ?? 0.5 },
		uSteepRock: { value: MAIN_MOUNTAIN.hybrid?.steepRock ?? 0 },
		uTime: shared.uTime,
		uResolution: shared.uResolution,
		uLightColor: shared.uLightColor,
	},
	side: THREE.FrontSide,
});

/**
 * 'rodin' mode: the GLB's MeshStandardMaterial as authored, placed in the scene's
 * light: same PMREM environment (+ rotation), an ambient term equal to the GD2
 * ambient irradiance, and the GD2 pseudo-depth fog injected before output.
 * Only the main mountain uses this; nothing else in the scene is lit by it.
 */
function makeSourcePbrMaterial(src) {
	const mat = src.clone();
	mat.side = THREE.FrontSide;
	mat.envMap = envMap;
	mat.envMapIntensity = mm.envMapIntensity;
	mat.envMapRotation = new THREE.Euler(0, mm.envMapRotationY, 0);
	mat.onBeforeCompile = (shader) => {
		shader.uniforms.uFogNear = gd2Material.uniforms.uFogNear;
		shader.uniforms.uFogFar = gd2Material.uniforms.uFogFar;
		shader.uniforms.uFog = gd2Material.uniforms.uFog;
		shader.uniforms.uLightColor = shared.uLightColor;
		shader.fragmentShader = shader.fragmentShader
			.replace('#include <common>', `#include <common>
uniform float uFogNear, uFogFar, uFog;
uniform vec3 uLightColor;
float gd2ViewZToOrthographicDepth(const in float viewZ, const in float near, const in float far) { return (viewZ + near) / (near - far); }
float gd2PerspectiveDepthToViewZ(const in float invClipZ, const in float near, const in float far) { return (near * far) / ((far - near) * invClipZ - far); }`)
			.replace('#include <opaque_fragment>', `
float gd2Depth = gd2ViewZToOrthographicDepth(gd2PerspectiveDepthToViewZ(gl_FragCoord.z, uFogNear, uFogFar), uFogNear, uFogFar);
gd2Depth = smoothstep(0.01, .3, gd2Depth) * uFog;
outgoingLight = mix(outgoingLight, uLightColor, gd2Depth);
#include <opaque_fragment>`);
	};
	return mat;
}

let sourceAmbient = null;
if (materialMode === 'rodin' && sourceMaterial?.isMeshStandardMaterial) {
	mountain.material = makeSourcePbrMaterial(sourceMaterial);
	sourceAmbient = new THREE.AmbientLight(new THREE.Color(mm.ambient), mm.ambientIntensity);
} else {
	mountain.material = gd2Material;
}
mountain.renderOrder = 0;
console.info(`[MainMountain] material mode: ${mountain.material === gd2Material ? (mountainDefines.USE_SOURCE_MAPS ? 'hybrid' : 'gd2') : 'rodin'}`);

/* ------------------------------------------------------------------ */
/* Baby mountains                                                      */
/* ------------------------------------------------------------------ */

const bm = BABY_MOUNTAINS.material;
function babyMaterial(src) {
	return new THREE.ShaderMaterial({
		vertexShader: peaksVertex,
		fragmentShader: peaksFragment,
		defines: { ...envDefines },
		uniforms: {
			uColor: { value: src?.color ? src.color.clone() : new THREE.Color(0xffffff) },
			uOpacity: { value: 1 },
			uMetalness: { value: 0 },
			uRoughness: { value: src?.roughness ?? 1 },
			uAmbient: { value: new THREE.Color(bm.ambient) },
			uAmbientIntensity: { value: bm.ambientIntensity },
			tMap: { value: babyBaseColor ?? src?.map ?? whiteTexture },
			tNormalMap: { value: rockNormal },
			uNormalMapTransform: { value: uvTransform(bm.normalRepeat[0], bm.normalRepeat[1]) },
			uNormalScale: { value: new THREE.Vector2().fromArray(bm.normalScale) },
			tNoise: { value: noise },
			tPerlin: { value: perlin },
			tMouse: { value: mouseTrail.texture },
			tEnvMap: { value: envMap },
			uEnvMapRotation: { value: envRotation(bm.envMapRotationY) },
			uEnvMapIntensity: { value: bm.envMapIntensity },
			uFogNear: gd2Material.uniforms.uFogNear,
			uFogFar: gd2Material.uniforms.uFogFar,
			uFog: gd2Material.uniforms.uFog,
			uNight: gd2Material.uniforms.uNight,
			uNightColor: gd2Material.uniforms.uNightColor,
			uTime: shared.uTime,
			uResolution: shared.uResolution,
			uLightColor: shared.uLightColor,
		},
		transparent: true,
		side: THREE.FrontSide,
	});
}

const peaksRoot = new THREE.Group();
peaksRoot.name = 'BabyMountains';
const babies = [];

if (BABY_MOUNTAINS.instances) {
	// Explicit placement: clone the mesh from the file for every instance
	for (const [i, inst] of BABY_MOUNTAINS.instances.entries()) {
		const src = pickMesh(babyGltf.scene, inst.node);
		const mesh = new THREE.Mesh(src.geometry, babyMaterial(src.material));
		mesh.name = `BabyMountain.${i}`;
		applyTransform(mesh, inst);
		mesh.renderOrder = inst.renderOrder ?? 0;
		babies.push(mesh);
	}
} else {
	// File placement: every mesh node in the file, with its own transform and extras.renderOrder
	babyGltf.scene.updateMatrixWorld(true);
	babyGltf.scene.traverse((obj) => {
		if (!obj.isMesh) return;
		const mesh = new THREE.Mesh(obj.geometry, babyMaterial(obj.material));
		mesh.name = obj.name;
		obj.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
		const override = BABY_MOUNTAINS.overrides?.[obj.name.replace(/\./g, '')];
		if (override?.scale) {
			if (override.keepTop) {
				obj.geometry.computeBoundingBox();
				mesh.position.y -= obj.geometry.boundingBox.max.y * mesh.scale.y * (override.scale - 1);
			}
			mesh.scale.multiplyScalar(override.scale);
		}
		mesh.renderOrder = obj.userData.renderOrder ?? 0;
		babies.push(mesh);
	});
}
babies.forEach((b) => checkGeometry(b, b.name));
peaksRoot.add(...babies);

/* ------------------------------------------------------------------ */
/* Clouds                                                              */
/* ------------------------------------------------------------------ */

const cloudMaterial = new THREE.ShaderMaterial({
	vertexShader: cloudVertex,
	fragmentShader: cloudFragment,
	uniforms: {
		uSize: { value: new THREE.Vector2(1, 1) },
		uEdgeFeather: { value: SETTINGS.cloudEdgeFeather },
		uDusk: { value: 0 },
		uDuskUpper: { value: ABYSS_TRANSITION.clouds.duskUpper },
		uDuskThin: { value: ABYSS_TRANSITION.clouds.duskThin },
		uDuskBand: { value: new THREE.Vector2().fromArray(ABYSS_TRANSITION.clouds.duskBand) },
		uDuskColor: { value: new THREE.Color(ABYSS_TRANSITION.clouds.duskColor) },
		uGlow: { value: 0 },
		uCrestNdc: { value: -2 },
		uGlowColor: { value: new THREE.Color(ABYSS_TRANSITION.glow.color) },
		tPerlin: { value: perlin },
		tNoise: { value: noise },
		tMouse: { value: mouseTrail.texture },
		uTime: shared.uCloudTime,
		uResolution: shared.uResolution,
		uRatio: shared.uRatio,
	},
	transparent: true,
	depthWrite: false,
	depthTest: false,
	side: THREE.FrontSide,
});
cloudsGroup.traverse((obj) => {
	if (!obj.isMesh) return;
	obj.material = cloudMaterial;
	obj.renderOrder = obj.userData.renderOrder ?? 0;
	// the FOREGROUND plates (+1) draw after the canyon (0.5) and the ocean glow (0.45) — the light is seen through them —
	// but behind the chasm edge (1.5): the rim's silhouette always reads (the plates below its crest part, shaders.js)
	obj.frustumCulled = false;
});

/* ------------------------------------------------------------------ */
/* Sky                                                                 */
/* ------------------------------------------------------------------ */

const skyMode = new URLSearchParams(location.search).get('sky') || SKY.mode || 'day';
const daySkyMaterial = new THREE.ShaderMaterial({
	vertexShader: skyVertex,
	fragmentShader: skyFragment,
	uniforms: {
		tNoise: { value: noise },
		uTime: shared.uTime,
		uResolution: shared.uResolution,
		uLightColor: shared.uLightColor,
		uDarkColor: shared.uDarkColor,
	},
	side: THREE.FrontSide,
	depthWrite: false,
});
// Night sky: same cylinder, everything derived from the view ray in world space,
// so the star field stays fixed to the sky whatever the cylinder / camera do.
const ns = NIGHT_SKY;
let skyPhoto = null;
if (ns.photo?.file && skyMode === 'night') {
	skyPhoto = await textureLoader.loadAsync(ns.photo.file);
	skyPhoto.colorSpace = THREE.SRGBColorSpace;
	skyPhoto.wrapS = THREE.MirroredRepeatWrapping;
	skyPhoto.wrapT = THREE.ClampToEdgeWrapping;
	skyPhoto.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
}
const nightSkyMaterial = new THREE.ShaderMaterial({
	vertexShader: nightSkyVertex,
	fragmentShader: nightSkyFragment,
	defines: skyPhoto ? { USE_SKY_PHOTO: 1 } : {},
	uniforms: {
		tPhoto: { value: skyPhoto ?? whiteTexture },
		uPhotoBlend: { value: ns.photo?.blend ?? 0 },
		uPhotoExposure: { value: ns.photo?.exposure ?? 1 },
		uPhotoFade: { value: ns.photo?.proceduralFade ?? 0 },
		uNightFall: { value: 0 },
		uNightSky: { value: ABYSS_TRANSITION.night.sky },
		uPhotoMap: { value: new THREE.Vector4(
			THREE.MathUtils.degToRad(ns.photo?.azimuthSpanDeg ?? 180),
			THREE.MathUtils.degToRad(ns.photo?.azimuthOffsetDeg ?? 0),
			THREE.MathUtils.degToRad(ns.photo?.elevationMinDeg ?? 0),
			THREE.MathUtils.degToRad(ns.photo?.elevationMaxDeg ?? 60)) },
		tNoise: { value: noise },
		uTime: shared.uTime,
		uPixelAngle: shared.uPixelAngle,
		uSkyTopColor: { value: new THREE.Color(ns.skyTopColor) },
		uSkyHorizonColor: { value: new THREE.Color(ns.skyHorizonColor) },
		uGradientPower: { value: ns.gradientPower },
		uHorizonGlow: { value: ns.horizonGlow },
		uHorizonGlowColor: { value: new THREE.Color(ns.horizonGlowColor) },
		uStarDensity: { value: ns.starDensity },
		uStarBrightness: { value: ns.starBrightness },
		uStarSize: { value: ns.starSize },
		uStarClustering: { value: ns.starClustering },
		uStarColor: { value: new THREE.Color(ns.starColor) },
		uTwinkleStrength: { value: ns.twinkleStrength },
		uTwinkleSpeed: { value: ns.twinkleSpeed },
		uStarFadeFraction: { value: ns.starFadeFraction ?? 0 },
		uStarFadeSpeed: { value: ns.starFadeSpeed ?? 0.25 },
		uDustStrength: { value: ns.dustStrength },
		uDustColor: { value: new THREE.Color(ns.dustColor) },
		uDustBandNormal: { value: new THREE.Vector3().fromArray(ns.dustBandTilt).normalize() },
		uDustBandWidth: { value: ns.dustBandWidth },
		uSummitGlowStrength: { value: ns.summitGlowStrength },
		uSummitGlowColor: { value: new THREE.Color(ns.summitGlowColor) },
		uSummitGlowRadius: { value: new THREE.Vector2().fromArray(ns.summitGlowRadius) },
		uSummitGlowLift: { value: ns.summitGlowLift },
		uSummitDir: { value: new THREE.Vector3(0, 0, 1) },
		uAtmoGlowDir: { value: atmosphericGlowDirection() },
		uAtmoGlowColor: { value: new THREE.Color(ns.atmosphericGlowColor) },
		uAtmoGlowStrength: { value: ns.atmosphericGlowStrength },
		uAtmoGlowRadius: { value: ns.atmosphericGlowRadius },
		uAtmoGlowNoiseAmount: { value: ns.atmosphericGlowNoiseAmount },
		uAtmoGlowNoiseScale: { value: ns.atmosphericGlowNoiseScale },
		uResolution: shared.uResolution,
		uMotion: { value: 1 },
		uAirglowStrength: { value: ns.airglow?.strength ?? 0 },
		uAirglowColor: { value: new THREE.Color(ns.airglow?.color ?? 0) },
		uAirglowShiftColor: { value: new THREE.Color(ns.airglow?.shiftColor ?? 0) },
		uAirglowScale: { value: new THREE.Vector2().fromArray(ns.airglow?.scale ?? [3, 1.4]) },
		uAirglowSpeed: { value: ns.airglow?.speed ?? 0 },
		uAirglowBand: { value: new THREE.Vector2().fromArray(ns.airglow?.band ?? [0, 0.5]) },
		uMeteorSlot: { value: ns.meteors?.slot ?? 5 },
		uMeteorChance: { value: ns.meteors?.chance ?? 0 },
		uMeteorDuration: { value: new THREE.Vector2().fromArray(ns.meteors?.duration ?? [0.7, 1.2]) },
		uMeteorTravel: { value: ns.meteors?.travel ?? 0.18 },
		uMeteorTail: { value: ns.meteors?.tail ?? 0.08 },
		uMeteorWidthPx: { value: ns.meteors?.widthPx ?? 1.5 },
		uMeteorBrightness: { value: ns.meteors?.brightness ?? 0 },
		uMeteorColor: { value: new THREE.Color(ns.meteors?.color ?? 0xffffff) },
		uMeteorZone: { value: new THREE.Vector2().fromArray(ns.meteors?.zone ?? [0.6, 0.95]) },
		uMeteorRadiant: { value: new THREE.Vector2().fromArray(ns.meteors?.radiant ?? [-0.25, 1.6]) },
	},
	side: THREE.FrontSide,
	depthWrite: false,
});
// prefers-reduced-motion: no meteors and the airglow veil holds still — the static night sky is the authored state
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const applyMotionPreference = () => { nightSkyMaterial.uniforms.uMotion.value = reducedMotion.matches ? 0 : 1; };
reducedMotion.addEventListener('change', applyMotionPreference);
applyMotionPreference();
// Fixed sky direction for the atmospheric lift: hero camera → summit, shifted by the config offset.
function atmosphericGlowDirection() {
	const dir = SUMMIT.clone().sub(CAMERA_POSITION).normalize();
	const az = Math.atan2(dir.z, dir.x) + ns.atmosphericGlowOffset[0];
	const el = Math.asin(dir.y) + ns.atmosphericGlowOffset[1];
	return new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
}
skybox.material = skyMode === 'night' ? nightSkyMaterial : daySkyMaterial;
console.info(`[Sky] mode: ${skyMode}`);
skybox.renderOrder = -10;
skybox.frustumCulled = false;
skybox.onBeforeRender = (_r, _s, cam) => { skybox.matrixWorld.copyPosition(cam.matrixWorld); };

/* ------------------------------------------------------------------ */
/* Scene graph                                                         */
/* ------------------------------------------------------------------ */

// Static world: mountain + baby mountains + sky
scene.add(mountain, peaksRoot, skybox);
if (sourceAmbient) scene.add(sourceAmbient); // only in 'rodin' material mode; ShaderMaterials ignore it

// Cloud rig turns with the camera around the summit so the cloud planes keep
// facing the viewer and the composition stays the hero one.
const cloudRig = new THREE.Group();
cloudRig.position.copy(PIVOT);
cloudsGroup.position.sub(PIVOT);
cloudRig.add(cloudsGroup);
scene.add(cloudRig);

// World-fixed cloud sea under the mountain (hides the base plate and the quad borders when the camera flies in)
const cloudFloor = createCloudFloor({ pivot: PIVOT, noise, perlin, cloudTime: shared.uCloudTime });
scene.add(cloudFloor.group);
cloudFloor.layers.forEach((l) => { l.material.uniforms.uDuskColor.value.set(ABYSS_TRANSITION.clouds.duskColor); l.material.uniforms.uGlowColor.value.set(ABYSS_TRANSITION.glow.color); });

// Transition to the canyon / ocean: chasm-edge plate + video billboards placed in front of the camera (see abyss-transition.js)
const abyss = createAbyssTransition({ textureLoader, pivot: PIVOT, noise: perlin, envMap, mouse: mouseTrail.texture, resolution: shared.uResolution.value });
camera.layers.enable(3);   // the rock rim's private light layer (rock-rim.js ROCK_LAYER)
scene.add(abyss.group);

/* v2 only — index_v2.html sets window.__VARIANT (or ?v=2): the moving mist veil that crosses the chasm crest, so the rock
   surfaces out of vapour that actually moves instead of out of a tint (src/mist.js). index.html is untouched by it. */
const VARIANT = window.__VARIANT ?? (new URLSearchParams(location.search).get('v') === '2' ? 'v2' : null);
let mist = null;
if (VARIANT === 'v2') {
	const { createMist } = await import('./mist.js');
	mist = createMist({ reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)') });
	scene.add(mist.mesh);
	console.info('[variant] v2 — mist veil on');
}

// Hero statement: a camera-parented quad drawn between the cloud layers (see hero-text.js)
scene.add(camera);
const heroText = await createHeroText({ camera });
heroTextRef = heroText;

/* ------------------------------------------------------------------ */
/* Descent route (scroll-driven)                                       */
/* ------------------------------------------------------------------ */

// Page = descent (first DESCENT_SHARE of the scroll, choreography unchanged) + abyss transition tail
const PAGE_VIEWPORTS = ABYSS_TRANSITION.enabled ? ABYSS_TRANSITION.totalViewports : MOUNTAIN_DESCENT.scrollViewports;
const DESCENT_SHARE = ABYSS_TRANSITION.enabled ? ABYSS_TRANSITION.descentShare : 1;
document.body.style.height = `${PAGE_VIEWPORTS * 100}vh`;
const descent = createDescent({
	scene, camera, mountain, pivot: PIVOT,
	resolution: shared.uResolution.value,
	labelRoot: document.getElementById('route-labels'),
	noise, envMap,
});
descentRef = descent;
scene.add(descent.group, descent.debugGroup);

/* Expedition camp on the mountain's central snow field (camp-config.js) — CAMP_CONFIG.enabled, or ?camp in the URL */
const { CAMP_CONFIG } = await import('./camp-config.js');
let camp = null;
if (CAMP_CONFIG.enabled || new URLSearchParams(location.search).has('camp')) {
	const { createCamp } = await import('./camp.js');
	camp = createCamp({
		mountain, gd2Material, camera, noise,
		resolution: shared.uResolution.value,
		time: shared.uTime,
		lightColor: shared.uLightColor,
		fogNear: gd2Material.uniforms.uFogNear,
		fogFar: gd2Material.uniforms.uFogFar,
		reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
		config: CAMP_CONFIG,
	});
	scene.add(camp.group);
}
window.__camp = camp;
const routeLabels = document.getElementById('route-labels');
const scroll = { target: 0, value: 0 };
function readScroll() {
	const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
	scroll.target = THREE.MathUtils.clamp(window.scrollY / max, 0, 1);
}
window.addEventListener('scroll', readScroll, { passive: true });
readScroll();

/* ------------------------------------------------------------------ */
/* Debug layer (off by default)                                        */
/* ------------------------------------------------------------------ */

// Authored camera / look-at splines from the scene file (LINE_STRIP primitives).
// The original site reverses the point order; index 0 after reversal = hero camera.
function pathPoints(name) {
	const obj = sceneRoot.getObjectByName(name);
	const attr = obj?.geometry?.attributes.position;
	if (!attr) return null;
	const pts = [];
	for (let i = 0; i < attr.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(attr, i));
	return pts.reverse();
}
scene.updateMatrixWorld(true);
const debug = createDebugLayer({
	mountain, babies,
	summit: SUMMIT, pivot: PIVOT,
	cameraPosition: CAMERA_POSITION, cameraLookAt: CAMERA_LOOK_AT,
	zoomMin: SETTINGS.zoomMin, zoomMax: SETTINGS.zoomMax,
	cameraPath: pathPoints('CameraPath'),
	targetPath: pathPoints('TargetPath'),
});
scene.add(debug.group);
const debugReadout = document.getElementById('debug-readout');
function setDebug(on) {
	SETTINGS.debug = on;
	descent.debugGroup.visible = on;
	if (debugReadout) debugReadout.hidden = !on;
	return on;
}
if (SETTINGS.debug) { debug.toggle(true); setDebug(true); }
window.addEventListener('keydown', (e) => { if (e.key === 'd' || e.key === 'D') setDebug(debug.toggle()); });

/* ------------------------------------------------------------------ */
/* Orbit                                                               */
/* ------------------------------------------------------------------ */

const orbit = {
	enabled: true,
	angle: 0,
	targetAngle: 0,
	zoom: SETTINGS.zoom,
	targetZoom: SETTINGS.zoom,
	dragging: false,
	lastX: 0,
	idleSince: 0,
};
const mouse = new THREE.Vector2();
const lerpedMouse = new THREE.Vector2();
const tmpDir = new THREE.Vector3();

canvas.addEventListener('pointerdown', (e) => {
	orbit.dragging = true;
	orbit.lastX = e.clientX;
	canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
	mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
	if (!orbit.dragging) return;
	orbit.targetAngle += (e.clientX - orbit.lastX) * SETTINGS.dragSpeed;
	orbit.lastX = e.clientX;
	orbit.idleSince = performance.now();
});
const endDrag = () => { orbit.dragging = false; orbit.idleSince = performance.now(); };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
// Wheel is the page scroll now — it drives the descent timeline (see descent-config.js).
// Zoom is choreographed by the timeline and still clamped by getResponsiveZoomLimit().

const baseOffset = CAMERA_POSITION.clone().sub(PIVOT);
const baseLookOffset = CAMERA_LOOK_AT.clone().sub(PIVOT);
const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();

function updateCamera(dt) {
	if (!orbit.enabled) return;
	const ds = descent.state;
	const idle = !orbit.dragging && performance.now() - orbit.idleSince > 1500 && ds.progress < MOUNTAIN_DESCENT.camera.autoRotateBelowProgress;
	if (idle) orbit.targetAngle += SETTINGS.autoRotateSpeed * dt;

	// The limit can drop on resize (wider viewport): pull the target in and let the damp ease into it
	if (orbit.targetZoom > zoomLimit) orbit.targetZoom = zoomLimit;
	orbit.angle = THREE.MathUtils.damp(orbit.angle, orbit.targetAngle, 6, dt);
	orbit.zoom = THREE.MathUtils.damp(orbit.zoom, orbit.targetZoom, 6, dt);

	// drag orbit + descent choreography (angle adds, zoom multiplies within the responsive limit, camera / look-at descend)
	const totalAngle = orbit.angle + THREE.MathUtils.degToRad(ds.angleDeg);
	const totalZoom = Math.min(orbit.zoom * ds.zoom, zoomLimit);
	tmpPos.copy(baseOffset).multiplyScalar(totalZoom).applyAxisAngle(THREE.Object3D.DEFAULT_UP, totalAngle).add(PIVOT);
	tmpLook.copy(baseLookOffset).applyAxisAngle(THREE.Object3D.DEFAULT_UP, totalAngle).add(PIVOT);
	tmpPos.y += ds.camDrop;
	tmpLook.y += ds.lookDrop;
	if (ds.follow > 0) tmpLook.lerp(ds.tip, ds.follow); // steer toward the route tip during the descent
	// transition: the mountain world holds its place (no lens shift) and only recedes a little (ABYSS_TRANSITION.camera.zoomMul); the new section rises over it
	const ab = abyss.state;
	if (ab.t > 0) {
		tmpPos.copy(baseOffset).multiplyScalar(Math.min(totalZoom * ab.zoomMul, zoomLimit)).applyAxisAngle(THREE.Object3D.DEFAULT_UP, totalAngle).add(PIVOT);
		tmpPos.y += ds.camDrop;
	}

	camera.position.copy(tmpPos);
	camera.lookAt(tmpLook);
	abyss.applyShift(camera);
	// billboards at fixed depths in front of the camera — placed BEFORE the mouse parallax so the chasm edge and the canyon
	// video react to mouse move like the world does (ABYSS_TRANSITION.camera.mouseParallax — approved, keep it this way)
	if (ABYSS_TRANSITION.camera.mouseParallax) { abyss.place(camera); mist?.place(camera, abyss.state.crest, abyss.state.shift); }

	lerpedMouse.lerp(mouse, dt * 0.5);
	camera.translateX(lerpedMouse.x * 0.1 * SETTINGS.parallax);
	camera.translateY(lerpedMouse.y * 0.2 * SETTINGS.parallax);
	camera.rotateY(-lerpedMouse.x * 0.05 * SETTINGS.parallax);
	camera.rotateX(lerpedMouse.y * 0.05 * SETTINGS.parallax);
	if (!ABYSS_TRANSITION.camera.mouseParallax) { abyss.place(camera); mist?.place(camera, abyss.state.crest, abyss.state.shift); }   // (locked to the frame instead — not the approved look)

	cloudRig.rotation.y = totalAngle;
	// abyss transition: the cloud layer comes FORWARD toward the viewer (the rig slides along the camera axis and grows
	// about its centre), so the near plates pass in front of the receding mountain — behind the chasm edge, in front of the canyon
	cloudRig.position.copy(PIVOT);
	cloudRig.scale.setScalar(1);
	if (abyss.state.t > 0) {
		tmpDir.copy(camera.position).sub(PIVOT).normalize();
		cloudRig.position.addScaledVector(tmpDir, abyss.state.cloudForward);
		cloudRig.scale.setScalar(abyss.state.cloudScale);
	}
	skybox.rotation.y = totalAngle; // keeps the cylinder's UV seam behind the camera
	gd2Material.uniforms.uLightDir.value.copy(BAKED_LIGHT_DIR).applyAxisAngle(THREE.Object3D.DEFAULT_UP, totalAngle);
}

/* ------------------------------------------------------------------ */
/* Loop                                                                */
/* ------------------------------------------------------------------ */

// Meteors belong to the pauses: while the route is being scrolled (the page's primary
// idea) they fade out, and they come back once the scroll has rested for a moment.
const METEOR_REST_MS = 1200;
const meteorBrightness = ns.meteors?.brightness ?? 0;
let meteorGate = 1;
let scrollRestSince = 0;

// the night of the abyss transition: the clouds' and the sea's dusk colour sinks from here toward the night colour
const CLOUD_DUSK = new THREE.Color(ABYSS_TRANSITION.clouds.duskColor);
const NIGHT_CLOUD = new THREE.Color(ABYSS_TRANSITION.night.cloudColor);

const clock = new THREE.Clock();
function tick() {
	const dt = Math.min(clock.getDelta(), 0.1);
	shared.uTime.value = clock.elapsedTime;
	shared.uCloudTime.value += dt * SETTINGS.cloudSpeed;
	scroll.value = THREE.MathUtils.damp(scroll.value, scroll.target, MOUNTAIN_DESCENT.scrollDamp, dt);
	if (Math.abs(scroll.value - scroll.target) < 0.0005) scroll.value = scroll.target;
	const now = performance.now();
	if (scroll.value !== scroll.target) scrollRestSince = now;
	meteorGate = THREE.MathUtils.damp(meteorGate, now - scrollRestSince > METEOR_REST_MS ? 1 : 0, 6, dt);
	nightSkyMaterial.uniforms.uMeteorBrightness.value = meteorBrightness * meteorGate;
	// angular velocity of the drag / idle orbit only (rad/s) — the scroll choreography's own turn is not in it
	const spin = dt > 0 ? (orbit.angle - (orbit.lastAngle ?? orbit.angle)) / dt : 0;
	orbit.lastAngle = orbit.angle;
	// the descent keeps its whole choreography on the first DESCENT_SHARE of the page; the tail is the abyss transition
	const descentP = Math.min(1, scroll.value / DESCENT_SHARE);
	const transP = DESCENT_SHARE < 1 ? Math.max(0, (scroll.value - DESCENT_SHARE) / (1 - DESCENT_SHARE)) : 0;
	descent.update(descentP, dt, camera, spin);
	camp?.update(descentP, abyss.state.nightFall);   // at night the camp is the only light: the fire twitches, its glow grows
	abyss.update(transP, descentP);
	mist?.update(transP, descentP, abyss.state.dusk, abyss.state.nightFall);   // v2: the veil takes the world's light (dusk → night)
	cloudMaterial.uniforms.uDusk.value = abyss.state.dusk;
	cloudMaterial.uniforms.uDuskThin.value = abyss.state.cloudThin;   // the cooled plates thin late, to reveal the depth
	cloudMaterial.uniforms.uGlow.value = abyss.state.glowClouds;     // the cold light from below, in the clouds
	cloudMaterial.uniforms.uCrestNdc.value = abyss.state.t > 0 ? 2 * abyss.state.crest : -2;
	gd2Material.uniforms.uNight.value = abyss.state.night;           // the mountain world recedes into night
	// the night falls over the whole mountain world (ABYSS_TRANSITION.night): sky toward black, clouds dark, route dimmed
	const nightFall = abyss.state.nightFall, nightCfg = ABYSS_TRANSITION.night;
	nightSkyMaterial.uniforms.uNightFall.value = nightFall;
	descent.state.night = nightFall * nightCfg.route;
	cloudMaterial.uniforms.uDusk.value = Math.max(abyss.state.dusk, nightFall * nightCfg.clouds);
	cloudMaterial.uniforms.uDuskUpper.value = THREE.MathUtils.lerp(ABYSS_TRANSITION.clouds.duskUpper, 1, nightFall);
	cloudMaterial.uniforms.uDuskColor.value.lerpColors(CLOUD_DUSK, NIGHT_CLOUD, nightFall);
	descent.state.labelFold = 1 - abyss.state.labelFade;   // the callouts belong to the mountain: they leave (plate out, leader retracts) as it goes
	descent.state.coverY = abyss.state.t > 0 && abyss.group.visible ? (0.5 - abyss.state.crest) * window.innerHeight : null;   // the rising crest's screen y: callouts leave before it reaches them
	// the glass plates' light follows the mouse (route.css reads --glass-angle): the sweep and the lit bevel turn with it
	const glassAngle = 135 - lerpedMouse.x * 40 + lerpedMouse.y * 25;
	if (Math.abs(glassAngle - (routeLabels.__glassAngle ?? 0)) > 0.25) { routeLabels.__glassAngle = glassAngle; routeLabels.style.setProperty('--glass-angle', `${glassAngle.toFixed(1)}deg`); }
	heroText.setExit(abyss.state.heroTextExit);   // the statement flies up and away into blur like the clouds
	for (const l of cloudFloor.layers) {
		l.material.uniforms.uDusk.value = Math.max(abyss.state.seaDusk, nightFall * nightCfg.clouds);
		l.material.uniforms.uDuskColor.value.lerpColors(CLOUD_DUSK, NIGHT_CLOUD, nightFall);
		l.material.uniforms.uGlow.value = abyss.state.glowSea;
	}
	updateCamera(dt);
	heroText.update(dt);
	if (SETTINGS.debug && debugReadout) debugReadout.textContent = `scroll ${scroll.value.toFixed(3)}  descent ${descentP.toFixed(3)}  abyss ${transP.toFixed(3)}  route u ${descent.state.u.toFixed(3)}  orbit ${(THREE.MathUtils.radToDeg(orbit.angle) + descent.state.angleDeg).toFixed(1)}°  zoom ${Math.min(orbit.zoom * descent.state.zoom, zoomLimit).toFixed(3)}`;
	if (skybox.material === nightSkyMaterial) nightSkyMaterial.uniforms.uSummitDir.value.subVectors(SUMMIT, camera.position).normalize();
	if (SETTINGS.mouseTrail) mouseTrail.update(dt, mouse);
	renderer.render(scene, camera);
	requestAnimationFrame(tick);
}
document.body.classList.add('is-ready');
tick();

// Tuning panel for the look (mountain, sky, path, callouts): ?tune in the URL, or press T
const openTune = () => {
	if (window.__tune) return;
	window.__tune = 'loading';
	import('./tune-panel.js')
		.then(({ createTunePanel }) => { window.__tune = createTunePanel(window.__mountain); })
		.catch((err) => { window.__tune = null; console.error('[tune] panel failed to load', err); });
};
if (new URLSearchParams(location.search).has('tune')) openTune();
window.addEventListener('keydown', (e) => {
	if ((e.key === 't' || e.key === 'T') && !window.__tune && !e.target.closest?.('input, textarea, select')) openTune();
});

window.__mountain = { SETTINGS, orbit, scene, camera, renderer, mouseTrail, cloudsGroup, mountain, peaksRoot, babies, debug, gd2Material, materialMode, skyMode, nightSkyMaterial, daySkyMaterial, skybox, ZOOM_LIMIT, getResponsiveZoomLimit, get zoomLimit() { return zoomLimit; }, descent, scroll, setDebug, cloudFloor, CLOUD_FLOOR, cloudMaterial, heroText, HERO_TEXT, abyss, ABYSS_TRANSITION, cloudRig, mist, VARIANT, MIST_CFG: mist?.cfg ?? null };
