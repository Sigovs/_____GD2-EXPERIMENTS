/*
 * cloud-shaders.js — test 8's own cloud plates: white, translucent, two kinds, breathing.
 *
 * The 3-D build's cloud shader (shaders.js → cloudFragment) carried the abyss transition:
 * a dusk band that cooled every plate toward 0x28364c and a glow from the ocean below. Over
 * the film that reads as grey smoke, so this is the same vapour with the grade removed:
 *
 *   • colour  — moonlit white only (uLit at the rims, uShade in the body). Shadow is not
 *               painted; it is the film showing through a thinner plate;
 *   • kinds   — one material per kind, same shader: the VEIL (near, thin, stretched, soft,
 *               streams past the lens) and the PUFF (behind it, denser, rounder, slower);
 *   • loop    — every plate breathes on its own phase (vertex sway) and its vapour drifts
 *               (uTime); nothing repeats visibly, nothing stops;
 *   • hold    — while the statement is up the plates part behind it (uHold, NDC), so the
 *               type never sits on a white cloud (dimensionality DM5);
 *   • scroll  — the layer thins from the bottom and fades toward the end of the film.
 *
 * The mouse wake (tMouse) is the ping-pong trail from shaders.js, unchanged.
 */

export const cloudVertex = /* glsl */ `
precision highp float;

uniform float uSwayTime;        // seconds
uniform float uSway;            // world units: how far a plate breathes
uniform float uGather;          // intro: 1 = the plates pulled in over the centre of the frame, 0 = in place

varying vec2 vUv, vNdc;
varying float vSeed, vRatio, vWorldY;

void main() {
	vUv = uv;

	vec4 mvPosition = instanceMatrix * vec4(position, 1.0);
	vSeed = instanceMatrix[3][0] + instanceMatrix[3][1] + instanceMatrix[3][2];
	vRatio = instanceMatrix[1][1] / instanceMatrix[0][0];

	// the loop: three slow sines on the plate's own phase — periods of ~55 / 90 / 125 s, so the
	// figure never visibly repeats and no two plates move together
	float ph = vSeed * 0.037;
	mvPosition.xyz += uSway * vec3(
		sin(uSwayTime * 0.115 + ph),
		0.45 * sin(uSwayTime * 0.070 + ph * 1.9),
		0.60 * cos(uSwayTime * 0.050 + ph * 0.7));

	vWorldY = (modelMatrix * mvPosition).y - modelMatrix[3][1];   // height relative to the rig (it rises with the scroll)
	gl_Position = projectionMatrix * modelViewMatrix * mvPosition;
	// the intro: the mass sits over the centre, then the plates part back to their places
	gl_Position.xy *= 1.0 - 0.45 * uGather;
	vNdc = gl_Position.xy / max(gl_Position.w, 1e-4);            // where the fragment sits in the frame
}
`;

