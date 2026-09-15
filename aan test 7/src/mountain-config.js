/*
 * mountain-config.js — the ONLY place that knows about mountain geometry.
 *
 * Everything the scene assumes about the main mountain and the baby mountains
 * (files, node names, transforms, textures, material numbers, summit) lives
 * here. `mountain.js` reads this and never hard-codes a mountain value.
 *
 * The rest of the scene (clouds, sky, fog, camera, mouse, lighting rig) is NOT
 * configured here on purpose — it must stay untouched while mountains change.
 *
 * Coordinate system: three.js / glTF — Y up, units are "scene units"
 * (the hero camera sits ~180 units from the summit).
 *
 * See MOUNTAIN-REPLACEMENT.md for measured values and the replacement volume.
 */

/* ------------------------------------------------------------------ */
/* Main mountain                                                       */
/* ------------------------------------------------------------------ */

// The temporary mont-fort terrain tile (kept for A/B comparison).
export const MAIN_MOUNTAIN_TEMP_TILE = {
	// GLB that contains the mountain mesh. May contain other nodes; only `node`
	// is taken out of it.
	file: 'assets/models/mountains.glb',

	// Mesh name inside the GLB. null → first mesh found in the file.
	node: 'Mountain',

	// null → keep the node's own transform from the file.
	// Otherwise the file transform is REPLACED by this:
	//   { position: [x, y, z], rotation: [x, y, z] /* degrees, XYZ order */, scale: [x, y, z] }
	// Current file transform of 'Mountain': position [0, -3.242, 0], rotation [0,0,0], scale [1,1,1].
	transform: null,

	// World-space summit. Used as the orbit pivot (x, z), as the centre of the
	// "front side" test for the authored textures, and by the debug marker.
	// Measured from the current mesh: highest vertex (9.796, 52.917, 1.784) local
	// + node position y −3.242.
	summit: [9.80, 49.68, 1.78],

	textures: {
		// Baked lighting (AO + directional shading), R channel is used.
		// Sampled at (u, 1 − v) — i.e. authored for glTF UV convention, loaded with flipY = true.
		// null → no lightmap; shading falls back to the analytic directional term below.
		lightmap: 'assets/textures/homepage/homepage-lightmap.webp',

		// Snow / rock mask, R channel: 1 = snow, 0 = rock. Sampled at (u, 1 − v).
		// null → slope-based procedural mask everywhere.
		snowRockMix: 'assets/textures/snowRockMix.webp',

		// Tileable rock albedo (only the R channel is used, remapped to a blue-grey ramp).
		rockDiffuse: 'assets/textures/rock_diffuse.webp',

		// Tileable rock normal map (tangent space), also used by the baby mountains.
		rockNormal: 'assets/textures/rock_normal.webp',
	},

	// true  → lightmap + mix map were authored for the hero side only: the back
	//         half blends to procedural snow and to planar-mapped rock.
	// false → textures are valid all around (a real replacement asset): authored
	//         UVs and masks are used on every side.
	authoredForHeroSideOnly: true,

	material: {
		color: 0xffffff,
		roughness: 0.4,
		metalness: 0,
		ambient: 0xa7b8c5,
		ambientIntensity: 2.39,
		envMapIntensity: 0.33,
		envMapRotationY: -1.77,   // radians, rotation of the EXR environment around Y
		rockRepeat: [1, 50],      // UV repeat of rockDiffuse over the mountain's own UVs
		fogNear: 0.01,            // pseudo-depth fog range (shader units, not camera near/far)
		fogFar: 20,
	},

	// Directional term fitted to the current lightmap:
	//   lightmap ≈ base + k · dot(worldNormal, bakedLightDir)   (R² = 0.89)
	// Used to (a) re-light the mountain as the camera orbits and (b) shade a
	// replacement that ships without a lightmap.
	relight: {
		bakedLightDir: [0.262, 0.546, 0.796],
		k: 0.149,
		base: 0.133,
	},
};

