import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { MOUNTAIN_DESCENT } from './descent-config.js';

/*
 * descent.js — the scroll-driven descent route.
 *
 *  TerrainProbe   : max-radius grid (azimuth × height) built once from the mountain
 *                   mesh; turns (az, y) into a point on the outer surface.
 *  Route          : control points → Catmull-Rom in (az, y) → dense samples → probe →
 *                   3D polyline that hugs the terrain, lifted by `hover`.
 *  Line2 (×3)     : a glow line — dark casing, soft additive glow (alpha falls off across
 *                   its width), pale core. The draw-on, tip colour and tip fade are uniforms
 *                   injected into LineMaterial (progress in route length via vLineDistance) —
 *                   nothing is rebuilt per frame.
 *  Markers (×3)   : billboard quads with a tiny core / thin ring / halo shader,
 *                   depth-tested against the mountain like the line (off by default:
 *                   the callout's anchor dot marks the stop).
 *  Callouts (×3)  : DOM, after aan test 4 / index2. The reading holds still in a slot;
 *                   the anchor dot is projected from the stop every frame, and the leader
 *                   is rebuilt between the two. Hidden when occluded (throttled raycast)
 *                   or off-screen.
 *  Camera state   : smooth keyframes over the same timeline, consumed by mountain.js.
 */

const DEG = THREE.MathUtils.degToRad;
const cfg = MOUNTAIN_DESCENT;

/* ------------------------------------------------------------------ */
/* Keyframe helpers                                                    */
/* ------------------------------------------------------------------ */

/** Piecewise smoothstep interpolation of [[t, v], ...] (sorted by t). */
function smoothKeys(keys, t) {
	if (t <= keys[0][0]) return keys[0][1];
	for (let i = 1; i < keys.length; i++) {
		if (t <= keys[i][0]) {
			const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
			const k = THREE.MathUtils.smoothstep(t, t0, t1);
			return v0 + (v1 - v0) * k;
		}
	}
	return keys[keys.length - 1][1];
}

/** Piecewise linear interpolation of [[t, v], ...]. */
function linearKeys(keys, t) {
	if (t <= keys[0][0]) return keys[0][1];
	for (let i = 1; i < keys.length; i++) {
		if (t <= keys[i][0]) {
			const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
			return v0 + (v1 - v0) * ((t - t0) / (t1 - t0));
		}
	}
	return keys[keys.length - 1][1];
}

/* ------------------------------------------------------------------ */
/* Terrain probe                                                       */
/* ------------------------------------------------------------------ */

class TerrainProbe {
	constructor(mesh, pivot, { azBins = 360, yStep = 1 } = {}) {
		this.pivot = pivot.clone();
		this.azBins = azBins;
		this.yStep = yStep;
		mesh.updateMatrixWorld(true);
		const pos = mesh.geometry.attributes.position;
		const v = new THREE.Vector3();
		let yMin = Infinity, yMax = -Infinity;
		const pts = new Float32Array(pos.count * 3);
		for (let i = 0; i < pos.count; i++) {
			v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
			pts[i * 3] = v.x; pts[i * 3 + 1] = v.y; pts[i * 3 + 2] = v.z;
			yMin = Math.min(yMin, v.y); yMax = Math.max(yMax, v.y);
		}
		this.yMin = Math.floor(yMin); this.yMax = Math.ceil(yMax);
		this.yBins = Math.round((this.yMax - this.yMin) / yStep) + 1;
		const grid = new Float32Array(azBins * this.yBins).fill(-1);
		for (let i = 0; i < pos.count; i++) {
			const dx = pts[i * 3] - pivot.x, dz = pts[i * 3 + 2] - pivot.z, y = pts[i * 3 + 1];
			const r = Math.hypot(dx, dz);
			const a = ((Math.atan2(dz, dx) / (Math.PI * 2)) + 1) % 1;
			const ai = Math.min(azBins - 1, Math.floor(a * azBins));
			const yi = Math.min(this.yBins - 1, Math.max(0, Math.round((y - this.yMin) / yStep)));
			const k = yi * azBins + ai;
			if (r > grid[k]) grid[k] = r;
		}
		// fill empty cells from azimuth neighbours (wrapping), then from the row below
		for (let pass = 0; pass < 6; pass++) {
			for (let yi = 0; yi < this.yBins; yi++) for (let ai = 0; ai < azBins; ai++) {
				const k = yi * azBins + ai;
				if (grid[k] >= 0) continue;
				const l = grid[yi * azBins + ((ai + azBins - 1) % azBins)], rr = grid[yi * azBins + ((ai + 1) % azBins)];
				if (l >= 0 && rr >= 0) grid[k] = Math.max(l, rr);
				else if (l >= 0) grid[k] = l;
				else if (rr >= 0) grid[k] = rr;
				else if (yi > 0 && grid[(yi - 1) * azBins + ai] >= 0) grid[k] = grid[(yi - 1) * azBins + ai] * 0.9;
			}
		}
		for (let k = 0; k < grid.length; k++) if (grid[k] < 0) grid[k] = 0;
		// light smoothing along azimuth so the line does not stair-step on 1° cells
		const sm = new Float32Array(grid.length);
		for (let yi = 0; yi < this.yBins; yi++) for (let ai = 0; ai < azBins; ai++) {
			let s = 0;
			for (let o = -2; o <= 2; o++) s += grid[yi * azBins + ((ai + o + azBins) % azBins)];
			sm[yi * azBins + ai] = s / 5;
		}
		this.grid = sm;
	}