export const cloudFragment = /* glsl */ `
precision highp float;

uniform float uTime;            // this kind's vapour clock (already scaled by its drift)
uniform float uEdgeFeather;
uniform vec2 uResolution;
uniform sampler2D tPerlin, tNoise, tMouse;

uniform vec3 uLit, uShade;      // moonlit white at the rim, the same white in the body — never grey
uniform float uAlpha;           // the kind's density × the layer's scroll opacity
uniform float uStretch;         // > 1 pulls the vapour sideways: the veil streams, the puff stays round
uniform float uSoft;            // 0 = a cumulus edge, 1 = mist
uniform float uThin;            // scroll: the band thins from the bottom up (0..1)
uniform vec2 uFloorCut;         // rig y: gone below x, untouched above y — the film owns the bottom of the frame
uniform vec4 uHold;             // NDC rect (x0, y0, x1, y1) the plates part for
uniform float uHoldAmount;      // how far they part (the statement's own opacity)
uniform float uWakePush;        // how far the mouse wake pushes the vapour (uv)
uniform float uWakeClear;       // how much of the plate the wake clears (0..1)
uniform float uDense;           // intro: extra density (1 = the mass, 0 = the everyday plate)

varying vec2 vUv, vNdc;
varying float vSeed, vRatio, vWorldY;

void main() {
	vec2 ratioedUv = vec2(5.0 * uStretch, vRatio) * (vUv + vSeed * 0.1);

	vec2 sUv = gl_FragCoord.xy / uResolution;
	vec4 wake = texture2D(tMouse, sUv + 0.1 * (texture2D(tNoise, 0.4 * ratioedUv).g - 0.5));
	float mouse = clamp(max(wake.r, wake.g * 0.9), 0.0, 1.0);   // the brush and its soft skirt

	float time = uTime * 0.5;
	vec2 dUv = vUv;
	// the wake parts the vapour: it is pushed away from the cursor and the plate thins under it
	dUv *= 1.0 + 0.6 * uWakePush * mouse;
	dUv += uWakePush * mouse;
	dUv.y += 0.3 * (texture2D(tNoise, ratioedUv * 0.2 + vec2(-0.004, -0.02) * time).r - 0.5);
	dUv.y -= 0.5 * (texture2D(tNoise, ratioedUv * 0.08 + vec2(0.005, 0.01) * time).r - 0.5);
	dUv.y *= 1.0 + 0.1 * (texture2D(tPerlin, ratioedUv * 0.5 - 0.01 * time).r - 0.5);

	float smoothness = smoothstep(0.4, 0.7, texture2D(tNoise, ratioedUv * 0.08 + vec2(-0.08, -0.04) * time).r);

	// the body of the plate is its lower uv; the upper contour is ragged by the noise above.
	// the puff turns over in ~0.2 uv, the mist over ~0.5
	float top = 0.9 - 0.1 * smoothness;
	float foot = mix(mix(0.7, 0.4, uSoft), 0.05, uDense);   // the intro's mass: the whole plate is body
	float clouds = 1.0 - smoothstep(foot, top, dUv.y);
	clouds *= smoothstep(0.0, 0.2, dUv.y - 0.2 * smoothstep(0.4, 1.0, dUv.x));

	float alpha = clouds
		* (1.0 - smoothstep(0.9, 1.0, vUv.y)) * smoothstep(0.0, 0.1, vUv.y)
		* smoothstep(0.0, 0.1, vUv.x) * (1.0 - smoothstep(0.9, 1.0, vUv.x));
	// the solid core: its rectangle must never show — every edge is displaced by the plate's own noise so the
	// boundary is a ragged cloud edge, and the bottom one (the one that comes into frame as the band rises)
	// gets the widest feather (Alex, 18 Sep: a straight seam across the screen at the end of the scroll)
	// The core is NOT a rectangle any more (Alex, 18 Sep — photographed: two straight bands across the whole
	// screen, one per plate group; the plates are wider than the frame, so any straight uv bound is a line
	// across it). The core takes the shape of the cloud itself: its band is multiplied by the ragged `clouds`
	// contour, and its bounds are pushed around by two noises — no fragment row shares an edge.
	float coreN = texture2D(tNoise, ratioedUv * 0.15 + vec2(0.01, -0.02) * time).r - 0.5;
	float coreM = texture2D(tPerlin, ratioedUv * 0.06 - vec2(0.02, 0.01) * time).r - 0.5;
	float cy = vUv.y + coreN * 0.34 + coreM * 0.3, cx = vUv.x + coreN * 0.2;
	float core = smoothstep(0.2, 0.2 + uEdgeFeather * 3.0, cy) * (1.0 - smoothstep(0.7 - uEdgeFeather * 2.0, 0.7, cy))
		* smoothstep(0.2, 0.2 + uEdgeFeather, cx) * (1.0 - smoothstep(0.9 - uEdgeFeather, 0.9, cx));
	alpha += core * (0.35 + 0.65 * clouds);
	alpha = min(1.0, alpha * (1.0 + 4.0 * uDense));   // the intro's mass: the same vapour, thicker

	// rim light: the plate's edges (top contour and underside) catch the moon; the body stays in its own shade
	float rim = clamp(smoothstep(0.4, 1.0, dUv.y) + smoothstep(0.4, 0.0, dUv.y), 0.0, 1.0);
	vec3 color = mix(uShade, uLit, rim);

	alpha *= 1.0 - uThin * smoothstep(20.0, -45.0, vWorldY);   // the scroll thins the band from the bottom up
	// the film owns the bottom of the frame (not during the intro's mass). The cut is NOT a straight line: a world-y
	// cut on camera-facing plates would draw a horizontal seam across the screen (Alex, 18 Sep: "полоса посередине"),
	// so the height is offset per fragment by the plate's own noise — a ragged cloud edge, different on every plate
	float cutNoise = texture2D(tNoise, vUv * 1.7 + vSeed * 0.03).r - 0.5;
	float cutY = vWorldY + cutNoise * (uFloorCut.y - uFloorCut.x) * 1.4;
	alpha *= mix(smoothstep(uFloorCut.x, uFloorCut.y, cutY), 1.0, uDense);

	alpha *= 1.0 - uWakeClear * mouse;

	// the hold: inside the statement's rect the plates part, and they come back over ~0.22 NDC outside it
	vec2 d = max(uHold.xy - vNdc, vNdc - uHold.zw);
	float inside = 1.0 - smoothstep(0.0, 0.22, max(d.x, d.y));
	alpha *= 1.0 - 0.9 * uHoldAmount * inside;

	gl_FragColor = vec4(color, alpha * uAlpha);
}
`;