/*
 * GD2 candidate #1 — "gora 1" (Rodin/Meshy generated, raw, un-optimised).
 * File: 3D_ASSETS/gora 1/EEdt0FRWfICkMgqnvxikm_base_basic_pbr.glb
 *   1 node / 1 mesh / 1 primitive, 47 608 verts / 90 258 tris, POSITION+NORMAL+TEXCOORD_0 (UV 0–1)
 *   local bbox [-0.941, -0.456, -0.938] … [0.933, 0.441, 0.938]  (1.874 × 0.897 × 1.876)
 *   local summit [0.107, 0.441, -0.393]; flat bottom plate at y = -0.456
 * Fit (see MOUNTAIN-REPLACEMENT.md §5): uniform scale 85 → footprint ≈ 159 × 159,
 * height ≈ 76; summit moved onto the pivot axis (9.8, ·, 1.8) at y ≈ 50; base at y ≈ -26.
 * The embedded PBR textures are ignored for this test — the GD2 shader runs in
 * NO_LIGHTMAP / NO_MIXMAP fallback mode.
 */
const GORA_1_SCALE = 85;
const GORA_1_LOCAL_SUMMIT = [0.107, 0.441, -0.393];
const GORA_1_ROTATION_Y = 90; // degrees — which side faces the hero camera (camera sits at +X / -Z). 0 = narrow spire, 90 = broad massif (chosen), 180/270 = blobby
const GORA_1_SUMMIT_Y = 50;

function placeSummitOnPivot(localSummit, scale, rotY, summitY, pivot = [9.8, 1.8]) {
	// position = pivot − R(rotY) · (scale · localSummit) so that the summit lands on the pivot axis
	const r = (rotY * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r);
	const sx = localSummit[0] * scale, sy = localSummit[1] * scale, sz = localSummit[2] * scale;
	const rx = c * sx + sn * sz, rz = -sn * sx + c * sz;
	return [pivot[0] - rx, summitY - sy, pivot[1] - rz];
}

export const MAIN_MOUNTAIN_GORA_1 = {
	file: '3D_ASSETS/gora 1/EEdt0FRWfICkMgqnvxikm_base_basic_pbr.glb',
	node: 'model',
	transform: {
		position: placeSummitOnPivot(GORA_1_LOCAL_SUMMIT, GORA_1_SCALE, GORA_1_ROTATION_Y, GORA_1_SUMMIT_Y),
		rotation: [0, GORA_1_ROTATION_Y, 0],
		scale: [GORA_1_SCALE, GORA_1_SCALE, GORA_1_SCALE],
	},
	summit: [9.8, GORA_1_SUMMIT_Y, 1.8],
	textures: {
		lightmap: null,        // → NO_LIGHTMAP (analytic light from `relight`)
		snowRockMix: null,     // → NO_MIXMAP  (slope-based snow)
		rockDiffuse: 'assets/textures/rock_diffuse.webp',
		rockNormal: 'assets/textures/rock_normal.webp',
	},
	authoredForHeroSideOnly: false,
	// a little darker than the tile's rig, for the night scene: ambient ×0.75 (2.39 → 1.79), env ×0.82
	// (0.33 → 0.27) — measured −17 % mean luminance on the summit, −18 % on the snow field
	// values set by Alex in the tuning panel (2026-09-14): brightness 1.38, reflections 0.42, tint #f7f7f7
	material: { ...MAIN_MOUNTAIN_TEMP_TILE.material, ambientIntensity: 1.38, envMapIntensity: 0.42, color: 0xf7f7f7 },
	relight: { ...MAIN_MOUNTAIN_TEMP_TILE.relight },

	// Material comparison (evaluation only — no permanent choice yet).
	//   'gd2'    → GD2 shader, NO_LIGHTMAP / NO_MIXMAP fallback (procedural snow + tiled rock)
	//   'rodin'  → the asset's own PBR material (MeshStandardMaterial from the GLB), lit by the
	//              scene environment + an ambient term, with the GD2 fog injected
	//   'hybrid' → GD2 shader with the asset's diffuse / normal / roughness maps (USE_SOURCE_MAPS)
	// Override per session with ?material=gd2|rodin|hybrid
	materialMode: 'hybrid', // default = Hybrid v2 (chosen from the material comparison, see MOUNTAIN-REPLACEMENT.md §9)
	hybrid: {
		normalScale: 1.0,   // strength of the asset's normal map
		snowCoverage: 0.35, // 0 = only the flattest faces, 1 = generous accumulation
		steepRock: 0.7,     // 0 = source albedo as is; 1 = steep walls fully pulled toward exposed rock
	},
};

