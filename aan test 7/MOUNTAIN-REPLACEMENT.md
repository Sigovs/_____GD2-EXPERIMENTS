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
- `src/hero-text.js` (`HERO_TEXT`) — "The deeper you go, the more you know." as a camera-parented textured quad (Inter Tight 800, canvas texture) drawn between the middle-ground and foreground cloud quads, so the near clouds veil the lower lines. One quad per line; after load the lines slide in from the left and fade in one after another (0.5 s delay, 1.3 s each, 0.22 s stagger — a staircase). Nothing happens to the text on scroll. Previews: `previews/hero-text/`, `previews/floor/`.

---

## 15. Route as a fluid conduit
`style.routeMode: 'conduit'` in `descent-config.js` (`'line'` restores the glow line; same reveal, tip and occlusion). Two concentric `TubeGeometry` tubes on the existing route curve (479 segments × 10 radial; uv.x = arc length = the reveal parameter): **shell** r 0.62 — `MeshPhysicalMaterial` (clearcoat, roughness 0.12, scene PMREM env, opacity 0.3, faint cold tint) with the reveal discard injected via `onBeforeCompile`; **fluid** r 0.36 — `ShaderMaterial`: dim cyan emission brighter toward the centre line (view-facing term), two noise octaves drifting along the tube (`fluidFlowSpeed`), a Gaussian signal pulse in world units (`pulseSpeed`, `pulseLength`, `pulseStrength`, `pulseColor`) that runs the whole route and rests `pulsePause` units before the next run, plus the hot drawing tip; **halo** r 1.3 — the same shader in additive halo mode, only around the pulse. All three depth-tested, depth-write off; +3 draw calls, ~24k triangles, no per-frame geometry. Time drives the fluid and pulse; scroll drives only how much conduit exists. Previews: `previews/conduit/`.

---

## 16. Transition to the canyon / ocean (storyboard 01 → 02 → 03)
`src/abyss-transition.js` (`ABYSS_TRANSITION` + `createAbyssTransition()`), hooked in `mountain.js`. The page is **13 viewports**: the first 9/13 (`descentShare`) carry the descent exactly as before (same pixels of scroll per stage), the last 4/13 are the transition, driven by `transP` 0..1 through the same smoothed scroll. `enabled: false` restores the 9-viewport page.