/*
 * MIST — small groups of horizontally stretched strands in the lower frame.
 *
 * The film is scrubbed, so wherever the scroll rests its own mist is a still; the rig's
 * plates are cut below the floor and fade toward the camp. These strips live in SCREEN space
 * (NDC, one instanced quad each): a soft lens shape, two noise fields stretched sideways and
 * streaming along the strip, a slow lateral breath per strip. They take the mouse wake and
 * the statement's hold like the plates.
 */
export const mistVertex = /* glsl */ `
precision highp float;

attribute vec4 aStrip;          // centre x, centre y (NDC), width, height (NDC)
attribute vec3 aSeed;           // seed, breath phase, drift speed
uniform float uTime;
uniform float uBreath;          // NDC amplitude of the lateral breath (0 under reduced motion)
uniform vec2 uParallax;         // the cursor's lean, NDC

varying vec2 vUv, vNdc;
varying vec3 vSeed;

void main() {
	vUv = uv;
	vSeed = aSeed;
	vec2 c = aStrip.xy;
	c.x += uBreath * sin(uTime * (0.03 + 0.02 * fract(aSeed.x * 7.1)) + aSeed.y);
	c += uParallax * (0.4 + 0.6 * fract(aSeed.x * 3.3));   // the nearer strips lean more
	vec2 p = c + (uv - 0.5) * aStrip.zw;
	vNdc = p;
	gl_Position = vec4(p, 0.0, 1.0);
}
`;

export const mistFragment = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform sampler2D tPerlin, tNoise, tMouse;
uniform vec3 uLit, uShade;
uniform float uAlpha;           // the kind's density × the scroll opacity
uniform vec4 uHold;
uniform float uHoldAmount;
uniform float uWakeClear;
uniform float uBlur;            // 0 = in focus (the scroll at rest), 1 = defocused (scrolling)

varying vec2 vUv, vNdc;
varying vec3 vSeed;

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

void main() {
	vec2 sUv = gl_FragCoord.xy / uResolution;
	vec4 wake = texture2D(tMouse, sUv);
	float mouse = clamp(max(wake.r, wake.g * 0.9), 0.0, 1.0);

	float drift = uTime * vSeed.z;
	vec2 c = vUv * 2.0 - 1.0;   // -1..1 across the strip

	// a cluster of four round bodies along the strip, each its own size and height — a puff, not a band
	float blob = 0.0;
	for (int i = 0; i < 4; i++) {
		float fi = float(i);
		float cx = -0.62 + 0.41 * fi + 0.22 * (hash(vSeed.x * 9.1 + fi) - 0.5);
		float cy = 0.30 * (hash(vSeed.x * 4.7 + fi * 1.3) - 0.5);
		float r = 0.40 + 0.28 * hash(vSeed.y * 3.1 + fi * 2.1);
		vec2 d = vec2((c.x - cx) / r, (c.y - cy) / (r * 0.72));
		blob += exp(-dot(d, d) * (2.0 - 0.9 * uBlur));   // defocus: the bodies swell and soften
	}
	blob = min(blob, 1.5);

	// the vapour: three octaves, hardly stretched, drifting slowly along the strip;
	// the top is torn by it (cumulus), the underside stays soft. Defocus drops the fine octaves.
	vec2 q = vec2(vUv.x * 2.3 + drift, vUv.y * 1.7 + vSeed.x * 5.0);
	float n = texture2D(tPerlin, q * 0.5).r * 0.5
	        + texture2D(tNoise,  q * 1.1 + vec2(drift * 0.5, 0.0)).r * 0.32 * (1.0 - 0.7 * uBlur)
	        + texture2D(tNoise,  q * 2.6 - vec2(drift * 0.3, 0.0)).g * 0.18 * (1.0 - uBlur)
	        + 0.25 * uBlur;   // keep the mean where it was
	float torn = mix(0.55, 1.0, smoothstep(0.0, 0.7, c.y + 0.3));   // more tearing toward the top
	float dens = smoothstep(0.30 - 0.22 * uBlur, 0.95 + 0.35 * uBlur, blob * mix(1.0, 0.45 + 1.1 * n, torn));
	dens *= 1.0 - smoothstep(0.55, 1.0, -c.y);                         // the underside fades out

	float alpha = dens * uAlpha * (1.0 - 0.3 * uBlur);   // out of focus, the light spreads: fainter
	alpha *= 1.0 - uWakeClear * mouse;

	vec2 dd = max(uHold.xy - vNdc, vNdc - uHold.zw);
	float inside = 1.0 - smoothstep(0.0, 0.22, max(dd.x, dd.y));
	alpha *= 1.0 - 0.9 * uHoldAmount * inside;

	// lit from above: the tops take the moon, the bodies keep the shade
	vec3 color = mix(uShade, uLit, smoothstep(-0.2, 0.8, c.y) * (0.5 + 0.5 * n));
	gl_FragColor = vec4(color, alpha);
}
`;
