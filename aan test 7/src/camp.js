import * as THREE from 'three';

/*
 * camp.js — the expedition camp at STOP_02 (values: camp-config.js).
 *
 *  Tent      : procedural proxy dome + vestibule (or a GLB), with a soft contact shadow on the
 *              slope. Drops from dropHeight into place on a back-ease with a tiny settle.
 *  Campfire  : three crossed additive flame cards with scrolling noise, a faint warm halo,
 *              two dark logs. Ignites after the landing; flickers while lit.
 *  Puff      : a ring of a dozen soft powder points, alive for a sliver of scroll at the landing.
 *  Light     : the fire's warmth reaches the mountain through uCampLight* uniforms injected into
 *              the mountain material (the scene's materials are custom shaders — three.js lights
 *              would not reach them). Range-limited; the rest of the mountain stays cold.
 *
 * Nothing runs on its own: update(progress) derives every state from scroll progress, so the
 * whole sequence reverses with the scroll. Under prefers-reduced-motion the tent fades in place,
 * there is no puff, and the fire does not flicker.
 */

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const span = (t, a, b) => clamp01((t - a) / (b - a));
const smooth = (x) => x * x * (3 - 2 * x);
const easeOutBack = (x, k) => { const k3 = k + 1; return 1 + k3 * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2); };
const DEG = THREE.MathUtils.degToRad;

/* the mountain's own distance haze, reproduced so the props sit in the same air */
const HAZE_GLSL = /* glsl */ `
float campViewZ(float fragZ, float near, float far) { return (near * far) / ((far - near) * fragZ - far); }
float campDepth(float fragZ, float near, float far) { float vz = campViewZ(fragZ, near, far); return (vz + near) / (near - far); }
`;

const propVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vWorld;
#ifdef CAMP_MAP
varying vec2 vUv;
#endif
void main() {
#ifdef CAMP_MAP
	vUv = uv;
#endif
	vec4 wp = modelMatrix * vec4(position, 1.);
	vWorld = wp.xyz;
	vN = normalize(mat3(modelMatrix) * normal);
	gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const propFragment = /* glsl */ `
uniform vec3 uColor, uLightColor, uFirePos, uFireColor, uLightDir;
uniform float uOpacity, uFire, uFireRange, uFogNear, uFogFar, uGlow;
varying vec3 vN;
varying vec3 vWorld;
#ifdef CAMP_MAP
uniform sampler2D tMap;
varying vec2 vUv;
#endif
${HAZE_GLSL}
void main() {
	vec3 n = normalize(vN);
	if (!gl_FrontFacing) n = -n;
	float hemi = 0.5 + 0.5 * n.y;
	// matched to the mountain's snow: a cool sky fill plus the mountain's baked key light, so the props sit in the same exposure
	vec3 ambient = mix(vec3(0.16, 0.18, 0.24), vec3(0.52, 0.57, 0.68), hemi);
	ambient += vec3(0.95, 0.97, 1.0) * max(dot(n, normalize(uLightDir)), 0.) * 0.75;
	vec3 L = uFirePos - vWorld;
	float d = length(L);
	float fire = uFire * max(dot(n, L / max(d, 1e-3)), 0.) * pow(clamp(1. - d / uFireRange, 0., 1.), 2.);
	vec3 albedo = uColor;
#ifdef CAMP_MAP
	albedo *= texture2D(tMap, vUv).rgb;
#endif
	vec3 col = albedo * (ambient + uFireColor * fire + uGlow);   // uGlow: lit from inside, as in 3D_ASSETS/tent/tent.png
	float haze = smoothstep(0.01, .3, campDepth(gl_FragCoord.z, uFogNear, uFogFar));
	col = mix(col, uLightColor, haze);
	gl_FragColor = vec4(col, uOpacity);
	gl_FragColor = linearToOutputTexel(gl_FragColor);
}`;

const shadowFragment = /* glsl */ `
uniform float uOpacity;
varying vec2 vUv;
void main() {
	float r = length(vUv - 0.5) * 2.;
	float a = smoothstep(1., 0.15, r) * uOpacity;
	gl_FragColor = vec4(0.01, 0.012, 0.02, a);
}`;
const uvVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

const flameFragment = /* glsl */ `
uniform sampler2D tNoise;
uniform float uTime, uFire, uSeed;
varying vec2 vUv;
void main() {
	vec2 uv = vUv;
	float n = texture2D(tNoise, vec2(uv.x * 0.7 + uSeed, uv.y * 0.55 - uTime * 1.25)).r;
	float hw = mix(0.46, 0.04, uv.y);                                     // half-width, narrowing to a tip
	float x = abs(uv.x - 0.5 + (n - 0.5) * 0.22 * uv.y);
	float body = smoothstep(hw, hw * 0.25, x);
	body *= smoothstep(1.0, 0.3, uv.y + (n - 0.5) * 0.4) * smoothstep(0.0, 0.1, uv.y);
	float core = smoothstep(0.35, 0.95, body) * (1. - uv.y);
	// opaque-blended, not additive: added light vanishes against the moonlit snow the camp sits on
	vec3 col = mix(vec3(0.85, 0.16, 0.02), vec3(1.0, 0.6, 0.2), core);
	gl_FragColor = vec4(col, clamp(body * 1.3, 0., 1.) * uFire);
	gl_FragColor = linearToOutputTexel(gl_FragColor);
}`;

const haloVertex = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = uv;
	vec4 mv = modelViewMatrix * vec4(0., 0., 0., 1.);
	mv.xy += position.xy;                                                 // camera-facing card
	gl_Position = projectionMatrix * mv;
}`;
const haloFragment = /* glsl */ `
uniform float uFire;
uniform vec3 uFireColor;
varying vec2 vUv;
void main() {
	float r = length(vUv - 0.5) * 2.;
	float a = exp(-r * r * 5.) * uFire * 0.22;
	gl_FragColor = vec4(uFireColor * a, 1.);
	gl_FragColor = linearToOutputTexel(gl_FragColor);
}`;

const puffVertex = /* glsl */ `
attribute float aAngle, aSeed;
uniform float uPuff, uRadius, uRise, uSize, uPxScale;
varying float vSeed;
void main() {
	vSeed = aSeed;
	float grow = 1. - pow(1. - uPuff, 3.);
	float r = mix(0.35, uRadius, grow) * (0.7 + 0.3 * aSeed);
	vec3 p = vec3(cos(aAngle) * r, uRise * grow * (0.4 + 0.6 * aSeed), sin(aAngle) * r);
	vec4 mv = modelViewMatrix * vec4(p, 1.);
	gl_Position = projectionMatrix * mv;
	gl_PointSize = uSize * uPxScale / -mv.z * (0.6 + 0.6 * grow);
}`;
const puffFragment = /* glsl */ `
uniform float uPuff;
uniform vec3 uLightColor;
varying float vSeed;
void main() {
	float d = length(gl_PointCoord - 0.5) * 2.;
	float a = smoothstep(1., 0., d) * (1. - uPuff) * smoothstep(0., 0.15, uPuff) * 0.32;
	vec3 col = mix(vec3(0.62, 0.68, 0.76), uLightColor, 0.35);
	gl_FragColor = vec4(col, a);
	gl_FragColor = linearToOutputTexel(gl_FragColor);
}`;

/** A low proxy expedition dome: faceted half-ellipsoid body + a sloping vestibule on +z. */
function buildProxyTent(t, bodyMat, flyMat) {
	const g = new THREE.Group();
	const dome = new THREE.SphereGeometry(1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2);
	dome.scale(t.width / 2, t.height, t.depth / 2);
	const body = new THREE.Mesh(dome.toNonIndexed(), bodyMat);
	body.geometry.computeVertexNormals();
	g.add(body);

	const hw = t.width * 0.3, z0 = t.depth * 0.36, top = t.height * 0.72, tip = t.depth * 0.36 + t.depth * 0.45;
	const v = new Float32Array([
		-hw, 0, z0,   0, top, z0,   0, 0, tip,    // left panel
		0, top, z0,   hw, 0, z0,    0, 0, tip,    // right panel
	]);
	const vest = new THREE.BufferGeometry();
	vest.setAttribute('position', new THREE.BufferAttribute(v, 3));
	vest.computeVertexNormals();
	g.add(new THREE.Mesh(vest, flyMat));
	return g;
}

export function createCamp({ mountain, gd2Material, camera, noise, resolution, time, lightColor, fogNear, fogFar, reducedMotion, config: c }) {
	const group = new THREE.Group();
	group.name = 'ExpeditionCamp';

	/* --- ground: height and normal from the mountain itself --- */
	const ray = new THREE.Raycaster();
	const down = new THREE.Vector3(0, -1, 0);
	const normalMatrix = new THREE.Matrix3();
	mountain.updateMatrixWorld(true);
	normalMatrix.getNormalMatrix(mountain.matrixWorld);
	function ground(x, z, fallbackY) {
		ray.set(new THREE.Vector3(x, fallbackY + 40, z), down);
		ray.far = 120;
		const hit = ray.intersectObject(mountain, false)[0];
		if (!hit) return { point: new THREE.Vector3(x, fallbackY, z), normal: new THREE.Vector3(0, 1, 0) };
		return { point: hit.point.clone(), normal: hit.face.normal.clone().applyMatrix3(normalMatrix).normalize() };
	}
	const base = ground(c.position[0], c.position[2], c.position[1]);
	group.position.copy(base.point);
	/* --- fire position: on this slope a fixed offset lands on another level (it fell 4.6 units), so the fire
	       takes the most level spot at fire.distance around the tent, on the side the camera sees at STOP_02 --- */
	const view = new THREE.Vector2(c.viewFrom[0] - base.point.x, c.viewFrom[2] - base.point.z).normalize();
	let best = null;
	for (let i = 0; i < 32; i++) {
		const a = (i / 32) * Math.PI * 2;
		const dx = Math.cos(a), dz = Math.sin(a);
		const g = ground(base.point.x + dx * c.fire.distance, base.point.z + dz * c.fire.distance, base.point.y);
		const score = Math.abs(g.point.y - base.point.y) + (1 - g.normal.y) * 2 + Math.max(0, -(dx * view.x + dz * view.y)) * 1.5;
		if (!best || score < best.score) best = { score, g, dx, dz };
	}
	const firePos = best.g.point.clone();
	const yaw = Math.atan2(best.dx, best.dz) + DEG(c.rotationY);   // the vestibule (+z) turned toward the fire
	const firePosUp = firePos.clone().add(new THREE.Vector3(0, c.fire.height * 0.45, 0));   // the light sits in the flames

	/* --- shared uniforms --- */
	const fireUniform = { value: 0 };
	const fireColor = new THREE.Color(c.light.color);
	const common = {
		uLightColor: lightColor, uFogNear: fogNear, uFogFar: fogFar, uLightDir: gd2Material.uniforms.uLightDir,
		uFirePos: { value: firePosUp }, uFireColor: { value: fireColor }, uFire: fireUniform, uFireRange: { value: c.light.range },
	};
	const propMaterial = (hex) => new THREE.ShaderMaterial({
		vertexShader: propVertex, fragmentShader: propFragment,
		uniforms: { ...common, uColor: { value: new THREE.Color(hex) }, uOpacity: { value: 1 }, uGlow: { value: 0 }, tMap: { value: null } },
		transparent: true, side: THREE.DoubleSide,
	});

	/* --- tent --- */
	const tentTilt = new THREE.Group();   // leans part-way into the slope; `sink` takes up the rest
	tentTilt.quaternion.slerpQuaternions(new THREE.Quaternion(), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), base.normal), c.tilt);
	group.add(tentTilt);
	const tentPivot = new THREE.Group();
	tentPivot.rotation.y = yaw;
	tentTilt.add(tentPivot);
	const bodyMat = propMaterial(c.tent.color);
	const flyMat = propMaterial(c.tent.flyColor);
	const tentMaterials = [bodyMat, flyMat];
	const glowMaterials = [bodyMat];
	if (c.tent.file) {
		import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader().loadAsync(c.tent.file)).then((gltf) => {
			const model = gltf.scene;
			// normalise: the larger footprint side to tent.width, centred, base on the ground
			const box = new THREE.Box3().setFromObject(model);
			const size = box.getSize(new THREE.Vector3());
			const k = c.tent.width / Math.max(size.x, size.z);
			model.scale.setScalar(k);
			model.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k, -(box.min.z + box.max.z) / 2 * k);
			const turn = new THREE.Group();
			turn.rotation.y = DEG(c.tent.modelYaw ?? 0);
			turn.add(model);
			tentMaterials.length = 0;
			glowMaterials.length = 0;
			model.traverse((o) => {
				if (!o.isMesh) return;
				const src = o.material;
				const tex = src.map || src.emissiveMap;   // "basic shaded" exports carry the colour texture in the emissive slot
				const mat = propMaterial(tex ? 0xffffff : c.tent.color);
				if (tex) { mat.uniforms.tMap.value = tex; mat.defines = { CAMP_MAP: '' }; }
				src.dispose();
				o.material = mat;
				tentMaterials.push(mat);
				glowMaterials.push(mat);
			});
			tentPivot.add(turn);
			update(lastProgress);
		}).catch((err) => { console.warn('[camp] tent GLB failed, using the proxy', err); tentPivot.add(buildProxyTent(c.tent, bodyMat, flyMat)); });
	} else {
		tentPivot.add(buildProxyTent(c.tent, bodyMat, flyMat));
	}

	/* --- contact shadow on the slope --- */
	const shadowMat = new THREE.ShaderMaterial({
		vertexShader: uvVertex, fragmentShader: shadowFragment, uniforms: { uOpacity: { value: 0 } },
		transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
	});
	const shadow = new THREE.Mesh(new THREE.PlaneGeometry(c.tent.width * 1.5, c.tent.depth * 1.5), shadowMat);
	shadow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), base.normal);
	shadow.position.copy(base.normal).multiplyScalar(0.05);
	group.add(shadow);

	/* --- fire --- */
	const fire = new THREE.Group();
	fire.position.copy(firePos).sub(base.point);
	group.add(fire);
	const flameGeo = new THREE.PlaneGeometry(c.fire.radius * 2, c.fire.height);
	flameGeo.translate(0, c.fire.height / 2, 0);
	[0, 60, 120].forEach((deg, i) => {
		const mat = new THREE.ShaderMaterial({
			vertexShader: uvVertex, fragmentShader: flameFragment,
			uniforms: { tNoise: { value: noise }, uTime: time, uFire: fireUniform, uSeed: { value: i * 0.37 } },
			transparent: true, depthWrite: false, side: THREE.DoubleSide,
		});
		const card = new THREE.Mesh(flameGeo, mat);
		card.rotation.y = DEG(deg);
		fire.add(card);
	});
	const halo = new THREE.Mesh(new THREE.PlaneGeometry(c.light.range * 0.45, c.light.range * 0.45), new THREE.ShaderMaterial({
		vertexShader: haloVertex, fragmentShader: haloFragment, uniforms: { uFire: fireUniform, uFireColor: { value: fireColor } },
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
	}));
	halo.position.y = c.fire.height * 0.4;
	halo.frustumCulled = false;
	fire.add(halo);
	const logMat = propMaterial(0x2a1c14);
	[35, -35].forEach((deg) => {
		const log = new THREE.Mesh(new THREE.BoxGeometry(c.fire.radius * 2.6, 0.07, 0.07), logMat);
		log.rotation.y = DEG(deg);
		log.position.y = 0.04;
		fire.add(log);
	});

	/* --- landing puff --- */
	const count = c.puff.count;
	const puffGeo = new THREE.BufferGeometry();
	const angles = new Float32Array(count), seeds = new Float32Array(count);
	for (let i = 0; i < count; i++) { angles[i] = (i / count) * Math.PI * 2 + Math.sin(i * 12.9898) * 0.3; seeds[i] = (Math.sin(i * 78.233) * 43758.5453) % 1 * 0.5 + 0.5; }
	puffGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
	puffGeo.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
	puffGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
	const puffUniforms = { uPuff: { value: 0 }, uRadius: { value: c.puff.radius }, uRise: { value: c.puff.rise }, uSize: { value: c.puff.size }, uPxScale: { value: 1 }, uLightColor: lightColor };
	const puff = new THREE.Points(puffGeo, new THREE.ShaderMaterial({
		vertexShader: puffVertex, fragmentShader: puffFragment, uniforms: puffUniforms, transparent: true, depthWrite: false,
	}));
	puff.frustumCulled = false;
	puff.visible = false;
	group.add(puff);

	/* --- the fire's warmth on the mountain --- */
	Object.assign(gd2Material.uniforms, {
		uCampLightPos: { value: firePosUp },
		uCampLightColor: { value: fireColor },
		uCampLight: { value: 0 },
		uCampLightRange: { value: c.light.range },
	});
	gd2Material.needsUpdate = true;

	group.visible = false;
	const state = { drop: 0, fire: 0 };
	const landT = c.revealStart + c.impact * (c.revealEnd - c.revealStart);   // scroll progress of the first ground contact

	/** Every state from scroll progress — forward and backward are the same function. */
	let lastProgress = 0;
	function update(progress) {
		lastProgress = progress;
		const still = reducedMotion?.matches;
		const drop = span(progress, c.revealStart, c.revealEnd);
		group.visible = drop > 0;
		state.drop = drop;

		// cartoon drop: stretch while falling, squash on contact, one hop, a last squash, rest
		let offset = 0, sy = 1;
		if (!still && c.dropHeight > 0) {
			if (drop < c.impact) {
				const x = drop / c.impact;
				offset = c.dropHeight * (1 - x * x);                   // gravity: accelerates into the snow
				sy = 1 + c.stretch * x;
			} else {
				const s = (drop - c.impact) / (1 - c.impact);          // after contact, 0..1
				const bump = (a, b) => Math.sin(Math.PI * span(s, a, b));
				offset = c.hop * bump(0.3, 0.72);
				sy = 1 - c.squash * bump(0, 0.3) + c.stretch * 0.5 * bump(0.3, 0.5) - c.squash * 0.33 * bump(0.72, 1);
			}
		}
		const sxz = 1 / Math.sqrt(sy);                                 // volume kept: squash spreads, stretch narrows
		const grow = still ? 1 : 0.55 + 0.45 * smooth(span(drop, 0, c.impact));
		tentPivot.position.y = offset - c.sink;
		tentPivot.scale.set(c.scale * grow * sxz, c.scale * grow * sy, c.scale * grow * sxz);
		const appear = smooth(span(drop, 0, still ? 1 : 0.3));
		tentMaterials.forEach((m) => { m.uniforms.uOpacity.value = appear; });
		// the contact shadow grows and darkens as the tent nears the snow
		const near = c.dropHeight > 0 ? 1 - Math.min(1, Math.max(0, offset) / c.dropHeight) : 1;
		shadowMat.uniforms.uOpacity.value = 0.6 * smooth(span(drop, still ? 0 : 0.05, still ? 1 : 0.5)) * (0.35 + 0.65 * near);
		shadow.scale.setScalar((0.45 + 0.55 * near) * sxz);

		const q = still ? 0 : span(progress, landT, landT + c.puff.window);
		puff.visible = q > 0 && q < 1;
		puffUniforms.uPuff.value = q;
		puffUniforms.uPxScale.value = camera.projectionMatrix.elements[5] * resolution.y * 0.5;

		const lit = smooth(span(progress, c.fireStart, c.fireEnd));
		state.fire = lit;
		const t = time.value;
		const flicker = still ? 1 : 0.86 + 0.14 * (0.5 * Math.sin(t * 13.1) + 0.3 * Math.sin(t * 7.3 + 1.7) + 0.2 * Math.sin(t * 23.7 + 0.4));
		fire.visible = lit > 0.001;
		fire.scale.setScalar(still ? 1 : Math.max(0.001, easeOutBack(span(progress, c.fireStart, c.fireEnd), c.firePop)));   // ignition pop
		fireUniform.value = lit * flicker;
		gd2Material.uniforms.uCampLight.value = c.light.intensity * lit * flicker;
		const glow = c.tent.glow * lit * (0.9 + 0.1 * flicker);   // the camp comes alive with the fire
		glowMaterials.forEach((m) => { m.uniforms.uGlow.value = glow; });
	}

	return { group, update, state, firePosition: firePos, groundNormal: base.normal };
}