Built as 2.5-D layers, each at its own depth in front of the camera:
- **Camera** — does NOT move, and the mountain world is **sticky**: it holds still in the background while the new section (chasm edge + ocean) rises over it and covers it (Alex, 2026-09-15: the section must cover the mountain, not push it up). The **lens shift** of the projection that used to slide the whole hero picture up (`camera.shift` in frame heights → `projectionMatrix.elements[9]`, `abyss.applyShift()`) is kept as a tunable but set to 0. The only motion of the background is a gentle zoom-out (`zoomMul` 1 → 1.08 → 1.12, inside the responsive clamp); the rim, glow and ocean are camera billboards and keep their size. The video's `frameY` absorbed its former share of the shift, so the ocean's on-screen path is unchanged. Drag / idle rotation untouched.
- **Chasm edge** — `split1.png` as a billboard 80 units in front of the camera, 1.12 frame widths wide, squeezed to `heightScale` 0.8 (thinner dark body, bigger opening), drawn in front of the cloud plates (renderOrder 1.5). Its crest is choreographed in VISIBLE frame heights (`split.rimY`, 0 = centre, +0.5 = top edge; `place()` subtracts the shift). It starts under the bottom edge and **surfaces out of the mist**: `fog` (over time, strongest at the crest) mixes the rock toward the current cloud colour (`fogCloud` → `clouds.duskColor` as they cool) and makes it half transparent, `opacity` fades 0 → 1 over the first 22 %. A **base guard** keeps the crest `rimAboveBase` above the lowest projected point of the mountain's footprint (`baseY`, `baseRadius`) — but only as the sea cools (`guardEase` × (1 − seaDusk) lowers the guard while the sea still hides the base), so it never pops the rocks in. The body under the crest thins to `bodyOpacity` (0.3) from 0.12 uv below the crest (the rock stays solid at the rim, the canyon reads through lower); `crestLight` relights the already-lit ridge. Ends at 55 % opacity, riding out with the mountain's base.
- **Canyon video** — `assets/videos/canyon-a.mp4` on a `VideoTexture` billboard 150 units in front of the camera (deeper than the edge → slower parallax), 1.25 frame widths, feathered border, **masked to the chasm interior**: its fragment maps to the edge's uv (`uSplitScale`, `uSplitOffset`) and shows only where the edge has coverage or below its body — never above the crest, over the mountain or the clouds. Surfaces from `hazeColor` as `video.opacity` rises (0.05 → 0.6); `uReady` keeps it haze-coloured (not black) until the video has decoded a frame (sticky over the loop wrap). Muted, looped, inline; starts playing hidden at `prewarmAt` (descent 0.6) so it is buffered when it surfaces.
- **Clouds** — the plates cool to `duskColor` from the bottom up (`uDusk`, `uDuskBand`, `uDuskColor`, `uDuskThin` on the cloud shader; rig-relative height) and thin by `duskThin`; the low plates are already grey-blue when the rocks surface from them. The world-fixed cloud sea cools too (`seaDusk`) — it slides with the picture and keeps hiding the base until the guard takes over. At dusk 0 the cloud shader is pixel-identical to before.
- **Night falls** (Alex, 2026-09-15: "всё темнеет, только свет палатки дёргается и создаёт небольшой glow") — `ABYSS_TRANSITION.night.fall` (0 → 1 by t 0.3, as the rim comes in) drives one night over the whole mountain world: the night sky sinks toward black (`uNightFall` × `night.sky` 0.86, stars included), the clouds and the cloud sea sink into `night.cloudColor` (dusk + dusk colour lerp, all plates), the mountain/peaks go to `mountain.night` 0.88, the route conduit dims by `night.route` 0.75, and the cold light from below is cut by `night.oceanGlow` 0.9. The **expedition camp is the only light left** (camp-config.js `night`): the fire twitches (a stepped random flicker 11×/s on top of the calm one; none under reduced motion), its warm pool on the snow is stronger and wider (the camp light term now runs AFTER the fog and the night in the mountain shader, so the night no longer eats it), the tent keeps its inner glow while losing the moonlight, and the halo grows into a small glow.
- **Rim opening guard** — `opening()` in the split and video shaders returns 0 at `opening.width` 0. Before, the feather straddled 0 and cut a 50 % see-through column down the middle of the rim: the vertical light shaft under the crest.
- **No light from below; a dark liquid basin instead** (Alex, 2026-09-15: "это светящееся снизу убери", "сделай dark gradient там, с эффектом liquid на mouse") — the cold glow is cut entirely (`night.oceanGlow` 1), the ocean video surfaces from darkness (`hazeColor` / `edgeColor` near-black) and later (`video.opacity` 0.45 → 0.8). Under the rim sits `AbyssLiquid` (`cfg.liquid`): a camera plate masked by the rim silhouette, a dark gradient (near-black at the crest → deep navy low), a slow dark noise flow with thin creases of light, and the scene's screen-space mouse trail bending the flow and ringing like disturbed water. renderOrder 0.44: over the sea, under the ocean video, the rim and the foreground plates.
- **Mouse parallax — approved, keep** (`camera.mouseParallax: true`): the edge and the video are placed *before* the mouse parallax is applied to the camera, so both swing with the mouse like the world does — the canyon video visibly reacts to mouse move. Do not move `abyss.place()` after the parallax block.
- **Callouts** never sit on the rising chasm edge: each one leaves as the crest approaches its lowest point (`descent.state.coverY` from the crest; `callout.exit` in descent-config.js), so they go bottom-up. The exit is not the unfold reversed: 1) the plate with its text disappears, 2) the leader retracts into the anchor, 3) the dot goes. `labelFade` (0.45 → 0.75) is only a late backstop. The **hero statement** flies up and away into blur like the clouds over 6–42 % (`heroTextExit` → `heroText.setExit`; hero-text.js `exit`): each line rises (the top one leads), grows a little and melts into blur: each line has a soft copy blurred once at load (1/4-size canvas with a margin, 3 box passes ≈ Gaussian, `exit.softTexPx`), the shader crossfades sharp → soft and thins it unevenly like a cloud (wisps, never holes); the quads are grown so the blur is never clipped. The marker stroke softens and is gone in the first stretch. (A live mip + 12-tap blur read blocky and noise erosion punched holes — replaced.) Reduced motion: a plain fade in place.
- `AbyssFloor`: a camera-following dark disc far below (the sky cylinder is open at the bottom).
- Route, mountain, sky, nav: untouched.

Timing (transition progress): 0–0.25 crest surfaces from the mist, low clouds cool, video faint · 0.25–0.55 video through the opening, mountain starts up · 0.55–0.8 overlap (storyboard 02) · 0.8–1 mountain out through the top, canyon dominant (03). Previews: `previews/abyss/01-mountain-dominant.png` (t 0.2), `02-overlap.png` (t 0.67), `03-ocean-dominant.png` (t 1), `transition.mp4` (24 fps, canvas only), 1900 × 1030, orbit frozen. Debug readout shows `descent` and `abyss` progress.

---

## 17. The basin without seams, the ocean back under the mountain, and `index_v2.html`

### 17a. The dark basin — measured, not eyeballed (`index.html`)
Alex, 2026-09-15: *"эта часть должна быть очень тёмной, не должна так выделяться, тут почти шов видно. не должно быть швов."*

