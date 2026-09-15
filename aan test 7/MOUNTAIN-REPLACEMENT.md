# Mountain replacement — current state, requirements, and the drop-in procedure

Scope of this document: the **Main Mountain** and the **Baby Mountains** only.
Clouds, sky, fog, camera, orbit/zoom, mouse, lighting rig and timing are fixed
and are not configured here.

All values below were measured from the shipped GLBs with `tools/glb-info.mjs`
and from the live scene (`window.__mountain.debug.report`).

Units: scene units (glTF metres as exported), **Y up**, right-handed.
The hero camera is ~180 units from the summit.

---

## 1. Where things live

| File | Role |
|---|---|
| `src/mountain-config.js` | **The only place with mountain-specific values** — files, node names, transforms, textures, material numbers, summit, relighting fit. |
| `src/mountain.js` | Scene. Reads the config; contains no mountain literals. Clouds / sky / camera / mouse sections are untouched. |
| `src/shaders.js` | Mountain and baby-mountain shaders. Gained two compile-time fallbacks (`NO_LIGHTMAP`, `NO_MIXMAP`) and a `uSideOnly` switch — inactive with the current asset. |
| `src/debug-layer.js` | Debug overlay (off by default). |
| `tools/glb-info.mjs` | `node tools/glb-info.mjs file.glb` → transforms, counts, bounding boxes, world summit. |
| `assets/models/mountains.glb` | Current main mountain **and** the fixed scene parts (`Skybox`, `Clouds`, `CameraPath`, `TargetPath`). Only the `Mountain` node is mountain-specific. |
| `assets/models/homepage/Homepage.glb` | Baby mountain mesh + its three placements. |

Debug overlay: open `index.html?debug` or press **D**. Shows world axes, ground
grid, main bounding box (yellow), baby bounding boxes (cyan), summit marker
(magenta), hero camera + look-at (blue / orange dots), authored camera / target
splines (blue / orange lines), and the three orbit rings for zoom 0.55 / 1 / 1.6
(green). Also prints the measured report to the console.
Screenshots: `previews/07-debug-hero.jpeg`, `previews/08-debug-overview.jpeg`.

---

## 2. Main Mountain — as shipped

**File / node**: `assets/models/mountains.glb` → node `Mountain` (mesh `Mesher (1).001`, Blender A.N.T. Landscape export).

| Property | Value |
|---|---|
| Node position | `[0, −3.242, 0]` |
| Node rotation | `[0, 0, 0]` (identity quaternion) |
| Node scale | `[1, 1, 1]` |
| Parent transforms | none (direct child of the glTF scene) |
| Vertices / triangles | **33 386 / 66 708** (indexed, single primitive) |
| Attributes | `POSITION`, `NORMAL`, `TEXCOORD_0` — no tangents, no vertex colours |
| Local bounding box | min `[−217.02, −67.25, −234.41]`  max `[246.00, 52.92, 227.75]` |
| **World bounding box** | min `[−217.02, −70.49, −234.41]`  max `[246.00, 49.68, 227.75]`  size `463 × 120 × 462` |
| **World summit** (highest vertex) | **`[9.80, 49.68, 1.78]`** |
| Footprint | one roughly square terrain tile with irregular (visibly cut) edges; one massif with the summit near the tile centre; the tile extends ~230 units in every direction, far past the camera orbit |

### Material / shader inputs (`MAIN_MOUNTAIN.material`, `MAIN_MOUNTAIN.textures`)

