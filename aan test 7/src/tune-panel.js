import GUI from 'lil-gui';
import { MOUNTAIN_DESCENT } from './descent-config.js';

/*
 * tune-panel.js — a live tuning panel for the look of the scene: mountain, sky, route, callouts.
 *
 * Open with ?tune in the URL or press T (T again hides it). Every control writes straight into
 * the running materials and CSS variables; nothing is written to the config files.
 * "Copy values" puts the current settings on the clipboard (and in the console), named by the
 * file and key they belong to, so they can be written back into the source.
 * Tweaks are remembered in this browser only (localStorage) and re-applied when the panel opens;
 * "Reset to config" drops them and returns to what the files say.
 */

const STORAGE_KEY = 'aan7-tune';
const hex = (color) => `#${color.getHexString()}`;
const hexInt = (css) => `0x${css.replace('#', '').toLowerCase()}`;
const round = (v) => Math.round(v * 1000) / 1000;

export function createTunePanel(ctx) {
	const { gd2Material, babies, nightSkyMaterial, descent, cloudFloor, cloudMaterial, SETTINGS } = ctx;
	const floorLayers = cloudFloor?.layers ?? [];
	const conduit = descent.conduit;
	const cu = conduit?.uniforms ?? null;
	const ccfg = MOUNTAIN_DESCENT.style.conduit;
	const m = gd2Material.uniforms;
	const s = nightSkyMaterial.uniforms;
	const lines = descent.group.children.filter((o) => o.isLine2);
	const byOrder = (order) => lines.find((l) => l.renderOrder === order);
	const core = byOrder(0), glow = byOrder(-0.5), casing = byOrder(-1);
	const labels = document.getElementById('route-labels');
	const cssVar = (name) => getComputedStyle(labels).getPropertyValue(name).trim();

	const params = {
		// mountain
		mountainBrightness: m.uAmbientIntensity.value,
		mountainReflections: m.uEnvMapIntensity.value,
		mountainTint: hex(m.uColor.value),
		haze: hex(m.uLightColor.value),
		peaksBrightness: babies[0]?.material.uniforms.uAmbientIntensity.value ?? 0.58,
		mountainRoughness: m.uRoughness.value,
		snowCoverage: m.uSnowCoverage?.value ?? 0.35,
		steepRock: m.uSteepRock?.value ?? 0.7,
		rockRelief: m.uSrcNormalScale?.value ?? 1,
		// clouds (the nine camera quads + the sea share one clock)
		cloudDrift: SETTINGS?.cloudSpeed ?? 0.55,
		// sky
		skyZenith: hex(s.uSkyTopColor.value),
		skyHorizon: hex(s.uSkyHorizonColor.value),
		horizonGlow: hex(s.uHorizonGlowColor.value),
		photoExposure: s.uPhotoExposure.value,
		stars: s.uStarBrightness.value,
		summitGlow: s.uSummitGlowStrength.value,
		atmosphere: s.uAtmoGlowStrength.value,
		airglow: s.uAirglowStrength.value,
		airglowColor: hex(s.uAirglowColor.value),
		airglowShift: hex(s.uAirglowShiftColor.value),
		// route
		pathColor: hex(core.material.color),
		pathWidth: core.material.linewidth,
		tipColor: core.material.uniforms.uRouteTipColor ? hex(core.material.uniforms.uRouteTipColor.value) : '#ffffff',
		glowColor: hex(glow.material.color),
		glowOpacity: glow.material.opacity,
		glowWidth: glow.material.linewidth,
		glowSoftness: glow.material.userData.soft?.value ?? 0,
		casingColor: hex(casing.material.color),
		casingOpacity: casing.material.opacity,
		casingWidth: casing.material.linewidth,
		// callouts
		calloutsMatchPath: false,
		calloutAccent: cssVar('--cyan') || '#00ecff',
		calloutTitleOnCloud: cssVar('--ink-deep') || '#00505c',
		// fluid conduit (route tube) — radii need a rebuild, everything else is live
		conduitFluidColor: cu ? hex(cu.uFluidColor.value) : '#37d6ff',
		conduitEmission: cu ? cu.uBaseEmission.value : 0.8,
		conduitFlowSpeed: cu ? cu.uFlowSpeed.value : 0.35,
		conduitNoise: cu ? cu.uNoiseStrength.value : 0.45,
		conduitPulseColor: cu ? hex(cu.uPulseColor.value) : '#e8fbff',
		conduitPulseStrength: cu ? cu.uPulseStrength.value : 3.2,
		conduitPulseLength: cu ? cu.uPulseLength.value : 9,
		conduitPulseSpeed: ccfg.pulseSpeed,
		conduitPulsePause: ccfg.pulsePause,
		conduitHalo: conduit?.halo ? conduit.halo.material.uniforms.uHalo.value : 0.7,
		conduitTip: cu ? cu.uTipStrength.value : 0.9,
		conduitShellOpacity: conduit?.shell ? conduit.shell.material.opacity : 0.3,
		conduitShellTint: conduit?.shell ? hex(conduit.shell.material.color) : '#cfe6ff',
		conduitShellRoughness: conduit?.shell ? conduit.shell.material.roughness : 0.12,
		conduitShellEnv: conduit?.shell ? conduit.shell.material.envMapIntensity : 0.9,
		// cloud sea under the mountain
		floorEnabled: cloudFloor ? cloudFloor.group.visible : false,
		floorTopY: floorLayers[0]?.position.y ?? -1.5,
		floorTopCoverage: floorLayers[0]?.material.uniforms.uCoverage.value ?? 0.42,
		floorMidY: floorLayers[1]?.position.y ?? -6.5,
		floorMidCoverage: floorLayers[1]?.material.uniforms.uCoverage.value ?? 0.68,
		floorBaseY: floorLayers[2]?.position.y ?? -12.5,
		floorLight: floorLayers[0] ? hex(floorLayers[0].material.uniforms.uColorLight.value) : '#f5f8fb',
		floorDark: floorLayers[0] ? hex(floorLayers[0].material.uniforms.uColorDark.value) : '#d1dbe3',
		quadEdgeFeather: cloudMaterial?.uniforms.uEdgeFeather.value ?? 0.16,
	};
	const fromConfig = { ...params };

	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
		if (saved) Object.keys(params).forEach((k) => { if (k in saved) params[k] = saved[k]; });
	} catch { /* storage unavailable: start from the config */ }

	function apply(remember = true) {
		m.uAmbientIntensity.value = params.mountainBrightness;
		m.uEnvMapIntensity.value = params.mountainReflections;
		m.uColor.value.set(params.mountainTint);
		m.uLightColor.value.set(params.haze);   // shared: the mountain's and the peaks' distance haze
		babies.forEach((b) => { b.material.uniforms.uAmbientIntensity.value = params.peaksBrightness; });
		m.uRoughness.value = params.mountainRoughness;
		if (m.uSnowCoverage) m.uSnowCoverage.value = params.snowCoverage;
		if (m.uSteepRock) m.uSteepRock.value = params.steepRock;
		if (m.uSrcNormalScale) m.uSrcNormalScale.value = params.rockRelief;
		if (SETTINGS) SETTINGS.cloudSpeed = params.cloudDrift;

		s.uSkyTopColor.value.set(params.skyZenith);
		s.uSkyHorizonColor.value.set(params.skyHorizon);
		s.uHorizonGlowColor.value.set(params.horizonGlow);
		s.uPhotoExposure.value = params.photoExposure;
		s.uStarBrightness.value = params.stars;
		s.uSummitGlowStrength.value = params.summitGlow;
		s.uAtmoGlowStrength.value = params.atmosphere;
		s.uAirglowStrength.value = params.airglow;
		s.uAirglowColor.value.set(params.airglowColor);
		s.uAirglowShiftColor.value.set(params.airglowShift);

		core.material.color.set(params.pathColor);
		core.material.linewidth = params.pathWidth;
		core.material.uniforms.uRouteTipColor?.value.set(params.tipColor);
		glow.material.color.set(params.glowColor);
		glow.material.opacity = params.glowOpacity;
		glow.material.linewidth = params.glowWidth;
		if (glow.material.userData.soft) glow.material.userData.soft.value = params.glowSoftness;
		casing.material.color.set(params.casingColor);
		casing.material.opacity = params.casingOpacity;
		casing.material.linewidth = params.casingWidth;

		const accent = params.calloutsMatchPath ? params.pathColor : params.calloutAccent;
		labels.style.setProperty('--cyan', accent);
		labels.style.setProperty('--cyan-glow', `color-mix(in srgb, ${accent} 55%, transparent)`);
		labels.style.setProperty('--ink-deep', params.calloutTitleOnCloud);
		descent.stops.forEach((st) => { st.renderedGround = null; });   // leaders re-read their ink next frame

		if (cloudFloor) {
			cloudFloor.group.visible = params.floorEnabled;
			const ys = [params.floorTopY, params.floorMidY, params.floorBaseY];
			const cov = [params.floorTopCoverage, params.floorMidCoverage, 1];
			floorLayers.forEach((l, i) => {
				l.position.y = ys[i] ?? l.position.y;
				l.material.uniforms.uCoverage.value = cov[i] ?? l.material.uniforms.uCoverage.value;
				l.material.uniforms.uColorLight.value.set(params.floorLight);
				l.material.uniforms.uColorDark.value.set(params.floorDark);
			});
		}
		if (cloudMaterial) cloudMaterial.uniforms.uEdgeFeather.value = params.quadEdgeFeather;

		if (cu) {
			cu.uFluidColor.value.set(params.conduitFluidColor);
			cu.uBaseEmission.value = params.conduitEmission;
			cu.uFlowSpeed.value = params.conduitFlowSpeed;
			cu.uNoiseStrength.value = params.conduitNoise;
			cu.uPulseColor.value.set(params.conduitPulseColor);
			cu.uPulseStrength.value = params.conduitPulseStrength;
			cu.uPulseLength.value = params.conduitPulseLength;
			cu.uTipStrength.value = params.conduitTip;
			ccfg.pulseSpeed = params.conduitPulseSpeed;      // read every frame by descent.update
			ccfg.pulsePause = params.conduitPulsePause;
			ccfg.pulseLength = params.conduitPulseLength;
			if (conduit.halo) conduit.halo.material.uniforms.uHalo.value = params.conduitHalo;
			if (conduit.shell) {
				const sm = conduit.shell.material;
				sm.opacity = params.conduitShellOpacity;
				sm.color.set(params.conduitShellTint);
				sm.roughness = params.conduitShellRoughness;
				sm.envMapIntensity = params.conduitShellEnv;
			}
		}

		if (remember) {
			try { localStorage.setItem(STORAGE_KEY, JSON.stringify(params)); } catch { /* not remembered */ }
		}
	}

	/* ---- the panel ---------------------------------------------------- */
	const gui = new GUI({ title: 'Tune · T hides', width: 300 });
	gui.domElement.style.setProperty('--font-family', '"Inter Tight", system-ui, sans-serif');
	gui.domElement.style.zIndex = '40';

	const mountain = gui.addFolder('Mountain');
	mountain.add(params, 'mountainBrightness', 0.3, 3.5, 0.01).name('Brightness');
	mountain.add(params, 'mountainReflections', 0, 1, 0.01).name('Reflections');
	mountain.addColor(params, 'mountainTint').name('Tint');
	mountain.addColor(params, 'haze').name('Distance haze');
	mountain.add(params, 'peaksBrightness', 0.1, 3.5, 0.01).name('Small peaks');
	mountain.add(params, 'mountainRoughness', 0.04, 1, 0.01).name('Snow roughness');
	mountain.add(params, 'snowCoverage', 0, 1, 0.01).name('Snow coverage');
	mountain.add(params, 'steepRock', 0, 1, 0.01).name('Rock on steep faces');
	mountain.add(params, 'rockRelief', 0, 2.5, 0.01).name('Rock relief');

	const sky = gui.addFolder('Sky');
	sky.addColor(params, 'skyZenith').name('Zenith');
	sky.addColor(params, 'skyHorizon').name('Horizon');
	sky.addColor(params, 'horizonGlow').name('Horizon glow');
	sky.add(params, 'photoExposure', 0, 1.5, 0.01).name('Photo brightness');
	sky.add(params, 'stars', 0, 1.5, 0.01).name('Stars');
	sky.add(params, 'summitGlow', 0, 2, 0.01).name('Glow behind summit');
	sky.add(params, 'atmosphere', 0, 2, 0.01).name('Atmosphere');
	sky.add(params, 'airglow', 0, 3, 0.01).name('Violet shimmer');
	sky.addColor(params, 'airglowColor').name('Shimmer colour');
	sky.addColor(params, 'airglowShift').name('Shimmer shift');
	sky.close();

	const path = gui.addFolder('Path');
	path.addColor(params, 'pathColor').name('Core colour');
	path.add(params, 'pathWidth', 0.5, 8, 0.1).name('Core width');
	path.addColor(params, 'tipColor').name('Drawing tip');
	path.addColor(params, 'glowColor').name('Glow colour');
	path.add(params, 'glowOpacity', 0, 1, 0.01).name('Glow opacity');
	path.add(params, 'glowWidth', 0, 40, 0.5).name('Glow width');
	path.add(params, 'glowSoftness', 0, 6, 0.1).name('Glow softness');
	path.addColor(params, 'casingColor').name('Casing colour');
	path.add(params, 'casingOpacity', 0, 1, 0.01).name('Casing opacity');
	path.add(params, 'casingWidth', 0, 20, 0.5).name('Casing width');
	path.close();

	const callouts = gui.addFolder('Callouts');
	callouts.add(params, 'calloutsMatchPath').name('Accent = path colour');
	callouts.addColor(params, 'calloutAccent').name('Accent on sky');
	callouts.addColor(params, 'calloutTitleOnCloud').name('Title on cloud');
	callouts.close();

	if (cu) {
		const tube = gui.addFolder('Conduit');
		tube.addColor(params, 'conduitFluidColor').name('Fluid colour');
		tube.add(params, 'conduitEmission', 0, 2, 0.01).name('Fluid brightness');
		tube.add(params, 'conduitFlowSpeed', 0, 1.5, 0.01).name('Flow speed');
		tube.add(params, 'conduitNoise', 0, 1, 0.01).name('Flow clotting');
		tube.addColor(params, 'conduitPulseColor').name('Pulse colour');
		tube.add(params, 'conduitPulseStrength', 0, 6, 0.05).name('Pulse strength');
		tube.add(params, 'conduitPulseLength', 1, 30, 0.5).name('Pulse length');
		tube.add(params, 'conduitPulseSpeed', 0, 40, 0.5).name('Pulse speed');
		tube.add(params, 'conduitPulsePause', 0, 120, 1).name('Pause between pulses');
		tube.add(params, 'conduitHalo', 0, 2, 0.01).name('Pulse halo');
		tube.add(params, 'conduitTip', 0, 2, 0.01).name('Drawing tip');
		tube.add(params, 'conduitShellOpacity', 0, 1, 0.01).name('Shell opacity');
		tube.addColor(params, 'conduitShellTint').name('Shell tint');
		tube.add(params, 'conduitShellRoughness', 0, 1, 0.01).name('Shell roughness');
		tube.add(params, 'conduitShellEnv', 0, 3, 0.01).name('Shell reflections');
		tube.close();
	}

	const clouds = gui.addFolder('Clouds');
	clouds.add(params, 'cloudDrift', 0, 1.5, 0.01).name('Drift speed');
	clouds.add(params, 'quadEdgeFeather', 0.05, 0.4, 0.01).name('Cloud quad edge');
	clouds.close();

	const floor = gui.addFolder('Cloud sea');
	floor.add(params, 'floorEnabled').name('Enabled');
	floor.add(params, 'floorTopY', -20, 10, 0.5).name('Top layer height');
	floor.add(params, 'floorTopCoverage', 0, 1, 0.01).name('Top coverage');
	floor.add(params, 'floorMidY', -25, 5, 0.5).name('Mid layer height');
	floor.add(params, 'floorMidCoverage', 0, 1, 0.01).name('Mid coverage');
	floor.add(params, 'floorBaseY', -30, 0, 0.5).name('Base layer height');
	floor.addColor(params, 'floorLight').name('Crest colour');
	floor.addColor(params, 'floorDark').name('Trough colour');
	floor.close();

	gui.onChange(() => apply(true));

	const actions = {
		copy() {
			const accent = params.calloutsMatchPath ? params.pathColor : params.calloutAccent;
			const values = {
				'mountain-config.js': {
					'MAIN_MOUNTAIN_GORA_1.material': { ambientIntensity: round(params.mountainBrightness), envMapIntensity: round(params.mountainReflections), color: hexInt(params.mountainTint) },
					'BABY_MOUNTAINS.material': { ambientIntensity: round(params.peaksBrightness) },
				},
				'mountain.js': { LIGHT_COLOR: hexInt(params.haze) },
				'sky-config.js → NIGHT_SKY': {
					skyTopColor: hexInt(params.skyZenith), skyHorizonColor: hexInt(params.skyHorizon), horizonGlowColor: hexInt(params.horizonGlow),
					'photo.exposure': round(params.photoExposure), starBrightness: round(params.stars),
					summitGlowStrength: round(params.summitGlow), atmosphericGlowStrength: round(params.atmosphere),
					'airglow.strength': round(params.airglow), 'airglow.color': hexInt(params.airglowColor), 'airglow.shiftColor': hexInt(params.airglowShift),
				},
				'descent-config.js → style.route': {
					color: hexInt(params.pathColor), widthPx: round(params.pathWidth), tipColor: hexInt(params.tipColor),
					glowColor: hexInt(params.glowColor), glowOpacity: round(params.glowOpacity), glowWidthPx: round(params.glowWidth), glowSoftness: round(params.glowSoftness),
					casingColor: hexInt(params.casingColor), casingOpacity: round(params.casingOpacity), casingWidthPx: round(params.casingWidth),
				},
				'descent-config.js → style.conduit': {
					fluidColor: hexInt(params.conduitFluidColor), fluidBaseEmission: round(params.conduitEmission), fluidFlowSpeed: round(params.conduitFlowSpeed), fluidNoiseStrength: round(params.conduitNoise),
					pulseColor: hexInt(params.conduitPulseColor), pulseStrength: round(params.conduitPulseStrength), pulseLength: round(params.conduitPulseLength), pulseSpeed: round(params.conduitPulseSpeed), pulsePause: round(params.conduitPulsePause),
					haloStrength: round(params.conduitHalo), tipStrength: round(params.conduitTip),
					tubeShellOpacity: round(params.conduitShellOpacity), tubeShellTint: hexInt(params.conduitShellTint), shellRoughness: round(params.conduitShellRoughness), shellEnvIntensity: round(params.conduitShellEnv),
				},
				'route.css → #route-labels': { '--cyan': accent, '--ink-deep': params.calloutTitleOnCloud },
				'cloud-floor.js → CLOUD_FLOOR': {
					enabled: params.floorEnabled, colorLight: hexInt(params.floorLight), colorDark: hexInt(params.floorDark),
					'layers[0].y': params.floorTopY, 'layers[0].coverage': round(params.floorTopCoverage),
					'layers[1].y': params.floorMidY, 'layers[1].coverage': round(params.floorMidCoverage), 'layers[2].y': params.floorBaseY,
				},
				'mountain.js → SETTINGS': { cloudEdgeFeather: round(params.quadEdgeFeather), cloudSpeed: round(params.cloudDrift) },
				'mountain-config.js → MAIN_MOUNTAIN_GORA_1 (material / hybrid)': { roughness: round(params.mountainRoughness), 'hybrid.snowCoverage': round(params.snowCoverage), 'hybrid.steepRock': round(params.steepRock), 'hybrid.normalScale': round(params.rockRelief) },
			};
			const text = JSON.stringify(values, null, 2);
			console.log('[tune] current values\n' + text);
			const done = (label) => { copyButton.name(label); setTimeout(() => copyButton.name('Copy values'), 1600); };
			if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => done('Copied ✓'), () => done('In the console'));
			else done('In the console');
		},
		reset() {
			Object.assign(params, fromConfig);
			try { localStorage.removeItem(STORAGE_KEY); } catch { /* nothing stored */ }
			gui.controllersRecursive().forEach((c) => c.updateDisplay());
			apply(false);
		},
	};
	const copyButton = gui.add(actions, 'copy').name('Copy values');
	gui.add(actions, 'reset').name('Reset to config');

	gui.controllersRecursive().forEach((c) => c.updateDisplay());
	apply(false);

	let visible = true;
	window.addEventListener('keydown', (e) => {
		if ((e.key === 't' || e.key === 'T') && !e.target.closest?.('input, textarea, select')) {
			visible = !visible;
			gui.show(visible);
		}
	});

	return gui;
}
