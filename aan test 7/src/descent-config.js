/*
 * descent-config.js — the scroll-driven DESCENT ROUTE, fully editable here.
 *
 * Coordinates: route points are given in mountain-relative cylindrical terms
 * around the orbit pivot axis (the summit axis, x = 9.8, z = 1.8):
 *   az  — azimuth in degrees, atan2(z, x) convention. The hero camera looks in
 *         from az ≈ −18°; screen-right at the hero angle is az ≈ −108°, screen-left
 *         is az ≈ +72°. Going toward more negative az = wrapping toward screen-right
 *         and around the back.
 *   y   — world height (summit ≈ 50, cloud layer fully opaque below ≈ −15).
 * The terrain probe turns (az, y) into a point on the mountain surface, so the
 * route follows ridges / slopes automatically; `hover` lifts it off the rock.
 */

export const MOUNTAIN_DESCENT = {
	/* Page scroll length in viewport heights (hero hold + descent). */
	scrollViewports: 9,

	/* Route control points, top → bottom. `name` marks timeline anchors. */
	route: [
		{ az: -22,  y: 47,  name: 'START' },
		{ az: 4,    y: 42 },                       // first traverse to the left along the upper ridge
		{ az: -30,  y: 38 },
		{ az: -52,  y: 34 },
		{ az: -64,  y: 30,  name: 'STOP_01' },    // upper right ridge
		{ az: -68,  y: 24 },
		{ az: -72,  y: 17,  name: 'HIDE' },       // goes behind the rock rib on the right flank
		{ az: -75,  y: 11 },
		{ az: -80,  y: 9 },
		{ az: -84,  y: 9,   name: 'REAPPEAR' },   // far side of the rib — only visible once the camera has turned
		{ az: -87,  y: 7,   name: 'STOP_02' },    // saddle behind the rib
		{ az: -90,  y: 3 },
		{ az: -82,  y: 0 },                        // long traverse back toward the front
		{ az: -72,  y: -1 },
		{ az: -62,  y: 0,   name: 'STOP_03' },    // rocky shelf just above the cloud layer
		{ az: -64,  y: -6 },
		{ az: -70,  y: -16, name: 'END' },        // into the clouds
	],
	hover: 0.9,             // world units the line floats above the probed surface
	samples: 480,           // dense samples along the whole route

	/* Stops: which route anchors get markers + labels */
	stops: [
		{ id: 'STOP_01', anchor: 'STOP_01', label: 'STOP 01', sub: 'SIGNAL 001', labelSide: 'right' },
		{ id: 'STOP_02', anchor: 'STOP_02', label: 'STOP 02', sub: 'SIGNAL 002', labelSide: 'right' },
		{ id: 'STOP_03', anchor: 'STOP_03', label: 'STOP 03', sub: 'SIGNAL 003', labelSide: 'left' },
	],

	/* Normalised scroll timeline (0..1) → route draw parameter (0..1 of the route length).
	   `u` may be a number or the name of a route anchor (+/- offset in route length units). */
	timing: [
		{ t: 0.00, u: 0 },
		{ t: 0.08, u: 0.015 },
		{ t: 0.28, u: 'STOP_01' },
		{ t: 0.35, u: 'STOP_01+0.015' },
		{ t: 0.52, u: 'HIDE' },
		{ t: 0.68, u: 'REAPPEAR' },
		{ t: 0.74, u: 'STOP_02' },
		{ t: 0.90, u: 'STOP_03' },
		{ t: 0.95, u: 'STOP_03+0.01' },
		{ t: 1.00, u: 1 },
	],

	/* Stop wake-up: activation ramps from (stop u − before) to (stop u + after), in route-length units */
	stopReveal: { before: 0.035, after: 0.012, labelDelay: 0.008 },

	/* Camera choreography over the same timeline (smoothly interpolated keyframes).
	   angleDeg adds to the drag orbit; zoom multiplies the hero distance (still clamped
	   by the responsive zoom limit); lookDrop / camDrop lower the look-at and camera (world units). */
	camera: {
		angleDeg: [[0, 0], [0.30, 4], [0.52, 12], [0.68, 24], [0.82, 32], [1.0, 38]],
		zoom:     [[0, 1], [0.30, 0.72], [0.50, 0.78], [0.70, 0.82], [1.0, 0.94]],   // deep fly-in at STOP 01, then back out as the orbit grows (near BabyMountain sits at ~0.75 of the hero distance)
		lookDrop: [[0, 0], [0.30, -8], [0.70, -18], [1.0, -18]],
		camDrop:  [[0, 0], [0.30, 2], [0.70, 8], [1.0, 4]],            // camera stays high: the near peaks remain a foreground rim
		// weight of steering the look-at toward the current route tip (0 = hero look-at only)
		followTip: [[0, 0], [0.12, 0], [0.30, 0.45], [0.70, 0.55], [1.0, 0.35]],
		followTipLift: 4,                // world units above the tip the camera aims at
		autoRotateBelowProgress: 0.01,   // the idle auto-orbit only runs while parked at the hero
	},

	/* Scroll smoothing (damping rate; higher = tighter) */
	scrollDamp: 4.5,

	style: {
		route: {
			color: 0xdbe6f5,        // cool white / blue-grey
			opacity: 0.85,
			widthPx: 1.6,
			tipColor: 0x7fd4ff,     // icy cyan
			tipLength: 6,           // world units of cyan energy behind the tip
			tipMix: 0.9,
			glowWidthPx: 7,
			glowOpacity: 0.16,
			glowColor: 0x8fd2ff,
		},
		marker: {
			sizePx: 44,             // quad size in device pixels (core + ring + halo live inside)
			color: 0xa9e2ff,        // icy blue core / ring
			ringRadius: 0.42,       // 0..1 of the quad half-size
			ringWidth: 0.035,
			coreRadius: 0.075,
			haloStrength: 0.35,
			scaleFrom: 0.85,        // wake-up scale
		},
		label: {
			offsetPx: [18, -34],    // from the marker, screen px (x flips for labelSide 'left')
			leaderPx: 26,
		},
	},
};