| Input | Current value | Notes |
|---|---|---|
| `color` | `0xffffff` | base multiplier |
| `roughness` / `metalness` | `0.4` / `0` | metalness is clamped to ≥ 0.04 in shader |
| `ambient`, `ambientIntensity` | `0xa7b8c5`, `2.39` | flat ambient irradiance |
| `envMapIntensity`, `envMapRotationY` | `0.33`, `−1.77 rad` | shared EXR environment (fixed scene asset) |
| `rockRepeat` | `[1, 50]` | UV repeat of `rockDiffuse` over the mesh's own UVs |
| `fogNear` / `fogFar` | `0.01` / `20` | pseudo-depth fog toward the light colour (scene-fixed look) |
| `textures.lightmap` | `homepage-lightmap.webp`, 2048², R used | baked AO + directional shading; **sampled at `(u, 1−v)`** |
| `textures.snowRockMix` | `snowRockMix.webp`, 1024², R used | 1 = snow, 0 = rock; **sampled at `(u, 1−v)`** |
| `textures.rockDiffuse` | `rock_diffuse.webp` (tileable) | only R is used, remapped to a blue-grey ramp |
| `textures.rockNormal` | `rock_normal.webp` (tileable) | sampled at `uv × 30` |
| `relight` | dir `[0.262, 0.546, 0.796]`, k `0.149`, base `0.133` | least-squares fit of the lightmap: `L ≈ base + k·dot(N, dir)` (R² 0.89). Turns with the camera; also the full shading when there is no lightmap |
| `authoredForHeroSideOnly` | `true` | lightmap + mask exist for the hero side only → the back half blends to slope-snow and planar rock |

Shader-side constants that are *not* in the config (they are look, not asset):
rock normal repeat ×30, wind-snow streaks, mouse wake weights, the
`(0.36, 0.47, 0.52)` shadow ramp, fog curve.

### UV / normal / texture requirements for a replacement