// ---- ACTIVE MAIN MOUNTAIN ------------------------------------------------
// Switch here. MAIN_MOUNTAIN_TEMP_TILE = original mont-fort tile, MAIN_MOUNTAIN_GORA_1 = GD2 candidate #1.
export const MAIN_MOUNTAIN = MAIN_MOUNTAIN_GORA_1;

/* ------------------------------------------------------------------ */
/* Baby mountains (small foreground / background peaks)                */
/* ------------------------------------------------------------------ */

export const BABY_MOUNTAINS = {
	// GLB with the small peak mesh. Its embedded baseColorTexture is used as the
	// peak's albedo when `textures.baseColor` is null.
	file: 'assets/models/homepage/Homepage.glb',

	// null → place every mesh node found in the file, with the node's own
	//        transform and `extras.renderOrder` (this is what the current file does:
	//        three nodes sharing one 'BabyMountain' mesh, listed below).
	// Otherwise an explicit list; `node` selects the mesh in the file (null → first mesh):
	//   { node: null, position: [x, y, z], rotation: [x, y, z] /* deg XYZ */, scale: [x, y, z], renderOrder: 0 }
	instances: null,

	// Current instances as found in Homepage.glb (for reference — identical to instances: null):
	//   HomepagePeaks      pos [149.03, 14.09, 4.24]     quat [-0.0398, 0.2163, -0.0796, 0.9723]  scale [7.654, 7.654, 9.185]   renderOrder 0   (near, right of frame)
	//   HomepagePeaks.002  pos [90.04, 5.26, -64.19]     quat [0.1585, 0.8555, 0.0097, 0.4928]    scale [5.569, 5.569, 6.683]   renderOrder 0   (near, left ridge)
	//   HomepagePeaks.BG   pos [-201.63, -35.99, 438.01] quat [0.0338, -0.6794, 0.0393, 0.7319]   scale [21.869, 21.869, 26.243] renderOrder -2  (far background peak)

	// Per-node adjustments on top of the file placement (used when instances is null). Keyed by
	// the node name as three.js reports it (dots stripped). `scale` multiplies the node's scale;
	// `keepTop: true` lowers the node by the height it gained, so its summit stays where it was
	// in the sky and only the base sinks.
	overrides: {
		// The far background peak read as floating: its transparent base fade sat above anything
		// that could cover it. At 1.4× and sunk by the extra height, the fade goes into the clouds.
		HomepagePeaksBG: { scale: 1.4, keepTop: true },
	},

	textures: {
		baseColor: null,   // null → embedded texture from the GLB; or a path
	},

	material: {
		ambient: 12703189,        // 0xC1D6D5
		ambientIntensity: 0.58,   // set by Alex in the tuning panel (2026-09-14); the file rig had 2.24
		envMapIntensity: 0.44,
		envMapRotationY: -3,      // radians
		normalRepeat: [3, 5],     // rockNormal repeat over the peak's UVs
		normalScale: [1, 1],
		// Bottom fade: alpha = smoothstep(-0.8, 1.0, localY) — the peak's local
		// Y range is about −2.3 … 2.4 (before scale), so the lowest ~1.5 units dissolve.
	},
};
