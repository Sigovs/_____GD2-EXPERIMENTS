/*
 * route-config.js — the DESCENT ROUTE over the film, fully editable here.
 *
 * The mountain is a film (hero-scrub.js), so there is no terrain to probe: the route is
 * ROTOSCOPED — its control points are given in FILM coordinates (percent of the 1920×1080
 * frame, x to the right, y down) at a handful of film times, and interpolated between them.
 * The scroll owns the film's clock, so every frame the route lands on is a frame keyed
 * against. This take is a camera DESCENT — the peak leaves the top of the frame at ~0.75
 * and the camp arrives from the bottom-right — so it is keyed every 1/8 (tools:
 * hero-encode --at). Re-trace if the film changes.
 *
 * Two chains: the RIDGE (summit → down the moonlit left crest → the col → into the cloud)
 * and the CAMP (out of the valley mist at the left → the tent). Between them the route is
 * under the cloud: the fluid keeps travelling, nothing is drawn.
 *
 * The route parameter u runs 0..1 over ridge + hidden span + camp. Stops sit at named
 * points; the timeline maps film time to u.
 *
 * VARIANTS (?path=conduit|alpine|filament) share the trace and the renderer; each is a
 * style — see `variants` at the bottom.
 */

export const ROUTE = {
	/* film-time keys → control points [x%, y%] per chain.
	   ridge: summit, three on the crest, the col, two into the cloud (the crest is read off
	   the frames; the odd points sit a touch onto the lit face so the line is not a ruler) */
	keys: [
		{ f: 0.000, ridge: [[66, 24], [63.8, 30.5], [59, 38], [55.8, 45.5], [51, 50], [48, 56], [45, 60]],   camp: [[40, 106], [50, 108], [60, 110], [70, 112], [75, 113]] },
		{ f: 0.125, ridge: [[66, 21], [63.8, 28.5], [59, 36], [55.8, 44.5], [50, 51], [47, 57], [44, 61]],   camp: [[40, 106], [50, 108], [60, 110], [70, 112], [75, 113]] },
		{ f: 0.250, ridge: [[65, 17], [62.8, 25.5], [58, 33], [53.8, 41.5], [49, 47], [46, 54], [43, 58]],   camp: [[40, 106], [50, 108], [60, 110], [70, 112], [75, 113]] },
		{ f: 0.375, ridge: [[64, 13], [61.8, 20.5], [57, 28], [53.8, 36.5], [49, 43], [46, 50], [43, 54]],   camp: [[40, 106], [50, 108], [60, 110], [70, 112], [75, 113]] },
		{ f: 0.500, ridge: [[62, 8], [58.8, 16.5], [54, 24], [50.8, 32.5], [46, 38], [43, 45], [40, 49]],    camp: [[40, 106], [50, 108], [60, 110], [70, 112], [75, 113]] },
		{ f: 0.625, ridge: [[61, 3], [58.8, 10.5], [54, 18], [50.8, 26.5], [46, 31], [43, 37], [40, 41]],    camp: [[48, 104], [58, 106], [68, 108], [78, 110], [83, 111]] },
		{ f: 0.750, ridge: [[60, -1], [57.8, 6.5], [53, 14], [49.8, 21.5], [45, 27], [42, 32], [39, 36]],    camp: [[56, 86], [66, 90], [76, 94], [86, 96], [90, 97]] },
		{ f: 0.875, ridge: [[57, -4], [54.8, 3.5], [50, 10], [46.8, 17.5], [42, 23], [40, 28], [37, 32]],    camp: [[28, 74], [38, 79], [48, 84], [57, 86], [62, 87]],  alpha: { ridge: [1, 1, 1, 0.5, 0, 0, 0] } },   // the cloud has climbed the crest
		{ f: 1.000, ridge: [[56, -8], [53.8, -0.5], [49, 6], [45.8, 13.5], [41, 19], [39, 24], [36, 28]],    camp: [[14, 66], [24, 72], [34, 77], [43, 80], [48, 81]],  alpha: { ridge: [1, 0.8, 0.3, 0, 0, 0, 0] } },
	],
	/* a key may carry alpha: { chain: [...] } — per-point alpha at that time, interpolated
	   to the nearest keys that carry one; otherwise the chain's default below */
	chains: {
		//         share of u        per-point alpha (the ridge dives into the cloud; the camp climbs out of the mist)
		ridge: { u: [0.00, 0.62], alpha: [1, 1, 1, 1, 1, 0.6, 0] },
		camp:  { u: [0.72, 1.00], alpha: [0, 0.7, 1, 1, 1] },
	},
	samplesPerChain: 140,
	/* the tube's width follows the mountain's apparent size: the summit→col distance on
	   screen, against this reference (px at 1440 wide, ≈ film time 0.5) */
	scaleRef: { chain: 'ridge', from: 0, to: 4, px: 520, min: 0.55, max: 1.1 },

	/* Stops: [chain, control-point index]. Copy carried verbatim from aan test 7
	   (descent-config.js), which carried it from aan test 4 — the figures in STOP 01 have no
	   source recorded in this repo (content-provenance: they ship as the client's own copy). */
	stops: [
		{ id: 'STOP_01', at: ['ridge', 2], label: 'Stop 01 · Signal 001', title: '600M+ consumer profiles', text: 'Updated daily.',                       slot: { wide: [0.30, 0.22], narrow: [0.50, 0.14] } },
		{ id: 'STOP_02', at: ['ridge', 4], label: 'Stop 02 · Signal detected', title: 'Every visit begins with a trace.', text: null,                    slot: { wide: [0.22, 0.40], narrow: [0.50, 0.14] } },
		{ id: 'STOP_03', at: ['camp', 4],  label: 'Stop 03 · Behavior identified', title: 'Anonymous activity becomes actionable insight.', text: null, slot: { wide: [0.78, 0.62], narrow: [0.50, 0.14] } },
	],

	/* film time (fraction) → route draw parameter u. A string is a stop id (+ offset in u). */
	timing: [
		{ f: 0.00, u: 0 },
		{ f: 0.05, u: 0 },
		{ f: 0.26, u: 'STOP_01' },
		{ f: 0.32, u: 'STOP_01+0.02' },
		{ f: 0.50, u: 'STOP_02' },
		{ f: 0.56, u: 'STOP_02+0.02' },
		{ f: 0.66, u: 0.66 },          // under the cloud
		{ f: 0.80, u: 0.72 },          // out of the valley mist
		{ f: 0.95, u: 'STOP_03' },
		{ f: 1.00, u: 1 },
	],
	/* a stop wakes as the fluid arrives: ramps from (u − before) to (u + after) */
	stopReveal: { before: 0.03, after: 0.012 },
	/* the still for prefers-reduced-motion: the film holds 25 %, the route holds this */
	reducedU: 'STOP_01+0.01',

	/* the lamp in the tent: alive whenever the tent is in frame, lifted when the route arrives.
	   keys: film time → the tent's centre [x%, y%] (off the frame's foot before it rises) */
	glow: {
		keys: [[0.625, [92, 112]], [0.75, [92, 97]], [0.875, [64, 85]], [1.00, [50, 80]]],
		lit: [0.74, 0.82],         // film time over which the lamp comes alive (the tent enters the frame)
		radius: 0.2,               // of the viewport height — the lamp's own light
		halo: 0.42,                // of the viewport height — its bloom into the mist
		color: '255, 150, 60',
		dim: '70, 40, 20',         // the trough: the film's own lamp, taken down (multiply)
		max: 0.75,                 // peak alpha at the centre
		breath: 3.4,               // seconds per breath (the flicker on top of it is in route-layer.js → drawGlow)
		arrive: 'STOP_03-0.06',    // from here to STOP_03 the base lifts
	},

	/* the callouts: off for now (Alex, 17 Sep) — the plates and leaders stay in route.css / route-layer.js */
	callouts: false,

	/* the instrument — after aan test 7's conduit, as a 2-D object over the film:
	   a CLEAR shell that catches the moon on both walls (a glass tube has two edges and a
	   thickness), the FLUID inside it — a luminous core whose glow bleeds through the glass,
	   a clotted flow along it and an energy packet travelling its filled length — and machined
	   FITTINGS: a cap at the summit, a collar at every stop. Widths in CSS px at scale 1. */
	style: {
		tube: 8,
		shell: true,
		shellFill: 'rgba(190, 214, 245, 0.10)',    // the glass body: nearly nothing
		wallUpper: 'rgba(255, 255, 255, 0.72)',    // the wall the moon hits — a specular, in front of the liquid
		wallLower: 'rgba(255, 255, 255, 0.26)',    // the far wall
		innerShade: 'rgba(0, 0, 0, 0.28)',         // the glass thickness, inside the lower wall
		emptyAlpha: 0.6,                           // the shell ahead of the fluid (1 = as visible as behind it)
		fluid: '#37d6ff',                          // icy cyan (test 7 fluidColor)
		fluidCore: 'rgba(196, 244, 255, 0.95)',    // the bright thread down the middle
		fluidWidth: 2.8,
		glow: [[12, 0.10], [7, 0.20]],             // [width, alpha] of the bleed through the glass, additive
		flow: { dash: [7, 11], speed: 18, alpha: 0.15 },   // px/s the clots travel
		pulse: { speed: 150, halfLen: 38, gap: 260, alpha: 0.9, glow: 0.35 },   // px/s, px, px between packets
		front: 'rgba(235, 252, 255, 1)',           // the meniscus
		frontHalo: 8,
		shadow: null,                              // { dx, dy, width, alpha } — a contact shadow on the snow
		atmosphere: 0,                             // 0..1: how much the far end fades toward the sky
		fittings: true,
		fitting: { len: 12, width: 12, light: 'rgba(214, 224, 238, 0.98)', dark: 'rgba(58, 68, 84, 0.98)', edge: 'rgba(255, 255, 255, 0.5)', groove: 'rgba(10, 14, 22, 0.75)' },
	},

	/* three resolved directions on the same trace and renderer — ?path=… picks one */
	variant: 'alpine',
	variants: {
		/* the glass conduit as above: the product shot */
		conduit: {},
		/* ALPINE — a route on a mountain, not an object in front of one: thinner, matte, a
		   contact shadow on the snow, the far end fading into the air, fittings small */
		alpine: {
			tube: 5.5,
			shellFill: 'rgba(190, 214, 245, 0.06)',
			wallUpper: 'rgba(255, 255, 255, 0.5)',
			wallLower: 'rgba(255, 255, 255, 0.14)',
			innerShade: 'rgba(0, 0, 0, 0.2)',
			emptyAlpha: 0.5,
			fluidWidth: 2.2,
			glow: [[8, 0.08], [5, 0.16]],
			pulse: { speed: 120, halfLen: 30, gap: 320, alpha: 0.8, glow: 0.25 },
			frontHalo: 6,
			shadow: { dx: 1.5, dy: 2.5, width: 7, alpha: 0.32 },
			atmosphere: 0.55,
			fitting: { len: 9, width: 9, light: 'rgba(214, 224, 238, 0.98)', dark: 'rgba(58, 68, 84, 0.98)', edge: 'rgba(255, 255, 255, 0.45)', groove: 'rgba(10, 14, 22, 0.75)' },
		},
		/* FILAMENT — no tube at all: a hair of light with a bright head and a long soft trail;
		   the quietest; the film does everything */
		filament: {
			tube: 0,
			shell: false,
			fluid: '#5fe0ff',
			fluidCore: 'rgba(230, 250, 255, 1)',
			fluidWidth: 1.5,
			glow: [[10, 0.07], [4, 0.22]],
			flow: { dash: [4, 14], speed: 14, alpha: 0.12 },
			pulse: { speed: 170, halfLen: 60, gap: 200, alpha: 0.9, glow: 0.3 },
			front: 'rgba(255, 255, 255, 1)',
			frontHalo: 11,
			fittings: false,
			atmosphere: 0.3,
		},
	},
};

/** The active variant's style: base style overlaid with the variant's overrides. */
export function resolveRoute(name) {
	const v = ROUTE.variants[name] || ROUTE.variants[ROUTE.variant] || {};
	return { ...ROUTE, variantName: ROUTE.variants[name] ? name : ROUTE.variant, style: { ...ROUTE.style, ...v } };
}