- **UVs (`TEXCOORD_0`)**: required. Non-overlapping, inside 0–1 if you ship a lightmap or a snow/rock mask (both are sampled with the mesh's own UVs at `(u, 1−v)`, i.e. standard glTF convention — bake in Blender, export, done). If you ship neither, any reasonable unwrap is fine; it only drives the tileable rock / noise lookups.
- **Normals**: required (computed at load if missing — smooth shading assumed).
- **Tangents**: not required. The shaders build the tangent frame from screen-space derivatives.
- **Vertex colours**: ignored.
- **Textures**: all optional except the two tileables that are already in the repo. Lightmap and mask can be `null` → `NO_LIGHTMAP` (analytic light from `relight`) and `NO_MIXMAP` (slope-based snow: flat = snow, steep = rock, summit rockier) kick in automatically.
- **Winding**: front faces outward (material is `FrontSide`).
- **Single mesh, single primitive** preferred (the loader takes one mesh by name or the first mesh found).
- **Node transform**: keep it simple — one node, no parent hierarchy, or set `transform` in the config to override whatever the file has.

---

## 3. Baby Mountains — as shipped

**File**: `assets/models/homepage/Homepage.glb` — one mesh `BabyMountain` used by three nodes.

Mesh: **1 000 vertices / 1 613 triangles**, attributes `POSITION, NORMAL, TEXCOORD_0, COLOR_0, COLOR_1` (colours ignored).
Local bbox min `[−5.30, −2.29, −4.99]` max `[4.61, 2.36, 4.43]` (≈ 9.9 × 4.6 × 9.4 before scale).
Embedded texture `homepage-decor` (JPEG, baseColor) — used as the peak albedo.

| Node | Position | Rotation (quat xyzw) | Scale | renderOrder | World bbox (tight) | World summit | Role |
|---|---|---|---|---|---|---|---|
| `HomepagePeaks` | `[149.03, 14.09, 4.24]` | `[−0.040, 0.216, −0.080, 0.972]` | `[7.654, 7.654, 9.185]` | 0 | min `[115.6, −8.2, −40.4]` max `[196.3, 31.3, 36.3]` | `[155.9, 31.3, 2.9]` | near peak, bottom-right of the hero frame |
| `HomepagePeaks.002` | `[90.04, 5.26, −64.19]` | `[0.159, 0.856, 0.010, 0.493]` | `[5.569, 5.569, 6.683]` | 0 | min `[54.3, −7.9, −100.7]` max `[112.0, 18.3, −43.3]` | `[93.7, 18.3, −65.1]` | near ridge, left of the hero frame |
| `HomepagePeaks.BG` | `[−201.63, −35.99, 438.01]` | `[0.034, −0.679, 0.039, 0.732]` | `[21.869, 21.869, 26.243]` | −2 | min `[−308.6, −72.1, 324.3]` max `[−63.9, 14.8, 544.0]` | `[−213.0, 14.8, 448.9]` | far background peak, upper-left of the hero frame |

(The debug overlay draws the axis-aligned box of the *rotated local box*, which is larger than the tight boxes above.)

### Material / shader inputs (`BABY_MOUNTAINS.material`)
`ambient 0xC1D6D5 × 2.24`, `envMapIntensity 0.44`, `envMapRotationY −3 rad`, rock normal repeat `[3, 5]`, normal scale `[1, 1]`, roughness from the GLB material (1.0), colour from the GLB material (white). Base colour = embedded texture (override via `textures.baseColor`).
Bottom fade: `alpha = smoothstep(−0.8, 1.0, localY)` — the lowest ~1.5 **local** units dissolve, so a replacement peak should have its base around local y ≈ −2 and its summit around local y ≈ +2.4 (or adjust scale).

### Requirements for a replacement baby peak
- One mesh, ≤ ~5k triangles, `POSITION` + `NORMAL` + `TEXCOORD_0`.
- UVs only drive the tileable normal map and the albedo texture — no baking needed.
- Optional baseColor texture (embedded, or `textures.baseColor` path). Without one the peak is white and relies on the environment and normal map.
- Placement either from the file (`instances: null`) or explicit (`instances: [...]` with position / rotation in degrees / scale / renderOrder).

---

## 4. Fixed camera facts the mountain must respect

| | |
|---|---|
| Hero camera (zoom 1, angle 0) | position `[175.86, 45.82, −51.14]`, look-at `[−5.93, −4.88, 54.62]`, FOV 55° vertical, near 1, far 1000 |
| Orbit pivot (from `summit`) | axis through `(x = 9.80, z = 1.78)`, y = 0 |
| Orbit radius / camera height | **174.3 / 45.8** at zoom 1; zoom range 0.55–1.6 → radius **95.9–278.9**, height **25.2–73.3** |
| View pitch | −13.6° (looking down); frame top edge is +13.9° above horizontal, bottom edge −41° |
| Horizontal FOV | 79.6° at 16:10, 82.6° at 16:9 |
| Top of frame at the pivot axis | y ≈ **89** at zoom 1 (≈ 49 at zoom 0.55, ≈ 143 at zoom 1.6) |
| Where the summit sits now | ≈ 24 % from the top of the frame, ≈ 64 % from the left, at zoom 1 |
| Cloud cover (world y, from the 9 cloud planes) | fully opaque below **y ≈ −15**; foreground planes fade out between −13…+53, middleground between 0…+62 → anything below −15 is never seen, +50 and up is always clear |
| Mouse parallax | camera shifts ±0.1 × / ±0.2 y units and rotates ±0.05 rad — negligible for volume planning |

---

## 5. Replacement volume (approximate)

Cylindrical coordinates around the pivot axis `(9.8, ·, 1.8)`; `r` = horizontal distance from that axis.

| Zone | r | y | Rule |
|---|---|---|---|
| **Summit** | ≤ 15 | **45 – 60** | keeps the current composition (summit ≈ ¼ from the top at zoom 1, still inside the frame at zoom 0.55). Hard ceiling ≈ 85 before it leaves the frame at zoom 1. Put the true summit at the axis and copy its coordinates into `summit`. |
| **Massif core** | ≤ 80 | −30 … summit | fully visible above +50, veiled by clouds between −15 and +50. Author this part for **all 360°**. |
| **Skirt / foothills** | 80 – 150 | ≤ 0 | mostly inside the cloud layer. Must stay below **+10** for r ≥ 85 — the camera passes at r = 96, y = 25 at minimum zoom (near plane 1 unit). |
| **Beyond** | > 150 | ≤ −15 or absent | invisible (clouds + fog). The current tile extends to r ≈ 330 here purely as filler; a replacement can simply end at r ≈ 120–150 with its base at y ≈ −30. |
| **Baby near peaks** | 120 – 160 | top ≤ 35 | current values; they sit *outside* the zoom-1 ring but the min-zoom camera (r 96) clears them only because they are low. Don't raise them. |
| **Baby background peak** | ≥ 400 | anything ≤ 15 | outside every orbit ring; only its silhouette shows through fog. |

Practical envelope for the first test asset: a mountain whose **base fits in a
160-unit-diameter circle, base at y ≈ −30, summit at y ≈ 50** placed so the
summit is at `(9.8, ~50, 1.8)`.

---

## 6. First replacement test — exactly what to drop in

**Asset**: `assets/models/gd2/mountain-test.glb`

- glTF 2.0 binary, **Y up**, metres = scene units.
- **One node, one mesh, one primitive**, triangulated. Node name `Mountain` (anything works if `node: null`).
- 30k–100k triangles, `POSITION` + `NORMAL` + `TEXCOORD_0` (non-overlapping unwrap; 0–1).
- Size per §5: base ≈ 160 across, base plane at local y ≈ −30, summit at local y ≈ +50, summit on the node's local vertical axis (x = z = 0 locally). Export with the node at the origin; the config moves it.
- No textures needed for the first test. (When they exist: `lightmap.png` 2048² R = baked AO/shading, `mask.png` 1024² R = snow; both authored in the mesh's UV space.)

**Run** `node tools/glb-info.mjs assets/models/gd2/mountain-test.glb` and read the printed *world summit*.

**Config changes** in `src/mountain-config.js` (nothing else in the project changes):

```js
export const MAIN_MOUNTAIN = {
	file: 'assets/models/gd2/mountain-test.glb',
	node: 'Mountain',                 // or null → first mesh
	transform: {                       // replaces the file transform
		position: [9.8, 0, 1.8],       // puts the local origin on the current pivot axis
		rotation: [0, 0, 0],           // degrees, XYZ; turn the asset's best side toward +X/−Z (the hero camera is at +176, −51)
		scale: [1, 1, 1],              // or a uniform scale to hit summit y ≈ 50
	},
	summit: [9.8, 49.7, 1.8],          // = world summit from glb-info (after transform); pivot follows automatically
	textures: {
		lightmap: null,                // NO_LIGHTMAP → analytic light from `relight`
		snowRockMix: null,             // NO_MIXMAP  → slope-based snow
		rockDiffuse: 'assets/textures/rock_diffuse.webp',
		rockNormal: 'assets/textures/rock_normal.webp',
	},
	authoredForHeroSideOnly: false,    // no hero-side-only maps → use the same shading all around
	material: { /* unchanged */ },
	relight: { /* unchanged; bakedLightDir is now just "the sun direction" */ },
};
```

If the asset is exported already in world position (summit at `(9.8, ~50, 1.8)`), leave `transform: null` and only set `file`, `node`, `summit`, the two `null` textures and `authoredForHeroSideOnly: false`.

**Baby mountains** can stay as they are for the first test (`BABY_MOUNTAINS` untouched — they load from `Homepage.glb` independently of the main mountain). To test a replacement peak: set `BABY_MOUNTAINS.file`, keep `instances: null` if the new file carries its own placements, or provide `instances: [{ node: null, position, rotation, scale, renderOrder }, …]` using the three rows from §3 as the starting values.

What a textureless drop-in looks like (current mesh rendered through the `NO_LIGHTMAP` + `NO_MIXMAP` path, `authoredForHeroSideOnly: false`): `previews/09-fallback-no-lightmap-no-mask.jpeg`.

**Verify** with `?debug`: the magenta summit marker must sit on the peak, the yellow box should stay inside the inner green ring (zoom 0.55, r ≈ 96) above y ≈ +10, and the cloud layer should still swallow the base.

---

## 7. Not done in this pass (by request)
No expedition path, no replacement asset, no changes to clouds / sky / fog / camera / mouse / lighting / timing. The rendered image is unchanged.

---

## 8. Candidate #1 — `3D_ASSETS/gora 1` (fit & evaluation, 2026-09-14)

Files: `EEdt0FRWfICkMgqnvxikm_base_basic_pbr.glb` (13.6 MB, 3 PNG textures) and `eH1bu6r7FB6XwOKHUvvim_base_basic_shaded.glb` (6.1 MB, baked albedo) — **same mesh** in both; the PBR one is used.

| | |
|---|---|
| Nodes / meshes / primitives | 1 / 1 / 1 (node `model`, doubleSided PBR material `model`) |
| Vertices / triangles | 47 608 / 90 258 (uint16 indices) |
| Attributes | `POSITION`, `NORMAL`, `TEXCOORD_0` (UV 0.001–0.999, auto-atlas) — no tangents |
| Textures | `texture_diffuse` (4.2 MB PNG), `texture_normal` (4.9 MB), `texture_metallic-texture_roughness` (2.4 MB) — ignored in this test |
| Local bbox | `[−0.941, −0.456, −0.938] … [0.933, 0.441, 0.938]`, size `1.874 × 0.897 × 1.876` |
| Local summit | `[0.107, 0.441, −0.393]` (single peak, off-centre) |
| Base | flat plate at y = −0.456; 13 800 verts with downward normals; 44 % of all vertices sit in the lowest 10 % of the height |
| Shape | one cone-like massif, height/width 0.48, radius from the summit axis 1.37 at the base, 0.96 at mid-height, 0.3 near the top |

**Fit applied** (`MAIN_MOUNTAIN_GORA_1` in `src/mountain-config.js`, active via `MAIN_MOUNTAIN = MAIN_MOUNTAIN_GORA_1`):
uniform scale **85**, rotation Y **90°**, position `[43.2, 12.5, 10.9]` (computed so the summit lands on the pivot axis) → world bbox `[−36.5, −26.3, −68.5] … [122.9, 50.0, 90.8]`, size **159 × 76 × 159**, summit `[9.8, 50.0, 1.8]`, base plate at y = −26.3. Shader in `NO_LIGHTMAP` + `NO_MIXMAP` fallback, `authoredForHeroSideOnly: false`. Nothing else changed.

Previews in `previews/gora1/`: hero (`13-hero-final-rotY-90`), zoom 1.3 (`02`), zoom 1.6 (`03`), orbit 45° (`04`), 90° (`05`), 180° (`06`), min zoom (`14-final-min-zoom-side`), diagnostics with clouds/fog off (`08`, `09`), rotation study (`01` = 0°, `10` = 90°, `11` = 180°, `12` = 270°).

**Verdict**: fits the volume, camera clearance and cloud cover are fine, silhouette OK from 45–90°, but the geometry is generated-blobby (rounded knobs, no ridgelines, no couloirs) and reads as a lump at min zoom; the flat base plate is invisible only because the clouds cover it. Usable as a placeholder for layout work, not as the final hero asset without resculpting.

---

## 9. Candidate #1 — material comparison (evaluation only, no permanent choice)

Switch: `MAIN_MOUNTAIN.materialMode` (`'gd2' | 'rodin' | 'hybrid'`, default `'gd2'`) or per session `?material=…`.
Same hero camera for every shot (`orbit` frozen before capture; the screenshot tool injects pointer/wheel input otherwise). Files in `previews/gora1/`:

| Mode | What it is | Preview |
|---|---|---|
| A `gd2` | current fallback: GD2 shader, `NO_LIGHTMAP` + `NO_MIXMAP`, tiled rock + slope snow | `mat-A-gd2-fallback-hero` |
| B `rodin` | the GLB's own `MeshStandardMaterial` (diffuse / normal / metal-rough), lit by the scene PMREM env (same rotation + intensity) plus an `AmbientLight` equal to the GD2 ambient term, GD2 pseudo-depth fog injected via `onBeforeCompile`. No GD2 snow, wind or mouse effects. The ambient light exists only in this mode. | `mat-B-rodin-pbr-hero` |
| C `hybrid` | GD2 shader with `USE_SOURCE_MAPS`: Rodin diffuse as rock albedo, Rodin normal map (`hybrid.normalScale`), Rodin roughness (G of metal-rough) on rock; snow = upward-facing mask + accumulation where the source albedo is bright, removed on steep faces (`hybrid.snowCoverage`); `hybrid.steepRock` pulls steep walls toward exposed rock with tiled GD2 rock detail; drifting snow / mouse wake only over snow; fog, relight, lighting as before. | v1 (`snowCoverage 0.5, steepRock 0`): `mat-C-hybrid-hero-v1`; v2 (`snowCoverage 0.35, steepRock 0.7`): `mat-C-hybrid-hero-v2-steepRock`, `…-mid-zoom-1.3`, `…-close-zoom-0.55` |

Findings: A is unreadable (white on white). B has honest rock/snow separation but its snow is flat and slightly blue, the rock is warm-brown "painted", and it loses every GD2 effect. C v2 keeps B's rock placement, adds exposed rock on the steep walls, keeps GD2 snow/wind/mouse/fog and stays readable against the bright sky. **Committed:** Hybrid v2 is the default for Gora 1 — `materialMode: 'hybrid'`, `hybrid: { normalScale: 1.0, snowCoverage: 0.35, steepRock: 0.7 }`. The plain URL renders it; `?material=gd2|rodin|hybrid` remains as a debug override. Verification shot: `previews/gora1/mat-default-hybrid-v2-hero.jpeg`.

---

## 10. Night sky test (sky system only)

Files: `src/sky-config.js` (new — `SKY.mode`, `NIGHT_SKY` block), `src/shaders.js` (+ `nightSkyVertex` / `nightSkyFragment`), `src/mountain.js` (sky material selection, `uPixelAngle` on resize, `uSummitDir` per frame). Default `SKY.mode = 'night'`; `?sky=day|night` overrides. The day shader is untouched and still selectable.

Fully procedural: gradient + horizon haze, two hashed star layers (3×3 cell search on an azimuth/elevation grid, spherical distance so stars stay round, cos-corrected density), band-limited "dust" from the existing `noise.webp`, elliptical cold glow around the summit direction. Star field is fixed to the world sky (computed from the view ray, independent of the cylinder's own rotation). Previews: `previews/night/01-hero.png`, `02-orbit-72deg.png`, `03-zoom-out-1.3.png`. Mountain / clouds / fog are still daylight-lit — by design of this pass.

**Revision 2 (restrained):** darker gradient (`0x02040a` → `0x0a1426`), one star layer with classes (~88 % sub-pixel pinpoints at 0.55 px radius, ~10 % medium 0.8 px, ~2 % bright 1.15 px; only the top ~0.3 % get a faint wide halo + slow breathing), low-frequency clustering field (`starClustering`) with extra density inside the dust band, dust reduced to a low-frequency monochrome band, summit glow rebuilt as core + 2× skirt at 0.14 intensity (no ring). Previews: `previews/night/v2-01-hero.png`, `v2-02-orbit-72deg.png`, `v2-03-zoom-out-1.3.png`.

**Revision 3 (atmospheric lift):** broad irregular lift around/above the summit, anchored to a fixed sky direction (hero camera → summit, shifted by `atmosphericGlowOffset`), two overlapping soft radial fields whose radius and intensity are warped by low-frequency noise, faded below the horizon. Config: `atmosphericGlowStrength 1.0`, `atmosphericGlowRadius 0.30`, `atmosphericGlowOffset [0.10, 0.09]`, `atmosphericGlowNoiseAmount 0.5`, `atmosphericGlowNoiseScale 1.6`, `atmosphericGlowColor 0x3a4a66`. Preview: `previews/night/v3-hero-atmospheric-glow.png`.

---

## 11. Navigation (DOM layer, no scene changes)
`index.html` (nav markup + Inter font link + stylesheet link) and new `src/nav.css`. Fixed top-right (32–48 px / 48–64 px, responsive), four links, Inter 15 px, 0.03 em tracking, resting opacity 0.7 → 1 on hover/focus with a soft cool glow and a 1 px hairline scaling in from the left (320 ms, `cubic-bezier(.22,.61,.36,1)`); `prefers-reduced-motion` removes the transitions; `pointer-events` only on the links so the canvas keeps every gesture. Stacks vertically under 760 px. Preview: `previews/nav/01-hero-nav.png`.

## 12. Responsive zoom-out clamp
Edge identified: on wide viewports at zoom 1.6 the **vertical borders of the outer cloud quads** (left and right) and the **dark gap under the cloud block** enter the frame; on 16:9 the bottom gap alone already shows at 1.6 against the night sky. Cloud planes were not moved.
`ZOOM_LIMIT` + `getResponsiveZoomLimit(aspect)` in `src/mountain.js`: `baseMaxZoomOut 1.45` (≤ 16:9), linear falloff `0.38` per unit of aspect beyond 16:9, floor `ultrawideMaxZoomOut 0.7`. Limit is recomputed on resize; the wheel clamps to it and `updateCamera` pulls a too-far target back so the existing damp eases into the stop. Measured safe (≤ 0.08 % dark pixels below the horizon line): 1920×1080 / 2560×1440 → 1.45, 2560×1080 → 1.22, 3440×1440 → 1.22, 3840×1080 → 0.77. Previews in `previews/zoomclamp/` (before: `diag-*-zoom1.6-before`, after: `16x9-…`, `21x9-…`, `32x9-…`).

---

## 13. Descent route (scroll-driven prototype)

**Architecture.** `src/descent-config.js` (all editable values) + `src/descent.js` (implementation) + hooks in `src/mountain.js` (page scroll → smoothed progress, camera choreography, per-frame update) + `src/route.css` (DOM labels) + `index.html` (scrollable document; canvas fixed).
- **TerrainProbe** — built once from the mountain mesh: max radius per (azimuth 1° × height 1 unit) cell around the summit axis → `point(az, y, hover)` on the outer surface. Also builds a ~7k-triangle **proxy occluder** (never rendered) for cheap label raycasts.
- **Route** — control points in (az, y) → Catmull-Rom in that 2-D space → 480 samples → probe → 3-D polyline hugging the terrain, lifted 0.9 units. Rendered as **two `Line2` fat lines** (route 1.6 px + additive glow 7 px, `LineMaterial` with `dashed` so `vLineDistance` exists) whose draw-on / cyan tip / tip fade are uniforms injected via `onBeforeCompile` — no per-frame geometry work. Depth-tested with polygon offset; the mountain occludes it naturally.
- **Stops** — three billboard quads (core + thin ring + halo shader, size in device px), depth-tested; activation from route progress (`stopReveal`); DOM labels projected each frame, faded by activation, occlusion (proxy raycast, one stop per 3 frames) and frustum.
- **Timeline** — `timing[]` maps scroll 0..1 → route length parameter via named anchors (`STOP_01`, `HIDE`, `REAPPEAR`, …); `camera{}` keyframes (orbit angle, zoom within the responsive clamp, camera / look-at drop, look-at follow of the tip). Everything is a pure function of the smoothed scroll value → reversible.
- **Occlusion break** — measured, not guessed: a visibility map (raycasts over the az×y grid) showed a rock rib on the right flank (az −68…−80, y 3…15) whose far side only becomes visible after ~13° of orbit. The route goes behind it (`HIDE` u≈0.40–0.52) and re-emerges as the camera turns.

**Scroll** — 9 viewport heights; wheel/trackpad now scrolls the page (the earlier wheel-zoom is replaced by the choreographed zoom, still clamped by `getResponsiveZoomLimit`). Drag-orbit remains as an additive offset; the idle auto-orbit runs only while parked at the hero.

**Previews** `previews/descent/01-start … 08-end-clouds.png`, ultrawide `09-ultrawide-3440x1440-stop02.jpg`.

---

## 14. Cloud sea + hero statement
- `src/cloud-floor.js` (`CLOUD_FLOOR`) — world-fixed cloud sea under the mountain: three noise-displaced, patchy discs (y −4 / −8 / −13, radius 340, rim + view-distance fade so the far horizon stays dark), drawn before the camera-relative cloud quads; the bottom layer writes depth so the route / markers / far peak feet sink into it. `SETTINGS.cloudEdgeFeather` (0.16, was 0.1) softens the quads' solid-core edge. Tune panel folder "Cloud sea".
- `src/hero-text.js` (`HERO_TEXT`) — "The deeper you go, the more you know." as a camera-parented textured quad (Inter Tight 800, canvas texture) drawn between the middle-ground and foreground cloud quads, so the near clouds veil the lower lines. Slides up from below after load (0.5 s delay, 1.7 s ease-out); on scroll (0.015–0.2) it wipes to transparency left → right, each line starting a little later (staircase edge). Previews: `previews/hero-text/`, `previews/floor/`.
