import * as THREE from 'three';
import { createRockRim, ROCK_LAYER } from './rock-rim.js';

/*
 * abyss-transition.js — the hand-off from the mountain world to the canyon / ocean
 * (assets/videos/canyon-a.mp4), after the storyboard:
 *
 *   01  mountain dominant, the rocky chasm edge (split1.png) enters from below,
 *       the lower clouds start to cool;
 *   02  mountain in the upper part, the chasm edge frames the lower part, the
 *       canyon video is clearly visible through the opening;
 *   03  the rising section has covered the mountain world (which never moved),
 *       the canyon is the scene, the chasm edge is only rocky framing.
 *
 * Depth choreography (this pass): the mountain world recedes into night (uNight on its materials: darker, flatter,
 * cooler — never an opacity fade) while it rises; the CLOUDS come forward (the rig slides toward the camera and
 * grows) and pass in front of the mountain, behind the chasm edge; split1 stays the solid dark foreground frame
 * (its own artwork, no reshaping); the canyon rises from below behind it and comes into focus (blur 6 px → 0,
 * scale 1.05 → 1, opacity up). Layer order front→back: split · clouds · canyon · mountain.
 *
 * How it is built (2.5-D layers, each at its own depth in front of the camera):
 *   • the camera does NOT move and the mountain world STAYS in the background: the new
 *     section rises over it and covers it (Alex, 2026-09-15). `camera.shift` — a lens shift
 *     of the projection that used to slide the whole hero picture up — is kept, at 0;
 *   • the cloud plates and the sea cool to blue-grey from the bottom up;
 *   • the chasm edge and the video are billboards placed every frame at fixed
 *     distances in front of the camera; their vertical position is choreographed
 *     in FRAME HEIGHTS at their own depth (0 = frame centre, +0.5 = top edge),
 *     so the parallax reads as mountain (slowest) / video (deeper) / edge (fastest).
 * Everything is a pure function of the smoothed scroll value.
 */

