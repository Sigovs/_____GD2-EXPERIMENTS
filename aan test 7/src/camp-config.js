/*
 * camp-config.js — the expedition camp at STOP_02: one tent, one campfire, a landing puff.
 *
 * Everything is in world space and driven by page scroll progress (0..1), so it plays
 * forward and backward with the scroll: tent drops → lands → fire ignites, and the reverse.
 * The props are separate objects (camp.js); the tent is a procedural proxy until tent.file
 * names a GLB. The fire's warm light is a small local term in the mountain shader.
 *
 * Until it is approved, the camp only appears with ?camp in the URL (enabled: true makes
 * it the default).
 */

export const CAMP_CONFIG = {
	enabled: true,

	/* Placement: the centre of the mountain, where Alex pointed — the flat snow field below the summit
	   rocks, left of the big rock (normal.y ≈ 1). STOP_02 is now here too (descent-config.js, az −29,
	   y 11.25, the field's front lip); the tent sits a few units further in, at az −29 / r 27.5 around the
	   summit axis, so the stop's dot is at its front. Only x/z are used — the ground height and normal
	   are raycast from the mountain at load. (Earlier: a 37° ledge by the old STOP_02 at 14.9, 10.91, −33.75.) */
	position: [33.85, 10.6, -11.53],
	rotationY: 0,                // degrees added to the automatic heading (the vestibule faces the fire)
	scale: 1,
	tilt: 0.5,                   // 0 = upright, 1 = fully along the slope normal
	sink: 0.3,                   // the base is cut into the slope, as a real camp platform would be (world units)
	viewFrom: [106.7, 46, -110.6],   // the camera at STOP_02 (t 0.80): the fire is placed on the side it sees

	tent: {
		file: '3D_ASSETS/tent/base_basic_shaded.glb',   // Alex's tent (1 mesh, 18.6k tris, colour texture); null = the procedural proxy
		modelYaw: 0,             // degrees: turns the model inside its footprint (the door direction as exported)
		width: 5.0,              // footprint, world units (≈60 px on screen at 1440×900); the model's larger side is scaled to it — 2.4 (≈17 px) went unseen, 3.4 asked bigger
		depth: 4.1,
		height: 2.5,
		/* after Alex's reference (3D_ASSETS/tent/tent.png): expedition orange, lit from inside, dark grey floor/fly */
		color: 0xd9661f,
		flyColor: 0x3a3a40,
		glow: 0.45,              // inner glow once the fire is lit (0 = none)
	},

	fire: {
		distance: 4.2,           // from the tent centre; the most level visible spot at this distance is chosen
		height: 1.8,
		radius: 0.5,
	},

	/* Scroll timeline (page progress). The route reappears at ≈0.68, STOP_02 wakes at ≈0.72–0.76;
	   the tent starts after the new face of the mountain and the stop are both on screen. */
	/* The drop is animated like a cartoon (Alex: "более мультяшным"), still driven by scroll alone:
	   stretch while falling → squash on contact → one small hop → a last squash → rest.
	   Volume is kept (squash spreads, stretch narrows) and the base never leaves the snow while squashing. */
	dropHeight: 14,              // world units above the final position; 0 = the tent fades in in place
	revealStart: 0.72,           // as STOP_02 starts waking
	revealEnd: 0.785,            // at rest
	impact: 0.5,                 // share of the reveal spent falling; the rest is squash / hop / settle
	stretch: 0.22,               // vertical stretch at the bottom of the fall
	squash: 0.32,                // vertical squash at contact (the second one is a third of it)
	hop: 1.6,                    // world units of the single rebound
	fireStart: 0.785,
	fireEnd: 0.815,
	firePop: 2.2,                // overshoot of the fire's scale as it ignites (back-ease constant)

	puff: { count: 22, radius: 3.4, rise: 1.2, size: 1.4, window: 0.024 },   // landing powder at the moment of contact

	light: { color: 0xff9448, intensity: 1.4, range: 12 },   // warm term on the mountain around the camp; range in world units
};
