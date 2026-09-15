import GUI from 'lil-gui';

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
	const { gd2Material, babies, nightSkyMaterial, descent } = ctx;
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
				'route.css → #route-labels': { '--cyan': accent, '--ink-deep': params.calloutTitleOnCloud },
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