export const ABYSS_TRANSITION = {
	enabled: true,
	/* Page layout: total viewport heights; the first `descentShare` carry the existing descent unchanged. */
	totalViewports: 13,
	descentShare: 9 / 13,

	/* Camera: lens shift of the projection (frame heights the hero picture moves UP) and a small zoom-out.
	   `mouseParallax` — APPROVED, KEEP: the chasm edge and the canyon video are placed BEFORE the mouse parallax is applied
	   to the camera, so they swing with the mouse like the world does (the video reacts to mouse move). Never place them after it. */
	/* CHOREOGRAPHY (mountain → split → ocean), with a held middle:
	     mountain world  — far background: holds still (no lens shift, no zoom), only a little into darkness / haze
	     clouds          — the glue: come forward through the middle, overlap the lower mountain and the split's crest
	     split           — solid foreground rim: rises in front of the viewer, faster than the world, never dissolves
	     ocean           — a separate deep scene: mostly stays, revealed from BENEATH the rising split (masked by the
	                       split's own silhouette + haze), first as blue light, then the canyon
	     hold            — t ≈ 0.35 … 0.65: mountain above, clouds in the middle, split in front, ocean glow below */
	camera: {
		mouseParallax: true,
		// the mountain stays put behind the rising section (Alex, 2026-09-15: "гора должна стоять на заднем плане, новая секция
		// должна её накрывать, а не двигать вверх"). Was a lens shift up to a full frame: [[0,0],[0.35,0.2],[0.65,0.36],[0.85,0.7],[1,1]]
		shift:   [[0, 0], [1, 0]],
		// … but it recedes a little: a gentle zoom-out of the mountain world only (the rim, glow and ocean are camera
		// billboards and keep their size) — Alex: "немного zoom out на скролл". Clamped by the responsive zoom limit.
		zoomMul: [[0, 1], [0.65, 1.08], [1, 1.12]],
	},

	/* The mountain world recedes into night: uNight on the mountain / peak materials (see shaders.js) */
	mountain: {
		// Alex, 2026-09-15: a dramatic night by the time the rim is in (≈ t 0.3) — "всё темнеет, только свет палатки"
		night: [[0.03, 0], [0.3, 0.88], [1, 0.9]],   // was [[0.1,0],[0.45,0.3],[0.75,0.55],[1,0.7]]; 0.72 still read as grey-white snow
		nightColor: 0x060a14,        // the darkness it dissolves into (linear-space tint; was 0x0b1222)
	},

	/* NIGHT FALLS over the whole mountain world as the new section arrives: the sky sinks toward black, the clouds and the
	   sea go dark, the route dims, the cold light from below is cut — the expedition camp is the only light left
	   (camp-config.js `night`: a twitching fire, a stronger warm pool on the snow, a small glow). `fall` 0..1 drives it all. */
	night: {
		fall: [[0.03, 0], [0.3, 1]],
		sky: 0.86,                   // share of the sky's light taken (stars included)
		clouds: 0.85,                // how far the clouds and the cloud sea sink into cloudColor
		cloudColor: 0x070a12,
		route: 0.75,                 // share of the conduit's light taken
		oceanGlow: 1,                // share of the cold light from below that is cut — all of it (Alex: "убери это свечение", "это светящееся снизу убери")
	},

	/* THE COLD LIGHT FROM BELOW — the ocean is a light source before it is a picture. Three carriers:
	   a soft, slowly moving blue glow plate under the clouds (in front of the sea, behind the foreground plates and
	   the rim), the low cloud plates and the sea catching that blue (uGlow in their shaders), and the rim's underside
	   lit from below. The glow tracks the actual brightness of the video frame (state.oceanLum). */
	glow: {
		color: 0x3a86d8,
		distance: 120, widthFrames: 1.4, heightFrames: 1.05,
		frameY: [[0, -0.9], [0.35, -0.42], [0.65, -0.3], [1, -0.26]],       // the light's centre in the visible frame (low: it comes from below)
		alpha:  [[0.08, 0], [0.35, 0.7], [0.6, 0.9], [0.8, 0.55], [1, 0.2]],    // present before the ocean, yields to it (additive)
		clouds: [[0.1, 0], [0.35, 0.4], [0.6, 0.55], [0.85, 0.3], [1, 0.1]],   // strength in the low cloud plates (mix toward blue)
		sea:    [[0.1, 0], [0.35, 0.5], [0.6, 0.65], [0.85, 0.3], [1, 0]],     // strength on the cloud sea near the rim
		rim:    [[0.15, 0], [0.4, 1.2], [0.7, 1.6], [1, 1.2]],                // the rim's underside / crest lit from below
		lumMix: 0.5,                 // how much the light follows the footage's brightness (0 = constant)
		renderOrder: 0.45,           // over the sea and the mid plates, under the ocean (0.5), the rim (1.5) and the foreground plates (1.6)
	},

	/* THE DARK BASIN (Alex, 2026-09-15: "сделай dark gradient там, с эффектом liquid на mouse"): where the cold light used to
	   glow, a dark gradient under the rim — near-black at the crest, deep navy lower — with a slow dark flow and a liquid
	   response to the mouse (the scene's mouse trail bends the flow and sends faint rings). Behind the ocean video. */
	liquid: {
		enabled: true,
		distance: 125, widthFrames: 1.5, heightFrames: 1.6,
		// Alex, 2026-09-15: "эта часть должна быть очень тёмной, не должна так выделяться, тут почти шов видно. не должно быть швов."
		// The basin is a darkness, not a surface: near-black at the crest, barely-blue at the bottom of the frame, and the ramp
		// runs past both edges (see uRamp) so its steep middle never lands inside the picture as a readable band.
		topColor: 0x010207,          // under the crest (was 0x020308)
		bottomColor: 0x050b16,       // the lowest part of the frame (was 0x0c1b30 — a navy field with a visible upper edge)
		ramp: [-0.55, 1.15],         // screen y the gradient spans (0 = bottom edge, 1 = top): no knee inside the frame
		dither: 1.2,                 // ±1.2/255 of noise: 8-bit banding on a near-black ramp is itself a seam
		sheenColor: 0x6a8fc0,        // the faint light on the moving surface
		sheen: 0.035,                // the flow's thin creases of light (was 0.08 — they pooled at the bottom and drew the band)
		ripple: 0.14,                // the mouse's rings and refraction
		alpha: [[0.06, 0], [0.3, 1], [1, 1]],
		renderOrder: 0.44,           // over the sea and the mid plates, under the ocean video (0.5), the rim (1.5) and the foreground plates (1.6)
	},

	/* 3-D rocky rim (rock-rim.js) — the intermediate layer between the mountain and the ocean; a camera-relative card
	   with real cliff / boulder geometry, riding the same crest curve as the chasm edge (split.rimY + parallax.split) */
	rocks: { enabled: false, distance: 80 },   // prototype (see rock-rim.js) — off until the rim is art-directed

	/* Chasm edge — split1.png billboard. `rimY`: the ridge crest in frame heights at its depth (0 = centre, +0.5 = top edge).
	   The crest never drops below the mountain's base line + `rimAboveBase`, so the rocks hide the cut base once the sea is gone. */
	split: {
		enabled: true,
		file: 'assets/split/split1.png',
		distance: 80,                // world units in front of the camera
		widthFrames: 1.12,           // plate width in frame WIDTHS at that depth (> 1 so its sides never show)
		heightScale: 0.8,            // the plate is squeezed vertically: a thinner dark body, a bigger opening below it
		rimUv: 0.68,                 // where the crest sits in the image (uv.y from the bottom)
		// the crest's ENTRANCE (frame heights): starts under the bottom edge and floats up; on top of it the rims ride the
		// world's rise × parallax.split (foreground: a little faster than the mountain) — see place()
		// the crest, authored directly (parallax.split 0): rises to the hold, creeps during it, then leaves faster than the world
		rimY: [[0, -0.8], [0.35, -0.1], [0.65, 0.04], [0.85, 0.36], [1, 0.62]],
		/* No procedural opening: the artwork's own silhouette is the frame (its crest, its dark body, its baked lower fade
		   through which the canyon shows). `opening.width` 0 keeps the shader path inert. */
		opening: { width: [[0, 0], [1, 0]], y: 0.6, slope: 1.1, feather: 0.07, below: 0 },
		/* Base guard: the crest never drops below the mountain's base line + `rimAboveBase` — but only once the sea has cooled
		   (a dark sea no longer hides the cut edge). The guard fades in with `seaDusk`, so it never pops the rocks in. */
		rimAboveBase: 0.06,
		guardEase: 1.5,              // frame heights the guard sits below its line while the sea is still white
		guardNight: 1.5,             // … and again as the mountain recedes into night (a dark base needs no hiding)
		baseY: -6,                   // world y of the mountain's cut base (the sea's top layer sits at −4)
		baseRadius: 95,              // footprint radius around the summit axis — the lowest projected point of that circle is the base line
		opacity: [[0, 0], [0.22, 1], [1, 1]],   // fades in while rising, then solid — the strongest foreground occluder
		bodyOpacity: 1,              // the artwork as drawn: opaque body
		bodyBoost: 1,
		bodyEnd: [0.2, 0.42],        // the baked lower fade is shortened: the near wall ends this far under the crest (uv: start, end of a soft edge)
		/* atmospheric emergence: the crest surfaces out of the cloud mist — takes the cloud colour and is half transparent,
		   then clears as it rises toward the camera. `fog` = strength over time; the effect is strongest at the crest, none low on the body. */
		fog: [[0, 1], [0.25, 0.45], [0.4, 0.12], [1, 0.05]],   // atmosphere only at the crest edge once the rims are in (see the shader's fog band)
		fogCloud: 0xd6dde6,          // the mist colour while the clouds are still white (blends to clouds.duskColor as they cool)
		tint: 0xb9c6d8,              // cools the rock a touch
		crestLight: 0x5d8fd6,        // cold light on the already-lit ridge crest (from the canyon below)
		crestStrength: [[0, 0.3], [0.55, 0.9], [1, 1.2]],
	},

	/* Canyon / ocean video billboard, deeper than the edge */
	video: {
		file: 'assets/videos/canyon-a.mp4',
		distance: 150,
		widthFrames: 1.4,            // wide enough to cover the frame at t = 1 on 16:10 as well as ultrawide
		aspect: 16 / 9,
		// ENTRANCE (frame heights) + parallax.video × the world's rise (deepest layer: slowest). Ends at 0 → the frame is covered.
		// a separate deep scene: it mostly STAYS (parallax.video 0.15) while the split rises off it; only a slow creep up
		// the former lens-shift share (parallax.video 0.15 × shift) is folded in, so the ocean keeps the same on-screen path
		// now that the world no longer rises (was [[0,-0.5],[0.35,-0.42],[0.65,-0.32],[1,-0.2]] + 0.15 × shift) — its top edge stays out of frame at t = 1
		frameY: [[0, -0.5], [0.35, -0.39], [0.65, -0.266], [0.85, -0.14], [1, -0.05]],
		// no glow before the picture any more (Alex, 2026-09-15: "это светящееся снизу убери"): the bottom stays dark through the
		// night and the ocean surfaces from darkness as the rim rises (was [[0.3,0],[0.5,0.4],[0.65,0.9],[0.85,1],[1,1]])
		// Alex, 2026-09-15: "поставь наше видео океана на index.html под горой, а то ты его убрал куда-то". Measured before this
		// pass: uAlpha 0 at t 0.35 — the ocean was decoded and playing but invisible until t 0.45, and the dark basin stood in
		// its place. It is now under the mountain from the moment the rim is in, and it is held DARK by a low opacity over the
		// near-black basin rather than by being absent — a layer that arrives at 0.55 in one step is a seam.
		opacity: [[0.08, 0], [0.3, 0.32], [0.5, 0.6], [0.72, 0.9], [0.85, 1], [1, 1]],   // was [[0.45,0],[0.65,0.7],[0.8,1],[1,1]]
		haze: [[0, 1], [0.3, 0.8], [0.55, 0.5], [0.8, 0.15], [1, 0]],         // haze over its upper part, toward the rim
		blurPx: [[0, 5], [0.65, 3], [0.9, 0], [1, 0]],                         // soft in the depth, sharp when it is the scene
		focusScale: [[0, 1.04], [0.9, 1], [1, 1]],
		prewarmAt: 0.6,              // descent progress at which the (hidden) video starts playing, so it is decoded before it is needed
		edgeFeather: 0.06,           // soft border (uv units); the top edge lives behind the split body
		hazeColor: 0x04060b,         // the darkness the video surfaces from (was the canyon-blue light 0x2e66a6 — it glowed at the bottom)
		renderOrder: 0.5,            // behind the foreground cloud plates (+1): clouds pass over it; masked by the split above it
		edgeColor: 0x04060b,         // the top edge dissolves into this before it goes transparent (was the cloud white 0xe4eaf1 — a light fringe at night)
	},

	/* Depth hierarchy — how much of the world's rise (camera.shift) each layer takes:
	   mountain / clouds 1.0 (medium) · split rims 1.2 (foreground, a little faster) · canyon 0.35 (deepest, slowest) */
	parallax: { split: 0, video: 0.15 },     // split authored directly; the ocean barely follows the world (it is a deep scene)

	/* Clouds: the LOWER plates cool from the bottom up and thin into haze (the upper ones keep most of the hero look);
	   the sea cools with them */
	clouds: {
		dusk: [[0, 0], [0.25, 0.2], [0.55, 0.4], [0.8, 0.7], [1, 0.85]],   // the clouds stay clouds (white) through the hold, cool only late
		duskColor: 0x28364c,         // blue-grey, not black — storyboard 03's fog
		duskBand: [-80, 120],        // world y (rig-relative, the rig follows the camera): cold below, hero above at dusk = 1
		duskUpper: 0.45,             // how far the plates ABOVE the band cool at full dusk (0 = keep the hero look entirely)
		duskThin: 0.6,               // (kept for the tune panel) — the live value is `thin` below
		thin: [[0, 0], [0.3, 0.6], [0.5, 0.85], [0.7, 0.92], [1, 0.97]],   // below the crest the plates part: the rim reads, the glow comes through
		forward: [[0, 0], [0.3, 6], [0.65, 20], [1, 26]],     // the clouds come a little forward through the middle …
		scale: [[0, 1], [0.65, 1.08], [1, 1.1]],             // … and grow slightly: wisps over the lower mountain and the crest, not a wall
		seaDusk: [[0, 0], [0.2, 0.2], [0.6, 0.8], [1, 1]],   // the sea cools with the plates (it is what shows under the hero picture)
	},

	/* Callouts and hero statement belong to the mountain world */
	// backstop only: each callout already leaves as the rising crest approaches it (descent-config.js callout.exit), bottom-up;
	// this late global exit catches the ones the crest never reaches (was [[0.1,1],[0.45,0]], which dimmed all three at once)
	labelFade: [[0.45, 1], [0.75, 0]],
	heroTextExit: [[0.06, 0], [0.42, 1]],   // the hero statement flies up and away into blur like the clouds (hero-text.js exit); was a plain fade 0.05 → 0.4
	floorColor: 0x05070d,          // the void under everything (the sky cylinder is open at the bottom)
};