	radius(azDeg, y) {
		const a = (((azDeg / 360) % 1) + 1) % 1;
		const af = a * this.azBins, ai = Math.floor(af), at = af - ai;
		const yf = THREE.MathUtils.clamp((y - this.yMin) / this.yStep, 0, this.yBins - 1.001), yi = Math.floor(yf), yt = yf - yi;
		const g = this.grid, n = this.azBins;
		const r00 = g[yi * n + (ai % n)], r10 = g[yi * n + ((ai + 1) % n)];
		const r01 = g[(yi + 1) * n + (ai % n)], r11 = g[(yi + 1) * n + ((ai + 1) % n)];
		return (r00 * (1 - at) + r10 * at) * (1 - yt) + (r01 * (1 - at) + r11 * at) * yt;
	}

	/**
	 * Low-resolution closed surface built from the grid (for cheap raycasts — label
	 * occlusion — instead of hitting the 90k-triangle mountain every frame).
	 */
	buildProxyMesh(azStep = 4, yStep = 2) {
		const na = Math.floor(360 / azStep), ny = Math.floor((this.yMax - this.yMin) / yStep) + 1;
		const pos = new Float32Array(na * ny * 3);
		const v = new THREE.Vector3();
		for (let j = 0; j < ny; j++) for (let i = 0; i < na; i++) {
			this.point(i * azStep, this.yMin + j * yStep, 0, v);
			const k = (j * na + i) * 3;
			pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z;
		}
		const idx = [];
		for (let j = 0; j < ny - 1; j++) for (let i = 0; i < na; i++) {
			const a = j * na + i, b = j * na + ((i + 1) % na), c = (j + 1) * na + i, d = (j + 1) * na + ((i + 1) % na);
			idx.push(a, b, c, b, d, c);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		g.setIndex(idx);
		g.computeBoundingSphere();
		const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
		mesh.name = 'TerrainProxy';
		mesh.visible = false;   // never rendered; raycast target only
		return mesh;
	}

	/** Surface point at (az, y) lifted by `hover` along the radial direction. */
	point(azDeg, y, hover = 0, target = new THREE.Vector3()) {
		const r = this.radius(azDeg, y) + hover;
		const a = DEG(azDeg);
		return target.set(this.pivot.x + Math.cos(a) * r, y, this.pivot.z + Math.sin(a) * r);
	}
}

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
/* ------------------------------------------------------------------ */

const routeUniforms = {
	uRouteProgress: { value: 0 },
	uRouteTotal: { value: 1 },
	uRouteTipLength: { value: cfg.style.route.tipLength },
	uRouteTipColor: { value: new THREE.Color(cfg.style.route.tipColor) },
	uRouteTipMix: { value: cfg.style.route.tipMix },
};

/**
 * tipAmount: how much of the tip colour this layer takes at the drawing tip (core 1, glow 0.6, casing 0).
 * softness:  alpha falloff across the line's width — 0 = a flat band, >0 = pow(1 − |across|, softness),
 *            so a wide additive layer blooms instead of ending in a hard edge. Per material, live in
 *            mat.userData.soft (the tuning panel drives it).
 */
function makeRouteMaterial({ color, opacity, widthPx, resolution, tipAmount = 1, softness = 0 }) {
	const mat = new LineMaterial({
		color, opacity, linewidth: widthPx, transparent: true, depthWrite: false,
		worldUnits: false, dashed: true, dashSize: 1e6, gapSize: 0,
		polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
		alphaToCoverage: false,
	});
	mat.resolution.copy(resolution);
	mat.userData.soft = { value: softness };
	mat.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, routeUniforms);
		shader.uniforms.uLineSoft = mat.userData.soft;
		shader.fragmentShader = shader.fragmentShader
			.replace('uniform float opacity;', `uniform float opacity;
uniform float uRouteProgress, uRouteTotal, uRouteTipLength, uRouteTipMix, uLineSoft;
uniform vec3 uRouteTipColor;`)
			.replace('gl_FragColor = vec4( diffuseColor.rgb, alpha );', `
float routeT = vLineDistance / uRouteTotal;
if (routeT > uRouteProgress) discard;
float tipW = uRouteTipLength / uRouteTotal;
float tip = smoothstep(uRouteProgress - tipW, uRouteProgress, routeT);
float endFade = smoothstep(uRouteProgress, uRouteProgress - tipW * 0.35, routeT);
float across = uLineSoft > 0.0 ? pow(clamp(1.0 - abs(vUv.x), 0.0, 1.0), uLineSoft) : 1.0;
vec3 routeRgb = mix(diffuseColor.rgb, uRouteTipColor, tip * uRouteTipMix * ${tipAmount.toFixed(2)});
gl_FragColor = vec4(routeRgb, alpha * endFade * across);`);
	};
	return mat;
}

