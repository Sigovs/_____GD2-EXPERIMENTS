/*
 * sky-config.js — the sky system only (cylinder + fragment shader).
 *
 * `mode` picks the shader: 'day' = the original bright procedural sky,
 * 'night' = the alpine astrophotography test. Override per session with ?sky=day|night.
 *
 * Everything in NIGHT_SKY is a uniform of the night shader; nothing here touches
 * the mountain, clouds, fog, camera or lighting.
 */

export const SKY = {
	mode: 'night',
};

export const NIGHT_SKY = {
	/* Vertical gradient (sRGB hex; converted to linear at load) */
	skyTopColor: 0x02040a,        // zenith — near-black navy
	skyHorizonColor: 0x0a1426,    // horizon — deep cold blue
	gradientPower: 1.15,          // >1 keeps the sky darker for longer above the horizon
	horizonGlow: 0.18,            // thin cold haze hugging the horizon line (0 = off)
	horizonGlowColor: 0x142542,

	/* Stars — one hashed layer with classes: ~88 % pinpoints, ~10 % medium, ~2 % bright */
	starDensity: 1.0,             // population multiplier
	starBrightness: 0.55,         // overall intensity (pinpoints stay well below 1)
	starSize: 1.0,                // 1 = pinpoints ≈ 0.55 px radius, medium 0.8 px, bright 1.15 px
	starClustering: 1.0,          // 0 = uniform random, 1 = dense/sparse regions driven by a low-frequency field
	starColor: 0xd6e0f5,          // cool white
	twinkleStrength: 0.2,         // only the ~2 % bright class breathes slowly; 0 = none
	twinkleSpeed: 0.5,            // rad/s
	starFadeFraction: 0.35,       // share of (non-bright) stars that slowly appear and disappear; 0 = static field
	starFadeSpeed: 0.25,          // rad/s — a full appear→disappear cycle takes ~25–50 s per star

	/* Star dust — low-frequency band, monochrome blue-grey, extremely faint */
	dustStrength: 1.0,            // 0 = off
	dustColor: 0x7d92b8,
	dustBandTilt: [0.35, 0.72, -0.60],   // normal of the dust band's great circle (world space)
	dustBandWidth: 0.5,           // 0..1, angular half-width (as |dot| threshold)

	/* Broad cold atmospheric back-glow behind the summit */
	summitGlowStrength: 1.0,      // 0 = off
	summitGlowColor: 0x2a4470,
	summitGlowRadius: [0.75, 0.42],  // radians: horizontal / vertical falloff of the core; the skirt is 2× wider
	summitGlowLift: 0.05,         // radians: raise the glow centre above the summit direction

	/* Broad irregular atmospheric lift behind / above the summit — anchored to a
	   fixed sky direction taken from the HERO camera → summit line, so it stays
	   put in the sky while the camera orbits. */
	atmosphericGlowStrength: 1.0,        // 0 = off; 1 ≈ +5–10 % over the surrounding sky
	atmosphericGlowRadius: 0.30,         // radians, 1/e radius of the main field (≈ 35–45 % of the viewport width)
	atmosphericGlowOffset: [0.10, 0.09], // radians: [azimuth, elevation] shift from the summit direction (off-centre on purpose)
	atmosphericGlowNoiseAmount: 0.5,     // 0 = clean radial (avoid), 1 = heavily warped
	atmosphericGlowNoiseScale: 1.6,      // low-frequency noise scale over the sky
	atmosphericGlowColor: 0x3a4a66,      // cold desaturated blue-grey

	/* Photographic sky plate blended UNDER the procedural sky (mapped on the sky
	   sphere by azimuth / elevation, so it turns with the world like the stars).
	   blend 0 = procedural only, 1 = photo only. */
	photo: {
		file: '3D_ASSETS/nightsky.png',
		blend: 0.65,               // how much of the photo shows through the procedural sky
		exposure: 1.15,            // photo brightness multiplier
		azimuthSpanDeg: 170,       // how many degrees of azimuth the image width covers (mirrored beyond)
		azimuthOffsetDeg: 170,     // where the image centre sits; 170° puts the Milky Way behind / above the summit at the hero angle
		elevationMinDeg: -8,       // image bottom edge
		elevationMaxDeg: 64,       // image top edge
		proceduralFade: 0.45,      // 0..1: how much the procedural stars/dust step back when the photo is on
	},
};