Measured on the render (mid-frame luminance column, 8-px window, WebGL `readPixels` after an explicit `renderer.render`): the old basin carried a **−27/255 step at y ≈ 0.49 of the frame** and a navy field below it. Two causes, both in `cfg.liquid` / `liquidFragment`:
1. the gradient was `smoothstep(0.0, 0.75, s.y)` in screen space, so its steep middle landed about two thirds down the picture — the knee *was* the seam;
2. the flow's creases were weighted toward the bottom (`0.35 + 0.65·(1 − s.y)`), which drew a second band under the first.

Now: `topColor 0x010207` / `bottomColor 0x050b16` (was `0x020308` / `0x0c1b30`), `ramp: [-0.55, 1.15]` — the gradient runs past **both** edges of the frame so no knee is inside it — even crease weight, `sheen 0.035` (was 0.08), and `dither 1.2` applied **after** the transfer function (8-bit banding on a near-black ramp is a seam of its own). Verified: worst jump strictly below the crest is now **≤ 6/255** at x = 15 / 50 / 85 % of the frame, at t 0.35 and t 0.6.

### 17b. The ocean is under the mountain again (`index.html`)
Alex: *"поставь наше видео океана на index.html под горой, а то ты его убрал куда-то."* Measured cause: `video.opacity` started at t 0.45, so at t 0.35 the canyon was decoded and playing at `uAlpha 0` — invisible — with the dark basin standing in its place.
`opacity` is now `[[0.08,0],[0.3,0.32],[0.5,0.6],[0.72,0.9],[0.85,1]]` and `haze` `[[0,1],[0.3,0.8],[0.55,0.5],[0.8,0.15],[1,0]]`: the ocean is present from the moment the rim is in and is held **dark by a low opacity over the near-black basin** rather than by being absent — a layer that arrives at full strength in one step is itself a seam. Measured: `uAlpha` 0.31 at t 0.28, 0.36 at t 0.35, 0.73 at t 0.6.
Previews: `previews/v2/before-t035.jpeg` → `after-t035.jpeg`, `v1-ocean-t060.jpeg`.

### 17c. `index_v2.html` — the variant page
A copy of `index.html` that sets `window.__VARIANT = 'v2'` before the module loads (`?v=2` does the same on either page). `mountain.js` reads it once and dynamically imports the variant layers; **`index.html` renders exactly as before**. Everything in §17a/§17b is in the shared modules, so both pages have it.

### 17d. The mist veil — `src/mist.js` (v2 only)
The rock used to "surface out of the mist" by being tinted toward the cloud colour: the mist was a *colour*, so the crest read as a cut-out sliding in front of a still picture. This layer puts real moving vapour across the crest line.

A camera-relative billboard at distance 70 (nearer than the chasm edge at 80), `renderOrder 1.6`, carrying a generated fog clip composited **as fog, not as light**: the clip's luminance becomes alpha and its own colour is discarded in favour of the scene's cloud tint (`tint → duskTint → nightTint`, driven by `abyss.state.dusk` / `nightFall`), so a generated grade can never arrive through the back door (`DNA23`). Three things keep it seamless: all four plate edges feathered wide; the vapour is a **band** around the crest, so there is no straight top edge to read as a horizon; and the clip's loop wrap is crossfaded between **two copies of the video running half a period apart** (verified live: 1.35 s / 3.93 s on a 5.17 s clip), so the restart is never a cut.

Tuning, after looking at the render: `bandWidth` 0.62 → **0.3**. The plate is ~1.5 frame heights tall, so 0.62 spread vapour over ~0.93 of the frame — a general haze that lifted the black §17a had just made dark and competed with the scene's own cloud plates (a second fog system: `TASTE §2c` device budget, `DM6` one depth idea). At 0.3 it is a band: ~0.15 frame heights at full density, gone within ~0.45. Also `strength` peak 0.95 → 0.55, `density` 0.85, `luma [0.1, 0.55]`.
Reduced motion: both videos are paused on a decoded frame and the veil is held still (`DM4`, `MJ9`).
Previews: `previews/v2/v1-nomist-t028.jpeg` (index.html) vs `v2-mist-t028-tuned.jpeg` (v2).

### 17e. Generated assets and their provenance
`assets/videos/gen-mist-b.mp4` (used) and `gen-mist-a.mp4` (kept, superseded) — Higgsfield `minimax_h3`, 21:9, 5 s, 2K. Each carries a `.json` sidecar with model, job id, date and the exact prompt (`GI6`). `gen-mist-a` came back as a dense cloud deck with a near-horizontal top edge — it would have introduced exactly the seam §17a removed — so it was regenerated rather than re-graded.
**Every generated video ships silent** (Alex, 2026-09-15). There is no ffmpeg on this machine, so `tools/strip-audio.swift` (AVFoundation passthrough remux, no re-encode) drops the audio track: `swiftc -O tools/strip-audio.swift -o tools/strip-audio && tools/strip-audio in.mp4 out.mp4`. Verified: both clips now carry a video track only.