const markerVertex = /* glsl */ `
uniform vec2 uResolution;
uniform float uSizePx, uScale;
varying vec2 vUv;
void main() {
	vUv = position.xy;
	vec4 clip = projectionMatrix * modelViewMatrix * vec4(0., 0., 0., 1.);
	clip.xy += position.xy * uSizePx * uScale / uResolution * 2.0 * clip.w;
	gl_Position = clip;
}`;

const markerFragment = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uActivation, uRingRadius, uRingWidth, uCoreRadius, uHalo;
varying vec2 vUv;
void main() {
	float r = length(vUv);
	float aa = fwidth(r) * 1.2;
	float core = 1.0 - smoothstep(uCoreRadius - aa, uCoreRadius + aa, r);
	float ring = 1.0 - smoothstep(uRingWidth, uRingWidth + aa * 1.5, abs(r - uRingRadius));
	float halo = exp(-r * r * 4.5) * uHalo * (0.6 + 0.4 * uActivation);
	float a = clamp(core + ring * 0.85 + halo, 0.0, 1.0) * uActivation;
	vec3 c = mix(uColor, vec3(1.0), core * 0.6);
	gl_FragColor = vec4(c, a);
	gl_FragColor = linearToOutputTexel(gl_FragColor);
}`;

/* ------------------------------------------------------------------ */
/* Descent                                                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Fluid conduit shaders                                               */
/* ------------------------------------------------------------------ */

const fluidVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalV, vViewV;
void main() {
	vUv = uv;
	vec4 mv = modelViewMatrix * vec4(position, 1.);
	vNormalV = normalize(normalMatrix * normal);
	vViewV = -mv.xyz;
	gl_Position = projectionMatrix * mv;
}`;

const fluidFragment = /* glsl */ `
precision highp float;
uniform sampler2D tNoise;
uniform float uTime, uRouteProgress, uRouteTotal;
uniform float uFlowSpeed, uNoiseStrength, uBaseEmission;
uniform float uPulsePos, uPulseLength, uPulseStrength;
uniform float uTipLength, uTipStrength, uHalo;   // uHalo > 0: this mesh is the additive halo around the pulse only
uniform vec3 uFluidColor, uPulseColor, uTipColor;
varying vec2 vUv;
varying vec3 vNormalV, vViewV;

void main() {
	if (vUv.x > uRouteProgress) discard;
	if (uHalo > 0.0) {
		float facingH = abs(dot(normalize(vNormalV), normalize(vViewV)));
		float alongH = vUv.x * uRouteTotal;
		float dh = (alongH - uPulsePos) / (uPulseLength * 1.6);
		float g = exp(-dh * dh) * pow(facingH, 2.0) * uHalo;
		if (g < 0.004) discard;
		gl_FragColor = vec4(uPulseColor * g, g);
		return;
	}
	float along = vUv.x * uRouteTotal;                       // world units along the route
	// looking through the tube: brightest where we look straight into the fluid (the centre line)
	float facing = abs(dot(normalize(vNormalV), normalize(vViewV)));
	float centre = pow(facing, 1.6);
	// slow, low-frequency circulation + finer strands, both drifting down the tube
	float f1 = texture2D(tNoise, vec2(along * 0.05 - uTime * uFlowSpeed, vUv.y * 0.35 + 0.1)).r;
	float f2 = texture2D(tNoise, vec2(along * 0.18 - uTime * uFlowSpeed * 1.8, vUv.y * 0.8 + 0.6)).g;
	float flow = 1.0 + uNoiseStrength * ((f1 - 0.5) * 1.4 + (f2 - 0.5) * 0.8);
	float base = uBaseEmission * flow;
	// the signal packet: soft edges, slightly clotted by the same noise
	float dp = (along - uPulsePos) / uPulseLength;
	float pulse = exp(-dp * dp) * (0.75 + 0.5 * f2) * uPulseStrength;
	// hot tip while the route is being drawn
	float tip = smoothstep(uRouteProgress - uTipLength / uRouteTotal, uRouteProgress, vUv.x) * uTipStrength;
	vec3 col = uFluidColor * base * (0.45 + 0.55 * centre) + uPulseColor * pulse * (0.6 + 0.4 * centre) + uTipColor * tip;
	float a = clamp(base * 0.9 * (0.5 + 0.5 * centre) + pulse * 0.8 + tip * 0.8, 0.0, 1.0);
	// soft fade at the very end of the revealed length so the tube does not end in a hard cap
	a *= smoothstep(uRouteProgress, uRouteProgress - 0.004, vUv.x);
	gl_FragColor = vec4(col, a);
}`;

import { createGlassFilter } from './glass.js';