function keys(k, t) {
	if (t <= k[0][0]) return k[0][1];
	for (let i = 1; i < k.length; i++) if (t <= k[i][0]) {
		const [t0, v0] = k[i - 1], [t1, v1] = k[i];
		return v0 + (v1 - v0) * THREE.MathUtils.smoothstep(t, t0, t1);
	}
	return k[k.length - 1][1];
}

const plateVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

const splitFragment = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
uniform float uAlpha, uCrest, uBody, uRimUv, uFog, uBoost, uOpenBelow, uGlowUp;
uniform vec2 uBodyEnd;
uniform vec4 uOpen;                   // central opening: half-width, y, slope, feather (plate uv)
uniform vec3 uCrestColor, uTint, uFogColor;
varying vec2 vUv;
// the V-shaped central opening between the two rims: 1 inside
float opening(vec2 uv, vec4 o, float below) {
	// width 0 = no opening. Without this guard the feather straddled 0 and cut a 50 % see-through column down the
	// middle of the rim — the vertical light shaft under the crest (Alex: "убери это свечение")
	if (o.x <= 0.0) return 0.0;
	float d = abs(uv.x - 0.5) + max(0.0, uv.y - o.y) * o.z - max(0.0, o.y - uv.y) * below;
	return 1.0 - smoothstep(o.x - o.w, o.x + o.w, d);
}
void main() {
	vec4 t = texture2D(tMap, vUv);
	// the rims are SOLID foreground: the PNG's baked lower fade is lifted back (uBoost) so the masses stay opaque
	float ta = min(1.0, t.a * mix(1.0, uBoost, smoothstep(uRimUv - 0.2, uRimUv - 0.5, vUv.y)));
	float a = ta * uAlpha * smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x);
	a *= 1.0 - opening(vUv, uOpen, uOpenBelow);   // LEFT RIM / open centre / RIGHT RIM — the dark centre never covers the viewport
	a *= mix(1.0, uBody, smoothstep(uRimUv - 0.12, uRimUv - 0.32, vUv.y));
	a *= 1.0 - smoothstep(uRimUv - uBodyEnd.x, uRimUv - uBodyEnd.y, vUv.y);   // the near wall ends here (a shorter fade than the baked one)
	vec3 c = t.rgb * uTint;
	// cold light from the canyon below relights the already-lit crest; the dark body stays dark
	float lum = clamp(dot(t.rgb, vec3(0.3, 0.5, 0.2)) * 4.0, 0.0, 1.0);
	float crestZone = smoothstep(uRimUv - 0.12, uRimUv - 0.02, vUv.y);   // the relight belongs to the ridge, not to the body's baked mist
	c += uCrestColor * lum * uCrest * crestZone;
	// lit from below by the ocean: the underside of the body (toward its lower edge) takes the blue, the crest's lit facets a touch more
	float under = smoothstep(uRimUv - 0.02, uRimUv - 0.3, vUv.y);
	c += uCrestColor * uGlowUp * (0.16 * under + 0.10 * lum * crestZone);
	// atmosphere, kept to the crest EDGE: the ridge line is fogged (cloud-coloured, softened) while it surfaces and
	// keeps a thin band of it after; the body below is untouched — solid shape and haze are separate reads
	float fog = uFog * smoothstep(uRimUv - 0.16, uRimUv + 0.12, vUv.y);
	c = mix(c, uFogColor, fog * 0.85);
	a *= 1.0 - fog * 0.5;
	if (a < 0.004) discard;
	gl_FragColor = vec4(c, a);
}`;

const glowFragment = /* glsl */ `
precision highp float;
uniform sampler2D tNoise, tSplit;
uniform float uAlpha, uTime, uRimUv;
uniform vec2 uSplitScale, uSplitOffset;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
	// inside the basin only: below the rim's crest (the split's own silhouette), never over the mountain's foot
	vec2 su = (vUv - 0.5) * uSplitScale + 0.5 + uSplitOffset;
	float cover = (su.x < 0.0 || su.x > 1.0 || su.y > 1.0 || su.y < 0.0) ? 0.0 : texture2D(tSplit, su).a;
	float below = 1.0 - smoothstep(uRimUv - 0.2, uRimUv - 0.14, su.y);
	float inside = max(smoothstep(0.45, 0.85, cover), below) * (1.0 - smoothstep(uRimUv + 0.02, uRimUv + 0.08, su.y));
	if (inside < 0.003) discard;
	vec2 p = (vUv - 0.5) * vec2(2.0, 2.2);
	float r = dot(p, p);
	float shape = exp(-r * 1.6);                                                 // soft elliptical light
	float n1 = texture2D(tNoise, vUv * vec2(1.6, 1.1) + vec2(uTime * 0.012, -uTime * 0.006)).r;
	float n2 = texture2D(tNoise, vUv * vec2(3.1, 2.3) + vec2(-uTime * 0.02, uTime * 0.011)).g;
	float motion = 0.55 + 0.6 * n1 + 0.35 * (n2 - 0.5);                          // slow drift: light moving in water
	float a = shape * motion * uAlpha * inside;
	// warmer core, cooler edge
	vec3 c = mix(uColor * 0.7, uColor * 1.35, shape);
	gl_FragColor = vec4(c * a, a * 0.0 + a);   // premultiplied for additive blending
}`;

const liquidFragment = /* glsl */ `
precision highp float;
uniform sampler2D tNoise, tSplit, tMouse;
uniform float uAlpha, uTime, uRimUv, uSheen, uRipple, uDither;
uniform vec2 uSplitScale, uSplitOffset, uResolution, uRamp;
uniform vec3 uTop, uBottom, uSheenColor;
varying vec2 vUv;
void main() {
	// the basin only: within the rim's silhouette and below it, never above the crest (the ocean's own mask)
	vec2 su = (vUv - 0.5) * uSplitScale + 0.5 + uSplitOffset;
	float cover = (su.x < 0.0 || su.x > 1.0 || su.y > 1.0 || su.y < 0.0) ? 0.0 : texture2D(tSplit, su).a;
	float below = 1.0 - smoothstep(uRimUv - 0.2, uRimUv - 0.14, su.y);
	float inside = max(smoothstep(0.45, 0.85, cover), below) * (1.0 - smoothstep(uRimUv + 0.02, uRimUv + 0.08, su.y));
	if (inside < 0.003) discard;
	// a darkness, not a surface. The ramp runs past BOTH edges of the frame (uRamp), so its steep middle never lands inside
	// the picture: the old smoothstep(0.0, 0.75) put its knee about two thirds down and that knee was the visible seam.
	vec2 s = gl_FragCoord.xy / uResolution;
	vec3 col = mix(uBottom, uTop, smoothstep(uRamp.x, uRamp.y, s.y));
	// the mouse (screen-space trail): its gradient bends the flow, its body rings like disturbed water
	vec2 e = vec2(1.5 / 512.0, 0.0);
	float m = clamp(texture2D(tMouse, s).r, 0.0, 1.0);
	vec2 grad = vec2(texture2D(tMouse, s + e.xy).r - texture2D(tMouse, s - e.xy).r, texture2D(tMouse, s + e.yx).r - texture2D(tMouse, s - e.yx).r);
	// a slow dark flow with thin creases of light where it folds
	vec2 p = vUv * vec2(3.2, 2.2) + grad * 1.5;
	float n1 = texture2D(tNoise, p * 0.35 + vec2(uTime * 0.008, -uTime * 0.005)).r;
	float n2 = texture2D(tNoise, p * 0.9 + vec2(-uTime * 0.012, uTime * 0.007) + n1 * 0.3).g;
	float crease = pow(1.0 - abs(n2 - 0.5) * 2.0, 6.0);
	float ring = sin(m * 22.0 - uTime * 4.0) * 0.5 + 0.5;
	// the creases keep an even weight over the height — pooling them low (0.35 + 0.65·(1−s.y)) was the second half of the band
	col += uSheenColor * (crease * uSheen + ring * m * uRipple + clamp(length(grad) * 3.0, 0.0, 1.0) * uRipple);
	vec4 outCol = linearToOutputTexel(vec4(col, inside * uAlpha));
	// dither in OUTPUT space (after the transfer function): on a near-black ramp, 8-bit banding is a seam of its own
	outCol.rgb += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * (uDither / 255.0);
	gl_FragColor = outCol;
}`;

const videoFragment = /* glsl */ `
precision highp float;
uniform sampler2D tVideo, tSplit;
uniform float uAlpha, uFeather, uRimUv, uReady, uHazeAmt, uOpenBelow;
uniform vec4 uOpen;                       // the chasm edge's opening (inert at width 0)
uniform vec2 uSplitScale, uSplitOffset;   // this plate's uv → the chasm edge's uv (both are camera billboards)
uniform vec2 uBlur;                       // soft focus radius in uv (x, y)
uniform float uUnmasked;                  // 1 = no chasm edge: the plate is not masked by it
uniform sampler2D tNoise;
uniform vec3 uEdgeColor;
uniform vec3 uHaze;
varying vec2 vUv;
float opening(vec2 uv, vec4 o, float below) {
	if (o.x <= 0.0) return 0.0;   // width 0 = no opening (the feather must not straddle 0)
	float d = abs(uv.x - 0.5) + max(0.0, uv.y - o.y) * o.z - max(0.0, o.y - uv.y) * below;
	return 1.0 - smoothstep(o.x - o.w, o.x + o.w, d);
}
// soft focus: a 12-tap disc, skipped when sharp
vec3 focus(vec2 uv) {
	if (uBlur.x <= 0.0) return texture2D(tVideo, uv).rgb;
	vec3 acc = texture2D(tVideo, uv).rgb;
	for (int i = 0; i < 12; i++) {
		float a = float(i) * 0.5236 + 0.26;           // 12 directions, offset so no tap sits on an axis
		float r = (i < 6) ? 0.55 : 1.0;                // two rings
		acc += texture2D(tVideo, uv + vec2(cos(a), sin(a)) * uBlur * r).rgb;
	}
	return acc / 13.0;
}
void main() {
	vec3 c = focus(vUv);
	// the top edge: a ragged, cloud-coloured mist band (noise-offset), never a straight line; sides and bottom soft
	float n = texture2D(tNoise, vec2(vUv.x * 2.2, vUv.y * 1.3)).r;
	float topCut = 1.0 - uFeather * (0.35 + 1.1 * n);
	float top = smoothstep(topCut, topCut - uFeather * 0.9, vUv.y);
	float edge = smoothstep(0.0, uFeather * 0.5, vUv.x) * smoothstep(1.0, 1.0 - uFeather * 0.5, vUv.x)
	           * smoothstep(0.0, uFeather * 0.2, vUv.y) * top;
	// the canyon lives BEHIND the chasm edge: it shows only within the artwork's silhouette (its solid body — which
	// then hides it — and its baked lower fade, through which it is seen) and under the plate; never above the crest,
	// so nothing of it floats over the mountain or the clouds. No procedural opening.
	vec2 su = (vUv - 0.5) * uSplitScale + 0.5 + uSplitOffset;
	float cover = (su.x < 0.0 || su.x > 1.0 || su.y > 1.0 || su.y < 0.0) ? 0.0 : texture2D(tSplit, su).a;
	float below = 1.0 - smoothstep(uRimUv - 0.2, uRimUv - 0.14, su.y);   // under the body's top (overlaps the solid band: no seam)
	float inside = max(smoothstep(0.45, 0.85, cover), below) * (1.0 - smoothstep(uRimUv + 0.04, uRimUv + 0.1, su.y));
	inside = max(inside, uUnmasked);   // no chasm edge → the whole plate shows
	// the picture surfaces out of the cloud haze: at low opacity it is haze-coloured, then clears;
	// and its upper part (toward the crest) stays hazed longer — the canyon blue bleeds through the lower haze first
	float hz = smoothstep(uRimUv - 0.45, uRimUv + 0.02, su.y) * uHazeAmt;
	c = mix(uHaze, c, smoothstep(0.0, 1.0, uAlpha) * uReady * (1.0 - hz));   // uReady: haze (not black) until the video has a decoded frame
	c = mix(uEdgeColor, c, smoothstep(0.0, 1.0, top));   // the picture surfaces out of the cloud white
	float a = edge * uAlpha * inside;
	if (a < 0.003) discard;
	gl_FragColor = vec4(c, a);
}`;

export function createAbyssTransition({ textureLoader, pivot, noise, envMap, mouse, resolution }) {
	const cfg = ABYSS_TRANSITION;
	const group = new THREE.Group();
	group.name = 'AbyssTransition';

	/* chasm edge */
	const splitTex = textureLoader.load(cfg.split.file);
	splitTex.colorSpace = THREE.SRGBColorSpace;
	splitTex.anisotropy = 4;
	const splitMat = new THREE.ShaderMaterial({
		vertexShader: plateVertex, fragmentShader: splitFragment,
		uniforms: {
			tMap: { value: splitTex }, uAlpha: { value: 0 }, uCrest: { value: 0 }, uBody: { value: cfg.split.bodyOpacity }, uRimUv: { value: cfg.split.rimUv },
			uCrestColor: { value: new THREE.Color(cfg.split.crestLight) }, uTint: { value: new THREE.Color(cfg.split.tint) },
			uFog: { value: 1 }, uFogColor: { value: new THREE.Color(cfg.split.fogCloud) }, uGlowUp: { value: 0 },
			uOpen: { value: new THREE.Vector4(0, cfg.split.opening.y, cfg.split.opening.slope, cfg.split.opening.feather) },
			uOpenBelow: { value: cfg.split.opening.below }, uBoost: { value: cfg.split.bodyBoost },
			uBodyEnd: { value: new THREE.Vector2().fromArray(cfg.split.bodyEnd) },
		},
		transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
	});
	const split = new THREE.Mesh(new THREE.PlaneGeometry(1, 1143 / 1920), splitMat);
	split.name = 'ChasmEdge';
	split.renderOrder = 1.5;    // in front of the cloud plates (−1 / +1): the rocks cut the clouds, as in the storyboard
	split.frustumCulled = false;

	/* canyon video */
	const video = document.createElement('video');
	video.src = cfg.video.file;
	video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
	video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
	const videoTex = new THREE.VideoTexture(video);
	videoTex.colorSpace = THREE.SRGBColorSpace;
	videoTex.minFilter = THREE.LinearFilter; videoTex.magFilter = THREE.LinearFilter; videoTex.generateMipmaps = false;
	let playing = false;
	const play = () => { if (playing) return; playing = true; video.play().catch(() => { playing = false; }); };
	const videoMat = new THREE.ShaderMaterial({
		vertexShader: plateVertex, fragmentShader: videoFragment,
		uniforms: {
			tVideo: { value: videoTex }, tSplit: { value: splitTex }, uAlpha: { value: 0 }, uFeather: { value: cfg.video.edgeFeather },
			uRimUv: { value: cfg.split.rimUv }, uSplitScale: { value: new THREE.Vector2(1, 1) }, uSplitOffset: { value: new THREE.Vector2() },
			uHaze: { value: new THREE.Color(cfg.video.hazeColor) }, uReady: { value: 0 }, uHazeAmt: { value: 1 },
			uOpen: { value: new THREE.Vector4(0, cfg.split.opening.y, cfg.split.opening.slope, cfg.split.opening.feather) },
			uOpenBelow: { value: cfg.split.opening.below }, uBlur: { value: new THREE.Vector2() },
			uUnmasked: { value: cfg.split.enabled === false ? 1 : 0 },
			tNoise: { value: noise ?? splitTex }, uEdgeColor: { value: new THREE.Color(cfg.video.edgeColor) },
		},
		transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
	});
	const canyon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1 / cfg.video.aspect), videoMat);
	canyon.name = 'CanyonVideo';
	canyon.renderOrder = cfg.video.renderOrder;   // behind the foreground cloud plates: seen through the thinning haze
	canyon.frustumCulled = false;

	/* the cold light from below: an additive, slowly moving blue glow under the clouds */
	const glowMat = new THREE.ShaderMaterial({
		vertexShader: plateVertex, fragmentShader: glowFragment,
		uniforms: { tNoise: { value: noise ?? splitTex }, tSplit: { value: splitTex }, uAlpha: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(cfg.glow.color) },
			uRimUv: { value: cfg.split.rimUv }, uSplitScale: { value: new THREE.Vector2(1, 1) }, uSplitOffset: { value: new THREE.Vector2() } },
		transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
	});
	const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, cfg.glow.heightFrames / cfg.glow.widthFrames), glowMat);
	glow.name = 'OceanGlow';
	glow.renderOrder = cfg.glow.renderOrder;
	glow.frustumCulled = false;

	// the video's actual brightness (mean of a tiny downsample), so the light breathes with the footage
	const lumCanvas = document.createElement('canvas'); lumCanvas.width = lumCanvas.height = 8;
	const lumCtx = lumCanvas.getContext('2d', { willReadFrequently: true });
	let lumAt = 0;
	function sampleLum(now) {
		if (now - lumAt < 150 || video.readyState < 2) return;
		lumAt = now;
		try {
			lumCtx.drawImage(video, 0, 0, 8, 8);
			const d = lumCtx.getImageData(0, 0, 8, 8).data;
			let sum = 0;
			for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
			const lum = sum / (64 * 255);
			state.oceanLum = THREE.MathUtils.lerp(state.oceanLum, THREE.MathUtils.clamp(lum / 0.1, 0.5, 1.5), 0.35);
		} catch { /* cross-origin or not ready: keep the last value */ }
	}

	/* the void: a camera-following dark disc far below */
	const floor = new THREE.Mesh(
		new THREE.CircleGeometry(900, 48).rotateX(-Math.PI / 2),
		new THREE.MeshBasicMaterial({ color: cfg.floorColor, depthWrite: false, depthTest: false }),
	);
	floor.name = 'AbyssFloor';
	floor.renderOrder = -9;
	floor.frustumCulled = false;
	floor.onBeforeRender = (_r, _s, cam) => { floor.position.set(cam.position.x, cam.position.y - 350, cam.position.z); floor.updateMatrixWorld(); };

	/* the dark basin with a liquid response to the mouse (cfg.liquid) */
	const lq = cfg.liquid;
	const liquidMat = new THREE.ShaderMaterial({
		vertexShader: plateVertex, fragmentShader: liquidFragment,
		uniforms: {
			tNoise: { value: noise ?? splitTex }, tSplit: { value: splitTex }, tMouse: { value: mouse ?? splitTex },
			uAlpha: { value: 0 }, uTime: { value: 0 }, uRimUv: { value: cfg.split.rimUv },
			uSheen: { value: lq.sheen }, uRipple: { value: mouse ? lq.ripple : 0 },
			uDither: { value: lq.dither ?? 0 }, uRamp: { value: new THREE.Vector2().fromArray(lq.ramp ?? [0, 0.75]) },
			uSplitScale: { value: new THREE.Vector2(1, 1) }, uSplitOffset: { value: new THREE.Vector2() },
			uResolution: { value: resolution ?? new THREE.Vector2(1, 1) },
			uTop: { value: new THREE.Color(lq.topColor) }, uBottom: { value: new THREE.Color(lq.bottomColor) }, uSheenColor: { value: new THREE.Color(lq.sheenColor) },
		},
		transparent: true, depthWrite: false, depthTest: false,
	});
	const liquid = new THREE.Mesh(new THREE.PlaneGeometry(1, lq.heightFrames / lq.widthFrames), liquidMat);
	liquid.name = 'AbyssLiquid';
	liquid.renderOrder = lq.renderOrder;
	liquid.frustumCulled = false;

	group.add(glow, canyon, floor);
	if (lq.enabled) group.add(liquid);
	if (cfg.split.enabled !== false) group.add(split);
	const rim = cfg.rocks?.enabled ? createRockRim({ textureLoader, envMap }) : null;
	if (rim) { rim.group.visible = true; group.add(rim.group); }
	group.visible = false;

	const state = { t: 0, shift: 0, zoomMul: 1, dusk: 0, seaDusk: 0, labelFade: 1, heroTextExit: 0, rimY: 0, videoY: 0, baseY: 0,
		night: 0, cloudForward: 0, cloudScale: 1, cloudThin: 0, blurPx: 0, focusScale: 1,
		glowY: 0, glowAlpha: 0, glowClouds: 0, glowSea: 0, glowRim: 0, oceanLum: 1, crest: -1, nightFall: 0 };

	const fogCloud = new THREE.Color(cfg.split.fogCloud), fogDusk = new THREE.Color(cfg.clouds.duskColor);
	let ready = 0, everReady = false, lastNow = performance.now();
	function update(transitionProgress, descentProgress = 1) {
		const t = THREE.MathUtils.clamp(transitionProgress, 0, 1);
		state.t = t;
		// the hidden video starts decoding late in the descent, so it is never a black plate when it surfaces
		if (descentProgress >= cfg.video.prewarmAt) play(); else if (playing && t <= 0.001) { video.pause(); playing = false; }
		const now = performance.now(), dtr = Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
		if (video.readyState >= 2 && video.currentTime > 0) everReady = true;   // sticky: the loop wrap must not flash haze
		ready = everReady ? Math.min(1, ready + dtr * 1.5) : 0;
		videoMat.uniforms.uReady.value = ready;
		state.shift = keys(cfg.camera.shift, t);
		state.zoomMul = keys(cfg.camera.zoomMul, t);
		state.dusk = keys(cfg.clouds.dusk, t);
		state.seaDusk = keys(cfg.clouds.seaDusk, t);
		state.labelFade = keys(cfg.labelFade, t);
		state.heroTextExit = keys(cfg.heroTextExit, t);
		state.rimY = keys(cfg.split.rimY, t);
		state.videoY = keys(cfg.video.frameY, t);
		state.night = keys(cfg.mountain.night, t);
		state.cloudForward = keys(cfg.clouds.forward, t);
		state.cloudScale = keys(cfg.clouds.scale, t);
		state.cloudThin = keys(cfg.clouds.thin, t);
		state.blurPx = keys(cfg.video.blurPx, t);
		state.focusScale = keys(cfg.video.focusScale, t);
		sampleLum(now);
		state.glowY = keys(cfg.glow.frameY, t);
		const lumK = 1 - cfg.glow.lumMix + cfg.glow.lumMix * state.oceanLum;
		state.glowAlpha = keys(cfg.glow.alpha, t) * lumK;
		state.glowClouds = keys(cfg.glow.clouds, t) * lumK;
		state.glowSea = keys(cfg.glow.sea, t) * lumK;
		state.glowRim = keys(cfg.glow.rim, t) * lumK;
		// the night: one 0..1 that the sky, clouds, sea, route and camp read (mountain.js); it also cuts the cold light from below
		state.nightFall = keys(cfg.night.fall, t);
		const oceanCut = 1 - cfg.night.oceanGlow * state.nightFall;
		state.glowAlpha *= oceanCut; state.glowClouds *= oceanCut; state.glowSea *= oceanCut; state.glowRim *= oceanCut;
		group.visible = cfg.enabled && t > 0.001;
		if (!group.visible) return;
		play();
		splitMat.uniforms.uAlpha.value = keys(cfg.split.opacity, t);
		splitMat.uniforms.uFog.value = keys(cfg.split.fog, t);
		splitMat.uniforms.uFogColor.value.lerpColors(fogCloud, fogDusk, state.dusk);
		splitMat.uniforms.uCrest.value = keys(cfg.split.crestStrength, t) * (0.5 + 0.5 * state.oceanLum);
		splitMat.uniforms.uGlowUp.value = state.glowRim;
		glowMat.uniforms.uAlpha.value = state.glowAlpha;
		glowMat.uniforms.uTime.value = now / 1000;
		liquidMat.uniforms.uAlpha.value = keys(lq.alpha, t);
		liquidMat.uniforms.uTime.value = now / 1000;
		videoMat.uniforms.uAlpha.value = keys(cfg.video.opacity, t);
		videoMat.uniforms.uHazeAmt.value = keys(cfg.video.haze, t);
		splitMat.uniforms.uOpen.value.x = videoMat.uniforms.uOpen.value.x = keys(cfg.split.opening.width, t);
	}

	/** Lens shift: shear the projection so the whole picture moves up by `shift` frame heights. Call every frame. */
	function applyShift(cam) {
		cam.projectionMatrix.elements[9] = -2 * state.shift;   // y_ndc += 2·shift (a symmetric frustum has 0 here)
		cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
	}

	const dir = new THREE.Vector3(), up = new THREE.Vector3(), basePoint = new THREE.Vector3();
	let crestNow = 0;                       // the crest line (visible frame heights) of the current frame, shared by the plate and the 3-D rim
	const rim_y = () => crestNow;
	/** Place the billboards in front of the camera. Call after camera.lookAt() and applyShift(), before the mouse parallax.
	    Frame coordinates are VISIBLE-frame ones (the lens shift moves the geometry up by `shift`, so we place `shift` lower). */
	function place(cam) {
		if (!group.visible) return;
		cam.updateMatrixWorld();
		cam.getWorldDirection(dir);
		up.set(0, 1, 0).applyQuaternion(cam.quaternion);
		const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
		// the mountain's base line in frame heights (NDC y / 2): the lowest point of the footprint circle — the crest stays above it
		let lowest = Infinity;
		for (let i = 0; i < 12; i++) {
			const a = (i / 12) * Math.PI * 2;
			basePoint.set(pivot.x + Math.cos(a) * cfg.split.baseRadius, cfg.split.baseY, pivot.z + Math.sin(a) * cfg.split.baseRadius).project(cam);
			if (basePoint.z < 1) lowest = Math.min(lowest, basePoint.y / 2);
		}
		state.baseY = lowest;
		// entrance + the world's rise × parallax (rims a little faster than the mountain, the canyon much slower)
		const rimRaw = state.rimY + state.shift * cfg.parallax.split;
		const rimCrest = cfg.split.rimAboveBase == null ? rimRaw
			: Math.max(rimRaw, state.baseY + cfg.split.rimAboveBase - (1 - state.seaDusk) * cfg.split.guardEase - state.night * cfg.split.guardNight);
		const videoHFrames = cfg.video.widthFrames * cam.aspect / cfg.video.aspect;
		let videoY = state.videoY + state.shift * cfg.parallax.video;
		// the plate must cover the frame once the rims have gone: keep its edges outside (top from t≈0.8, bottom always)
		const lo = 0.5 - videoHFrames / 2 + 0.02, hi = -0.5 + videoHFrames / 2 - 0.02;
		videoY = Math.min(videoY, hi);                                     // bottom edge: always outside
		if (lo <= hi) videoY = THREE.MathUtils.lerp(videoY, Math.max(videoY, lo), THREE.MathUtils.smoothstep(state.t, 0.7, 0.9));   // top edge: outside once the rims have gone
		state.videoPlaced = videoY;
		const plateHFrames = cfg.split.widthFrames * cam.aspect * (1143 / 1920) * cfg.split.heightScale;
		crestNow = rimCrest;
		state.crest = rimCrest;
		const splitCentre = rimCrest - (cfg.split.rimUv - 0.5) * plateHFrames;
		const put = (mesh, d, widthFrames, frameY) => {
			const frameH = 2 * d * tanHalf, frameW = frameH * cam.aspect;
			mesh.position.copy(cam.position).addScaledVector(dir, d).addScaledVector(up, (frameY - state.shift) * frameH);
			mesh.quaternion.copy(cam.quaternion);
			mesh.scale.setScalar(widthFrames * frameW);
		};
		put(split, cfg.split.distance, cfg.split.widthFrames, splitCentre);
		if (rim) {
			// the rim card: origin on the crest line, contents in world units, facing the camera
			const d = cfg.rocks.distance, frameH = 2 * d * tanHalf;
			rim.group.position.copy(cam.position).addScaledVector(dir, d).addScaledVector(up, (rim_y(rim) - state.shift) * frameH);
			rim.group.quaternion.copy(cam.quaternion);
			rim.fit(frameH, frameH * cam.aspect);
		}
		split.scale.y *= cfg.split.heightScale;
		put(glow, cfg.glow.distance, cfg.glow.widthFrames, state.glowY);
		put(canyon, cfg.video.distance, cfg.video.widthFrames, videoY);
		canyon.scale.multiplyScalar(state.focusScale);   // the slight enlargement of a picture not yet in focus
		// blur radius: screen px → plate uv (the plate is widthFrames × the viewport width; uv.y spans 1/aspect of that)
		const plateWpx = cfg.video.widthFrames * state.focusScale * (window.innerWidth || 1920);
		videoMat.uniforms.uBlur.value.set(state.blurPx / plateWpx, state.blurPx * cfg.video.aspect / plateWpx);
		// video uv → edge uv, in frame units (widths for x, heights for y)
		videoMat.uniforms.uSplitScale.value.set(cfg.video.widthFrames / cfg.split.widthFrames, videoHFrames / plateHFrames);
		videoMat.uniforms.uSplitOffset.value.set(0, (videoY - splitCentre) / plateHFrames);
		// the glow plate → edge uv, the same way
		glow.scale.y = cfg.glow.widthFrames * (2 * cfg.glow.distance * tanHalf);   // plate height = heightFrames of the frame (put() scaled it by width)
		glowMat.uniforms.uSplitScale.value.set(cfg.glow.widthFrames / cfg.split.widthFrames, cfg.glow.heightFrames / plateHFrames);
		glowMat.uniforms.uSplitOffset.value.set(0, (state.glowY - splitCentre) / plateHFrames);
		// the dark basin: its top a little above the crest (masked there), reaching well below the frame
		const lqY = rimCrest + 0.1 - lq.heightFrames / 2;
		put(liquid, lq.distance, lq.widthFrames, lqY);
		liquid.scale.y = lq.widthFrames * (2 * lq.distance * tanHalf);   // plate height = heightFrames of the frame
		liquidMat.uniforms.uSplitScale.value.set(lq.widthFrames / cfg.split.widthFrames, lq.heightFrames / plateHFrames);
		liquidMat.uniforms.uSplitOffset.value.set(0, (lqY - splitCentre) / plateHFrames);
	}

	return { group, split, canyon, video, floor, glow, liquid, rim, state, update, place, applyShift, cfg };
}
