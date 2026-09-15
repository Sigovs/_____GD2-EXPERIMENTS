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

	/* Stops: the route anchors that carry a callout.
	   Callouts follow aan test 4 / index2 (the reference): a glowing anchor dot on the
	   route, an angular leader and a reading with a 12-unit icon. The copy is carried
	   verbatim from that page — the figures in STOP 01 have no source recorded in this repo.
	     icon      'database' | 'scan' | 'nodes' (the reference's glyphs)
	     register  'readout' = every line in tracked caps (the summit readout)
	               'reading' = title + one sentence
	     slot      where the reading holds still: [x, y, ground] — the CENTRE of the reading in
	               fractions of the viewport, and what it sits on: 'sky' (light ink: cyan +
	               white) or 'cloud' (dark ink: deep teal + the GD2 ground colour). wide is used
	               above callout.narrowPx, narrow below. The leader tracks the anchor into it.
	   The slots were measured, not placed by eye: the scene was captured without callouts
	   along the whole descent (1440×900 and 390×844, hero orbit). Each slot keeps one kind
	   of ground in every frame its stop is visible — sky: 95th-percentile luminance ≤ 0.09;
	   cloud: 5th-percentile ≥ 0.55 — so its ink clears 4.5:1 without any plate behind it.
	   The readings descend with the route (each fully below the previous one), with no
	   overlaps, no crossing leaders, the anchor clear of the reading's span, and clear of
	   the navigation. Re-measure if the camera choreography changes. */
	stops: [
		{ id: 'STOP_01', anchor: 'STOP_01', icon: 'database', title: 'Signal 001', lines: ['600M+ Consumer Profiles', 'Updated Daily'], register: 'readout', slot: { wide: [0.4208, 0.1644, 'sky'], narrow: [0.2795, 0.1528, 'sky'] } },   // narrow: the plaque is 230 px wide — centred clear of the left edge and below the stacked nav
		{ id: 'STOP_02', anchor: 'STOP_02', icon: 'scan', title: 'Signal detected', lines: ['Every visit begins with a trace.'], register: 'reading', slot: { wide: [0.7951, 0.4756, 'cloud'], narrow: [0.5000, 0.7200, 'cloud'] } },   // narrow: this stop's anchor never reaches a phone screen
		{ id: 'STOP_03', anchor: 'STOP_03', icon: 'nodes', title: 'Behavior identified', lines: ['Anonymous activity becomes actionable insight.'], register: 'reading', slot: { wide: [0.7585, 0.5978, 'cloud'], narrow: [0.5821, 0.6078, 'cloud'] } },   // wide x moved 40 px off the mountain's foggy right flank: at 0.7306 the title's first letters caught it (3.89:1 on the render)
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
			/* On a snow mountain a light line disappears (the old cool-white 1.6 px route did), so
			   the route is drawn the way a map draws a road: a dark casing under a bright core.
			   The core is the instrument cyan — the same ink as the callouts' anchors and leaders;
			   the casing is the GD2 ground colour. Widths are device pixels. */
			/* A glow line (after Alex's HUD reference): a thin pale core inside a soft additive glow
			   whose alpha falls off across its width, so it blooms instead of ending in a hard edge.
			   A fainter casing stays underneath so the line still separates from lit snow. */
			color: 0xbff4ff,        // core — pale instrument cyan
			opacity: 1,
			widthPx: 1.8,
			tipColor: 0xffffff,     // hot white where the route is being drawn
			tipLength: 6,           // world units of tip energy behind the drawing point
			tipMix: 0.85,
			glowWidthPx: 18,        // the soft glow's full width
			glowOpacity: 0.6,
			glowColor: 0x00ecff,
			glowSoftness: 2.2,      // falloff exponent across the glow (0 = flat band, higher = tighter bloom)
			casingColor: 0x0b0f1e,  // under the core: what makes the route read on snow
			casingWidthPx: 4.5,
			casingOpacity: 0.4,
		},
		marker: {
			show: false,            // the 3D ring markers — off: the callout's anchor dot marks the stop (one anchor device, as in the reference)
			sizePx: 44,             // quad size in device pixels (core + ring + halo live inside)
			color: 0xa9e2ff,        // icy blue core / ring
			ringRadius: 0.42,       // 0..1 of the quad half-size
			ringWidth: 0.035,
			coreRadius: 0.075,
			haloStrength: 0.35,
			scaleFrom: 0.85,        // wake-up scale
		},
		callout: {
			gapPx: 14.4,            // leader end → reading (.9rem in the reference)
			narrowPx: 992,          // ≤ 62rem (the reference's breakpoint): narrow slots, wrapped readings
			minRunPx: 24,           // the horizontal run into a reading never gets shorter than this
			/* Turn the mountain by hand and the readings swing in 3D with it: rotateY in perspective,
			   in the mountain's direction of turn, back to facing the viewer when it stops (off under reduced motion) */
			swingPerRadPerSec: 12,  // degrees of rotateY per rad/s of orbit angular velocity
			swingMaxDeg: 28,        // cap — past ~30° the reading foreshortens enough to hurt reading
			swingDamp: 6,           // how quickly the swing follows and settles back
		},
	},
};
