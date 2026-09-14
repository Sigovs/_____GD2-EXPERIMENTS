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
 *  Line2 (×2)     : route + soft glow, one geometry each. The draw-on, tip colour and
 *                   tip fade are uniforms injected into LineMaterial (progress in route
 *                   length via vLineDistance) — nothing is rebuilt per frame.
 *  Markers (×3)   : billboard quads with a tiny core / thin ring / halo shader,
 *                   depth-tested against the mountain like the line.
 *  Labels (×3)    : DOM, projected from the marker world positions every frame,
 *                   hidden when occluded (throttled raycast) or off-screen.
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

function makeRouteMaterial({ color, opacity, widthPx, resolution, tip }) {
	const mat = new LineMaterial({
		color, opacity, linewidth: widthPx, transparent: true, depthWrite: false,
		worldUnits: false, dashed: true, dashSize: 1e6, gapSize: 0,
		polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
		alphaToCoverage: false,
	});
	mat.resolution.copy(resolution);
	mat.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, routeUniforms);
		shader.fragmentShader = shader.fragmentShader
			.replace('uniform float opacity;', `uniform float opacity;
uniform float uRouteProgress, uRouteTotal, uRouteTipLength, uRouteTipMix;
uniform vec3 uRouteTipColor;`)
			.replace('gl_FragColor = vec4( diffuseColor.rgb, alpha );', `
float routeT = vLineDistance / uRouteTotal;
if (routeT > uRouteProgress) discard;
float tipW = uRouteTipLength / uRouteTotal;
float tip = smoothstep(uRouteProgress - tipW, uRouteProgress, routeT);
float endFade = smoothstep(uRouteProgress, uRouteProgress - tipW * 0.35, routeT);
vec3 routeRgb = mix(diffuseColor.rgb, uRouteTipColor, tip * uRouteTipMix * ${tip ? '1.0' : '0.6'});
gl_FragColor = vec4(routeRgb, alpha * endFade);`);
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

export function createDescent({ scene, camera, mountain, pivot, resolution, labelRoot }) {
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
	const routeMat = makeRouteMaterial({ color: st.color, opacity: st.opacity, widthPx: st.widthPx, resolution, tip: true });
	const glowMat = makeRouteMaterial({ color: st.glowColor, opacity: st.glowOpacity, widthPx: st.glowWidthPx, resolution, tip: false });
	glowMat.blending = THREE.AdditiveBlending;
	const routeLine = new Line2(geometry, routeMat);
	const glowLine = new Line2(geometry, glowMat);
	[routeLine, glowLine].forEach((l) => { l.computeLineDistances(); l.frustumCulled = false; l.renderOrder = 0; });
	glowLine.renderOrder = -0.5;
	const group = new THREE.Group();
	group.name = 'DescentRoute';
	group.add(glowLine, routeLine);

	/* --- markers + labels ------------------------------------------------ */
	const ms = cfg.style.marker;
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
		group.add(mesh);

		const el = document.createElement('div');
		el.className = `route-label route-label--${s.labelSide || 'right'}`;
		el.innerHTML = `<span class="route-label__leader"></span><span class="route-label__text"><span class="route-label__id">${s.label}</span><span class="route-label__sub">${s.sub}</span></span>`;
		labelRoot.appendChild(el);

		return { ...s, u: anchorU[s.anchor], position, mesh, material, el, activation: 0, labelAlpha: 0, visible: 1 };
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

	function update(progress, dt, cam) {
		state.progress = progress;
		state.u = linearKeys(timingKeys, progress);
		routeUniforms.uRouteProgress.value = state.u;

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
			const target = onScreen ? labelA * s.visible : 0;
			s.labelAlpha = THREE.MathUtils.damp(s.labelAlpha, target, 8, dt);
			const x = (proj.x * 0.5 + 0.5) * w, y = (-proj.y * 0.5 + 0.5) * h;
			s.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
			s.el.style.opacity = s.labelAlpha.toFixed(3);
			s.el.style.setProperty('--leader', (s.labelAlpha).toFixed(3));
		});
	}

	function resize(res) {
		routeMat.resolution.copy(res);
		glowMat.resolution.copy(res);
		stops.forEach((s) => { s.material.uniforms.uResolution.value = res; });
	}

	return { group, debugGroup, state, stops, probe, occluder, points, total, anchorU, update, resize, timingKeys, pointAt };
}