export function createDescent({ scene, camera, mountain, pivot, resolution, labelRoot, noise, envMap }) {
	const probe = new TerrainProbe(mountain, pivot);
	const occluder = probe.buildProxyMesh();   // ~5k triangles, raycast-only
	occluder.updateMatrixWorld(true);

	/* --- route samples ------------------------------------------------ */
	const ctrl = cfg.route.map((p) => new THREE.Vector3(p.az, p.y, 0));
	const curve2d = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal', 0.5);
	const N = cfg.samples;
	const points = [];
	const cum = new Float32Array(N);
	const tmp = new THREE.Vector3();
	for (let i = 0; i < N; i++) {
		const c = curve2d.getPoint(i / (N - 1), tmp);
		const p = probe.point(c.x, c.y, cfg.hover);
		points.push(p.clone());
		cum[i] = i === 0 ? 0 : cum[i - 1] + p.distanceTo(points[i - 1]);
	}
	const total = cum[N - 1];
	// route-length parameter u of every named control point
	const anchorU = {};
	cfg.route.forEach((p, i) => {
		if (!p.name) return;
		const idx = Math.round((i / (cfg.route.length - 1)) * (N - 1));
		anchorU[p.name] = cum[idx] / total;
	});
	const resolveU = (u) => {
		if (typeof u === 'number') return u;
		const m = /^([A-Z_0-9]+)([+-][0-9.]+)?$/.exec(u);
		if (!m || !(m[1] in anchorU)) throw new Error(`descent timing: unknown anchor "${u}"`);
		return THREE.MathUtils.clamp(anchorU[m[1]] + (m[2] ? parseFloat(m[2]) : 0), 0, 1);
	};
	const timingKeys = cfg.timing.map((k) => [k.t, resolveU(k.u)]);

	/* --- line objects --------------------------------------------------- */
	const flat = new Float32Array(N * 3);
	points.forEach((p, i) => { flat[i * 3] = p.x; flat[i * 3 + 1] = p.y; flat[i * 3 + 2] = p.z; });
	const geometry = new LineGeometry();
	geometry.setPositions(flat);
	routeUniforms.uRouteTotal.value = total;

	const st = cfg.style.route;
	const routeMat = makeRouteMaterial({ color: st.color, opacity: st.opacity, widthPx: st.widthPx, resolution, tipAmount: 1 });
	const glowMat = makeRouteMaterial({ color: st.glowColor, opacity: st.glowOpacity, widthPx: st.glowWidthPx, resolution, tipAmount: 0.6, softness: st.glowSoftness ?? 0 });
	glowMat.blending = THREE.AdditiveBlending;
	// the dark casing under the core (normal blending, no tip colour) — what keeps the route
	// readable on snow. It shares the core's resolution vector, so resize() keeps it in step.
	const casingMat = makeRouteMaterial({ color: st.casingColor ?? 0x0b0f1e, opacity: st.casingOpacity ?? 0.6, widthPx: st.casingWidthPx ?? 6, resolution, tipAmount: 0 });
	casingMat.uniforms.resolution.value = routeMat.uniforms.resolution.value;
	const routeLine = new Line2(geometry, routeMat);
	const glowLine = new Line2(geometry, glowMat);
	const casingLine = new Line2(geometry, casingMat);
	[casingLine, glowLine, routeLine].forEach((l) => { l.computeLineDistances(); l.frustumCulled = false; l.renderOrder = 0; });
	casingLine.renderOrder = -1;
	glowLine.renderOrder = -0.5;
	const group = new THREE.Group();
	group.name = 'DescentRoute';
	group.add(casingLine, glowLine, routeLine);

	/* --- fluid conduit (default) --------------------------------------- */
	const conduit = { uniforms: null, shell: null, fluid: null, pulseClock: 0 };
	if (cfg.style.routeMode === 'conduit') {
		const cc = cfg.style.conduit;
		[casingLine, glowLine, routeLine].forEach((l) => { l.visible = false; });
		// same points → arc-length parametrised tube, so uv.x == route-length fraction (the reveal parameter)
		const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
		const segs = N - 1;
		const shellGeo = new THREE.TubeGeometry(curve, segs, cc.tubeOuterRadius, cc.radialSegments, false);
		const fluidGeo = new THREE.TubeGeometry(curve, segs, cc.tubeInnerRadius, cc.radialSegments, false);

		// outer shell: clear polymer — reflections from the scene environment, faint cold tint,
		// reveal via the same route-length parameter (discard beyond the drawn length)
		const shellMat = new THREE.MeshPhysicalMaterial({
			color: cc.tubeShellTint, transparent: true, opacity: cc.tubeShellOpacity,
			roughness: cc.shellRoughness, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1,
			envMap: envMap ?? null, envMapIntensity: cc.shellEnvIntensity,
			depthWrite: false, side: THREE.FrontSide,
		});
		shellMat.onBeforeCompile = (shader) => {
			shader.uniforms.uRouteProgress = routeUniforms.uRouteProgress;
			shader.vertexShader = shader.vertexShader
				.replace('#include <common>', '#include <common>\nvarying float vRouteU;')
				.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRouteU = uv.x;');
			shader.fragmentShader = shader.fragmentShader
				.replace('#include <common>', '#include <common>\nvarying float vRouteU;\nuniform float uRouteProgress;')
				.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vRouteU > uRouteProgress) discard;');
		};
		conduit.uniforms = {
			tNoise: { value: noise },
			uTime: { value: 0 },
			uRouteProgress: routeUniforms.uRouteProgress,
			uRouteTotal: routeUniforms.uRouteTotal,
			uFlowSpeed: { value: cc.fluidFlowSpeed },
			uNoiseStrength: { value: cc.fluidNoiseStrength },
			uBaseEmission: { value: cc.fluidBaseEmission },
			uPulsePos: { value: -1e3 },
			uPulseLength: { value: cc.pulseLength },
			uPulseStrength: { value: cc.pulseStrength },
			uTipLength: { value: st.tipLength },
			uTipStrength: { value: cc.tipStrength },
			uHalo: { value: 0 },
			uFluidColor: { value: new THREE.Color(cc.fluidColor) },
			uPulseColor: { value: new THREE.Color(cc.pulseColor) },
			uTipColor: { value: new THREE.Color(st.tipColor) },
		};
		const fluidMat = new THREE.ShaderMaterial({
			vertexShader: fluidVertex, fragmentShader: fluidFragment, uniforms: conduit.uniforms,
			transparent: true, depthWrite: false, depthTest: true, side: THREE.FrontSide,
		});
		conduit.fluid = new THREE.Mesh(fluidGeo, fluidMat);
		conduit.shell = new THREE.Mesh(shellGeo, shellMat);
		conduit.fluid.renderOrder = 0;
		conduit.shell.renderOrder = 0.1;
		conduit.fluid.frustumCulled = conduit.shell.frustumCulled = false;
		conduit.fluid.name = 'RouteFluid'; conduit.shell.name = 'RouteShell';
		group.add(conduit.fluid, conduit.shell);
		if (cc.haloRadius > 0) {
			const haloGeo = new THREE.TubeGeometry(curve, Math.round(segs / 2), cc.haloRadius, 8, false);
			const haloMat = new THREE.ShaderMaterial({
				vertexShader: fluidVertex, fragmentShader: fluidFragment,
				uniforms: { ...conduit.uniforms, uHalo: { value: cc.haloStrength } },
				transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
			});
			conduit.halo = new THREE.Mesh(haloGeo, haloMat);
			conduit.halo.renderOrder = -0.2;
			conduit.halo.frustumCulled = false;
			conduit.halo.name = 'RouteHalo';
			group.add(conduit.halo);
		}
	}

	/* --- markers + callouts ------------------------------------------------ */
	const ms = cfg.style.marker;
	const SVG_NS = 'http://www.w3.org/2000/svg';
	// the reference's 12-unit glyphs (aan test 4 / index2)
	const ICONS = {
		database: '<ellipse cx="6" cy="2.6" rx="4.2" ry="1.7"/><path d="M1.8 2.6v3.1c0 .94 1.88 1.7 4.2 1.7s4.2-.76 4.2-1.7V2.6"/><path d="M1.8 5.9v3.1c0 .94 1.88 1.7 4.2 1.7s4.2-.76 4.2-1.7V5.9"/>',
		scan: '<path d="M1 3.4V1.6h1.9M10.4 3.4V1.6H8.5M1 8.6v1.8h1.9M10.4 8.6v1.8H8.5"/><path d="M1 6h9.4"/><circle cx="5.7" cy="6" r="1.5"/>',
		nodes: '<circle cx="2.2" cy="9.4" r="1.4"/><circle cx="6" cy="4" r="1.4"/><circle cx="9.8" cy="8.2" r="1.4"/><path d="M3.3 8.5 4.9 5M7.1 4.8 8.9 7.2"/>',
	};
	/** Anchor dot + angular leader + reading. Copy goes in as text nodes, never as markup. */
	function buildCallout(stop) {
		const root = document.createElement('div');
		root.className = `callout callout--${stop.register || 'reading'}`;

		const lead = document.createElementNS(SVG_NS, 'svg');
		lead.setAttribute('class', 'callout__lead');
		lead.setAttribute('width', '1');
		lead.setAttribute('height', '1');
		lead.setAttribute('aria-hidden', 'true');
		// the leader's stroke: 0 % at the anchor → 100 % at the reading (end point updated per frame)
		const defs = document.createElementNS(SVG_NS, 'defs');
		const grad = document.createElementNS(SVG_NS, 'linearGradient');
		const gradId = `callout-lead-${stop.id}`;
		grad.setAttribute('id', gradId);
		grad.setAttribute('gradientUnits', 'userSpaceOnUse');
		grad.setAttribute('x1', '0');
		grad.setAttribute('y1', '0');
		grad.setAttribute('x2', '1');
		grad.setAttribute('y2', '0');
		[[0, 0], [1, 1]].forEach(([offset, opacity]) => {
			const gs = document.createElementNS(SVG_NS, 'stop');
			gs.setAttribute('offset', String(offset));
			gs.setAttribute('stop-color', '#00ECFF');
			gs.setAttribute('stop-opacity', String(opacity));
			grad.appendChild(gs);
		});
		defs.appendChild(grad);
		const line = document.createElementNS(SVG_NS, 'path');
		line.setAttribute('class', 'callout__line');
		line.setAttribute('stroke', `url(#${gradId})`);
		lead.append(defs, line);

		const dot = document.createElement('span');
		dot.className = 'callout__anchor';
		dot.setAttribute('aria-hidden', 'true');

		const plane = document.createElement('div');
		plane.className = 'callout__in';
		// the glass plate: its refraction filter is sized to the plate in placeCallout (measure)
		const gc = cfg.style.callout?.glass;
		const glass = gc?.enabled ? createGlassFilter({ id: `glass-${stop.id}`, root: labelRoot, ...gc }) : null;
		if (glass) {
			plane.classList.add('callout__in--glass');
		}
		const title = document.createElement('p');
		title.className = 'callout__k';
		title.innerHTML = `<svg class="ico" viewBox="0 0 12 12" aria-hidden="true" focusable="false">${ICONS[stop.icon] ?? ''}</svg>`;
		title.append(stop.title);
		plane.appendChild(title);
		const desc = (stop.lines ?? []).map((text) => {
			const p = document.createElement('p');
			p.className = 'callout__s';
			p.textContent = text;
			plane.appendChild(p);
			return p;
		});

		root.append(lead, dot, plane);
		return { root, line, grad, dot, plane, desc, glass, length: 0, pathD: '' };
	}

	const stops = cfg.stops.map((s) => {
		const cp = cfg.route.find((p) => p.name === s.anchor);
		if (!cp) throw new Error(`descent: stop anchor "${s.anchor}" not in route`);
		const position = probe.point(cp.az, cp.y, cfg.hover * 2.2);
		const material = new THREE.ShaderMaterial({
			vertexShader: markerVertex,
			fragmentShader: markerFragment,
			uniforms: {
				uResolution: { value: resolution },
				uSizePx: { value: ms.sizePx },
				uScale: { value: ms.scaleFrom },
				uColor: { value: new THREE.Color(ms.color) },
				uActivation: { value: 0 },
				uRingRadius: { value: ms.ringRadius },
				uRingWidth: { value: ms.ringWidth },
				uCoreRadius: { value: ms.coreRadius },
				uHalo: { value: ms.haloStrength },
			},
			transparent: true, depthWrite: false, depthTest: true,
		});
		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
		mesh.position.copy(position);
		mesh.frustumCulled = false;
		mesh.renderOrder = 0;
		mesh.visible = ms.show !== false;
		group.add(mesh);

		const callout = buildCallout(s);
		labelRoot.appendChild(callout.root);

		return {
			...s, u: anchorU[s.anchor], position, mesh, material, ...callout,
			planeWidth: 0,
			activation: 0,
			reveal: 0,     // 0..1 route-driven unfold (dot → leader → plane → lines)
			seen: 0,       // 0..1 damped on-screen and not occluded
			visible: 1,
		};
	});

	/* --- debug ------------------------------------------------------------ */
	const debugGroup = new THREE.Group();
	debugGroup.visible = false;
	{
		const onTop = (m) => { m.depthTest = false; m.depthWrite = false; m.transparent = true; return m; };
		const sph = new THREE.SphereGeometry(0.9, 10, 8);
		cfg.route.forEach((p) => {
			const m = new THREE.Mesh(sph, onTop(new THREE.MeshBasicMaterial({ color: p.name ? 0xff3fa0 : 0xffcc00 })));
			probe.point(p.az, p.y, cfg.hover, m.position);
			debugGroup.add(m);
		});
		const full = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), onTop(new THREE.LineBasicMaterial({ color: 0x00e5ff })));
		debugGroup.add(full);
		debugGroup.traverse((o) => { o.renderOrder = 101; });
	}

	/* --- runtime state ------------------------------------------------------ */
	const state = {
		progress: 0,           // smoothed 0..1
		u: 0,                  // route draw parameter
		angleDeg: 0, zoom: 1, lookDrop: 0, camDrop: 0,
		follow: 0,             // look-at blend toward the tip
		tip: new THREE.Vector3(),
	};
	// position along the route at parameter u (route-length based)
	function pointAt(u, target) {
		const d = THREE.MathUtils.clamp(u, 0, 1) * total;
		let lo = 0, hi = N - 1;
		while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
		const span = cum[hi] - cum[lo] || 1;
		return target.copy(points[lo]).lerp(points[hi], (d - cum[lo]) / span);
	}
	const raycaster = new THREE.Raycaster();
	const proj = new THREE.Vector3();
	let frame = 0;

	/* Callout unfold, in the reference's order: the anchor lights, the leader draws
	   out, then the reading turns in from edge-on and its lines resolve. One 0..1
	   `reveal` drives all of it, so a stopped scroll is a stopped frame. */
	const co = cfg.style.callout ?? {};
	const gap = co.gapPx ?? 14.4;
	const minRun = co.minRunPx ?? 24;
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const phase = (a, from, to) => THREE.MathUtils.clamp((a - from) / (to - from), 0, 1);
	const measureCallouts = () => stops.forEach((s) => { s.planeWidth = 0; });
	document.fonts?.ready.then(measureCallouts);

	function setLeader(s, knee, end) {
		const d = `M0 0 L${knee[0].toFixed(1)} ${knee[1].toFixed(1)} L${end[0].toFixed(1)} ${end[1].toFixed(1)}`;
		if (d === s.pathD) return;
		s.pathD = d;
		s.line.setAttribute('d', d);
		// the gradient runs along the leader: 0 % at the anchor, 100 % where it meets the reading
		s.grad.setAttribute('x2', end[0].toFixed(1));
		s.grad.setAttribute('y2', end[1].toFixed(1));
		s.length = Math.hypot(knee[0], knee[1]) + Math.hypot(end[0] - knee[0], end[1] - knee[1]);
		s.line.style.strokeDasharray = `${s.length.toFixed(1)}`;
	}

	/* The reading holds still in its slot (fractions of the viewport); only the leader
	   tracks the anchor: a diagonal of about 45° off the anchor, then a horizontal run
	   into the reading's near edge. */
	function placeCallout(s, x, y, w, h) {
		const narrow = w <= (co.narrowPx ?? 992);
		if (s.narrow !== narrow) { s.narrow = narrow; s.planeWidth = 0; }
		if (!s.planeWidth) {
			s.planeWidth = s.plane.offsetWidth;
			if (s.glass) {
				// refraction map at the plate's size; the plain blur in route.css stays the fallback where url() is refused
				s.glass.fit(s.plane.offsetWidth, s.plane.offsetHeight);
				s.plane.style.backdropFilter = `${s.glass.css} saturate(1.25) brightness(1.04)`;
			}
		}
		const [fx, fy, ground = 'sky'] = narrow ? s.slot.narrow : s.slot.wide;
		if (ground !== s.renderedGround) {
			// sky → light ink, lit cloud → dark ink; the leader's gradient takes the same ink (from route.css)
			s.root.classList.toggle('callout--on-cloud', ground === 'cloud');
			const ink = getComputedStyle(labelRoot).getPropertyValue(ground === 'cloud' ? '--ink-deep' : '--cyan').trim() || '#00ECFF';
			s.grad.querySelectorAll('stop').forEach((g) => g.setAttribute('stop-color', ink));
			s.renderedGround = ground;
		}
		const cx = fx * w, cy = fy * h;
		const left = x >= cx;                                    // reading left of its anchor → right-aligned, hinged on its right edge
		const sign = left ? -1 : 1;
		const edgeX = cx - sign * s.planeWidth / 2;              // the edge the leader reaches
		const endX = edgeX - sign * gap;
		const rise = cy - y;
		// the knee: ~45° off the anchor, never closer than minRun to the reading's edge. When the
		// anchor itself has less than minRun of room outside that edge, a knee would have to loop
		// past the edge and come back, so the leader runs straight from the anchor to its end.
		const room = (endX - x) * sign;                          // > 0: the anchor is outside the edge it connects to
		let kneeX = x + sign * Math.abs(rise);
		if (left ? kneeX < endX + minRun : kneeX > endX - minRun) kneeX = endX - sign * minRun;
		if (room < minRun) kneeX = endX;
		setLeader(s, [kneeX - x, rise], [endX - x, rise]);
		if (left !== s.renderedLeft) {
			s.root.classList.toggle('callout--left', left);
			s.renderedLeft = left;
		}
		s.root.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
		return { left, px: edgeX - x, py: rise };
	}

	function paintCallout(s, { left, px, py }) {
		const still = reducedMotion.matches;          // reduced motion: no turn, no draw-on — present or not
		const a = still ? (s.reveal > 0.5 ? 1 : 0) : s.reveal;
		const dotP = still ? a : phase(a, 0, 0.15);
		const lineP = still ? 1 : phase(a, 0.08, 0.4);
		const planeP = still ? a : phase(a, 0.35, 0.8);
		const descP = still ? a : phase(a, 0.62, 0.9);
		const e = 1 - Math.pow(1 - planeP, 3);        // power3.out, as in the reference
		const turn = still ? 0 : 1 - e;
		const sign = left ? -1 : 1;

		s.dot.style.opacity = dotP.toFixed(3);
		s.dot.style.transform = `scale(${still ? 1 : dotP.toFixed(3)})`;
		s.line.style.strokeDashoffset = (s.length * (1 - lineP)).toFixed(2);

		s.plane.style.transformOrigin = left ? 'right center' : 'left center';
		// the hand-turned swing: a rotateY about the reading's own centre (the unfold keeps its hinge
		// on the edge), pushed back a little with the angle so it reads as a plane in the scene's space
		const swing = state.swing ?? 0;
		const half = sign * s.planeWidth / 2;
		s.plane.style.transform =
			`translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(${left ? '-100%' : '0'}, -50%) perspective(1000px) ` +
			`translateX(${half.toFixed(1)}px) rotateY(${swing.toFixed(2)}deg) translateZ(${(-Math.abs(swing) * 1.2).toFixed(1)}px) translateX(${(-half).toFixed(1)}px) ` +
			`translateX(${(-5 * sign * turn).toFixed(2)}px) rotateY(${(75 * sign * turn).toFixed(2)}deg) ` +
			`scaleX(${(1 - 0.2 * turn).toFixed(3)}) translateZ(${(-55 * turn).toFixed(1)}px)`;
		s.plane.style.opacity = planeP > 0 ? (still ? a : 0.45 + 0.55 * e).toFixed(3) : '0';
		s.plane.style.filter = turn > 0.001 ? `blur(${(1.5 * turn).toFixed(2)}px)` : 'none';
		const descO = descP.toFixed(3);
		s.desc.forEach((d) => { d.style.opacity = descO; });
	}

	function update(progress, dt, cam, spin = 0) {
		state.progress = progress;
		// turn the mountain by hand and the readings swing like planes in the same space: a rotateY
		// in perspective that follows the orbit's angular velocity (the camera orbiting +θ turns the
		// scene −θ in view), capped, and settles back to face the viewer when the mountain stops
		const swingMax = co.swingMaxDeg ?? 28;
		const swingTarget = reducedMotion.matches ? 0 : THREE.MathUtils.clamp(-spin * (co.swingPerRadPerSec ?? 12), -swingMax, swingMax);
		state.swing = THREE.MathUtils.damp(state.swing ?? 0, swingTarget, co.swingDamp ?? 6, dt);
		state.u = linearKeys(timingKeys, progress);
		routeUniforms.uRouteProgress.value = state.u;

		// fluid: time-driven inside whatever length is revealed; the pulse runs the whole route
		// (through hidden sections too), then rests for `pulsePause` units before the next one
		if (conduit.uniforms) {
			const cc = cfg.style.conduit;
			const u = conduit.uniforms;
			u.uTime.value += dt;
			conduit.pulseClock += dt * cc.pulseSpeed;
			const cycle = total + cc.pulsePause + 2 * cc.pulseLength;
			u.uPulsePos.value = (conduit.pulseClock % cycle) - cc.pulseLength;
		}

		const c = cfg.camera;
		state.angleDeg = smoothKeys(c.angleDeg, progress);
		state.zoom = smoothKeys(c.zoom, progress);
		state.lookDrop = smoothKeys(c.lookDrop, progress);
		state.camDrop = smoothKeys(c.camDrop, progress);
		state.follow = c.followTip ? smoothKeys(c.followTip, progress) : 0;
		pointAt(state.u, state.tip);
		state.tip.y += c.followTipLift ?? 0;

		frame++;
		const w = window.innerWidth, h = window.innerHeight;
		const rv = cfg.stopReveal;
		stops.forEach((s, i) => {
			s.activation = THREE.MathUtils.smoothstep(state.u, s.u - rv.before, s.u + rv.after);
			const labelA = THREE.MathUtils.smoothstep(state.u, s.u - rv.before + rv.labelDelay, s.u + rv.after + rv.labelDelay);
			s.material.uniforms.uActivation.value = s.activation;
			s.material.uniforms.uScale.value = ms.scaleFrom + (1 - ms.scaleFrom) * s.activation;

			// occlusion: throttled raycast camera → marker against the mountain
			if (s.activation > 0 && frame % 3 === i % 3) {
				const dir = s.position.clone().sub(cam.position);
				const dist = dir.length();
				raycaster.set(cam.position, dir.normalize());
				raycaster.far = dist - 0.5;
				const hit = raycaster.intersectObject(occluder, false);
				s.visible = hit.length ? 0 : 1;
			}
			// projection
			proj.copy(s.position).project(cam);
			const onScreen = proj.z < 1 && Math.abs(proj.x) < 1.05 && Math.abs(proj.y) < 1.05;
			s.seen = THREE.MathUtils.damp(s.seen, onScreen ? s.visible : 0, 8, dt);
			s.reveal = THREE.MathUtils.damp(s.reveal, labelA, 10, dt);
			const shown = s.reveal > 0.002 ? s.seen : 0;
			s.root.style.opacity = shown.toFixed(3);
			if (shown === 0) return; // nothing to lay out while it is not there
			const x = (proj.x * 0.5 + 0.5) * w, y = (-proj.y * 0.5 + 0.5) * h;
			paintCallout(s, placeCallout(s, x, y, w, h));
		});
	}

	function resize(res) {
		routeMat.resolution.copy(res);
		glowMat.resolution.copy(res);
		stops.forEach((s) => { s.material.uniforms.uResolution.value = res; });
		measureCallouts(); // max-width and the hidden sentence change with the viewport
	}

	return { group, debugGroup, state, stops, probe, occluder, points, total, anchorU, update, resize, timingKeys, pointAt, conduit };
}
