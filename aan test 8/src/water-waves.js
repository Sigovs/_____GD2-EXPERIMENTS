/*
 * water-waves.js — the water answers the cursor with rings: a wave simulation over the water film.
 *
 * A height field (two half-float textures, ping-pong) runs the 2-D wave equation each frame —
 * every texel becomes the mean of its four neighbours minus what it was a step ago, damped — the
 * scheme that has drawn water on screens since the nineties. The cursor drops into it: a move
 * adds a small gaussian where it is (deeper the faster it moves), a press a large one. The rings
 * spread, cross, reflect off the frame's edges and die.
 *
 * The picture: the water film's canvas is sampled through the field — each pixel looks through the
 * water's slope (the height's gradient), so the frame bends inside the rings the way a photograph
 * bends under real ripples — and the crests catch a thin light from above. Where the field is
 * flat the frame is untouched, so the layer can sit over the film at the film's own opacity.
 *
 * The SURFACE (after the "water-ripple-image" shader Alex found, 18 Sep): on top of the rings the
 * water itself is never still — a field of rotating sines (ten octaves) and a simplex drift bend
 * the frame a little all the time, and the same field is the light: moving caustic streaks, a touch
 * blue, strongest near the surface and gone with depth. Both distortions land in one sample.
 *
 * Needs WebGL2 with float render targets; without them it declines (returns enabled: false) and the
 * soft SVG lens (water-ripple.js) stays. Fine pointers only for the rings; the surface runs for every
 * pointer; off under reduced motion (the surface holds one frame); asleep when the water is not on
 * the page.
 */

export const WATER_WAVES = {
	enabled: true,
	simWidth: 384,              // the field's width in texels (height follows the viewport's aspect)
	steps: 2,                   // simulation steps per frame: the rings' speed
	damping: 0.99,              // per step: how long a ring lives
	refract: 0.05,              // uv units of bend at a slope of 1 — the strength of the lens (Alex, 18 Sep: "очень сильные, сбавь" → "меньше" → "less" → "lessss")
	highlight: 0.25,            // the crest's light (soft-limited in the shader)
	stretch: 2.2,               // the rings' horizontal reach over their vertical — a surface seen at an angle (Alex: "более горизонтальные")
	drop: { move: [0.08, 0.2], press: 0.45, radius: [0.016, 0.028], spacing: 26, minGap: 50, speedFull: 700 },   // move: [min, max] depth by cursor speed; radius in uv of the width; spacing: px and minGap: ms between drops
	still: 0.01,                // below this remaining drop energy the field counts as still (the rings' part rests)
	/* the ambient surface (the demo's gentle values): scale of the sine field, the light's strength and
	   blueness, how far the surface and the drift bend the frame, the clock's speed, and the depth
	   (scene progress) over which the light goes out */
	surface: { scale: 7, illumination: 0.15, blueish: 0.4, distortion: 0.03, drift: 0.02, speed: 0.002, depthFade: [0.62, 0.9] },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (v, a, b) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const VERT = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

// the field: r = height now, g = height a step ago
const SIM = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uField; uniform vec2 uTexel; uniform float uDamp;
uniform float uStretch;                      // the wave runs this much faster along x than along y
uniform int uDrops; uniform vec3 uDrop[8];   // x, y (uv), depth; radius in w below
uniform float uDropR[8];
void main() {
	vec2 c = texture(uField, vUv).rg;
	float n = texture(uField, vUv + vec2(0.0, uTexel.y)).r;
	float s = texture(uField, vUv - vec2(0.0, uTexel.y)).r;
	float e = texture(uField, vUv + vec2(uTexel.x, 0.0)).r;
	float w = texture(uField, vUv - vec2(uTexel.x, 0.0)).r;
	// anisotropic: the horizontal neighbours weigh more, so a ring becomes a lying ellipse
	// (weights sum to 1 — the scheme's stability is the isotropic one's)
	float kx = uStretch * uStretch / (1.0 + uStretch * uStretch), ky = 1.0 - kx;
	float h = kx * (e + w) + ky * (n + s) - c.g;
	h *= uDamp;
	for (int i = 0; i < 8; i++) {
		if (i >= uDrops) break;
		vec2 d = (vUv - uDrop[i].xy); d.y *= uTexel.x / uTexel.y;   // round in screen space…
		d.x /= uStretch;                                             // …then the drop itself lies along x
		float r = uDropR[i];
		h -= uDrop[i].z * exp(-dot(d, d) / (r * r));
	}
	// the frame's edge: a wall (the border texels hold zero)
	if (vUv.x < uTexel.x || vUv.x > 1.0 - uTexel.x || vUv.y < uTexel.y || vUv.y > 1.0 - uTexel.y) h = 0.0;
	o = vec4(h, c.r, 0.0, 1.0);
}`;

const DRAW = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uFilmA, uFilmB, uField; uniform float uMix;   // the two frames the film is crossfading, and how far
uniform vec2 uCoverA, uCoverB;                                  // object-fit: cover — the share of each image the viewport sees
uniform vec2 uTexel; uniform float uRefract, uHighlight, uAspect;
uniform float uTime, uScale, uIllum, uBlueish, uSurfDist, uDrift;   // the ambient surface
vec3 film(sampler2D t, vec2 cover, vec2 uv) { return texture(t, 0.5 + (uv - 0.5) * cover).rgb; }

// simplex noise (Ashima / Ian McEwan), as the found shader carries it
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v) {
	const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
	vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx);
	vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
	vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
	i = mod289(i);
	vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
	vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0); m = m * m; m = m * m;
	vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
	m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
	vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
	return 130.0 * dot(m, g);
}
mat2 rot(float r) { return mat2(cos(r), sin(r), -sin(r), cos(r)); }
// the surface: ten rotating sine octaves — the found shader's field, unchanged
float surface(vec2 uv, float t, float scale) {
	vec2 n = vec2(0.1), N = vec2(0.1); mat2 m = rot(0.5);
	for (int j = 0; j < 10; j++) {
		uv *= m; n *= m;
		vec2 q = uv * scale + float(j) + n + (0.5 + 0.5 * float(j)) * (mod(float(j), 2.0) - 1.0) * t;
		n += sin(q); N += cos(q) / scale; scale *= 1.2;
	}
	return N.x + N.y + 0.1;
}
void main() {
	float e = texture(uField, vUv + vec2(uTexel.x, 0.0)).r, w = texture(uField, vUv - vec2(uTexel.x, 0.0)).r;
	float n = texture(uField, vUv + vec2(0.0, uTexel.y)).r, s = texture(uField, vUv - vec2(0.0, uTexel.y)).r;
	vec2 grad = vec2(e - w, n - s);
	// the ambient surface: a slow drift field and the sine surface, stronger toward the top (the light's side)
	float t = uTime;
	vec2 suv = vec2(vUv.x * uAspect, vUv.y);
	float outer = snoise((0.3 + 0.1 * sin(t)) * suv + vec2(0.0, 0.2 * t));
	float surf = surface(2.0 * suv + outer * 0.2, t, uScale);
	surf *= pow(vUv.y, 0.3);
	surf = surf * surf;
	vec2 uv = vUv + grad * uRefract * vec2(1.0, uAspect) + uDrift * outer + uSurfDist * surf;
	uv = clamp(uv, vec2(0.001), vec2(0.999));
	vec3 col = film(uFilmA, uCoverA, uv);
	if (uMix > 0.001) col = mix(col, film(uFilmB, uCoverB, uv), uMix);
	// the surface's light: the frame lifted where the light runs, and the light itself, a touch blue
	col *= 1.0 + uIllum * surf;
	col += uIllum * vec3(1.0 - uBlueish, 1.0, 1.0) * surf;
	// the crest's light: a slope facing up-left catches it, the far slope loses a little — soft-limited, never white
	float lit = clamp((grad.x * -0.6 + grad.y * 1.0) * 12.0, -1.0, 1.0);
	col += uHighlight * 0.32 * smoothstep(0.0, 1.0, lit) * vec3(0.85, 0.95, 1.0);
	col *= 1.0 - uHighlight * 0.22 * smoothstep(0.0, 1.0, -lit);
	o = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
	const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
	if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
	return sh;
}
function program(gl, vs, fs) {
	const p = gl.createProgram(); gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
	if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
	return p;
}

export function createWaterWaves({ canvas, film, cfg = WATER_WAVES }) {
	const off = { enabled: false, setPresence() {} };
	const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;   // the rings want a mouse; the surface runs anywhere
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (!cfg.enabled || !canvas || !film) return off;
	const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false });
	if (!gl || !gl.getExtension('EXT_color_buffer_float')) return off;
	const linear = gl.getExtension('OES_texture_float_linear');   // half-float linear filtering is core in WebGL2

	let sim, draw;
	try { sim = program(gl, VERT, SIM); draw = program(gl, VERT, DRAW); } catch (e) { console.warn('water-waves:', e.message); return off; }
	const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
	for (const p of [sim, draw]) { const a = gl.getAttribLocation(p, 'aPos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); }
	const U = (p, n) => gl.getUniformLocation(p, n);
	const u = {
		sim: { field: U(sim, 'uField'), texel: U(sim, 'uTexel'), damp: U(sim, 'uDamp'), stretch: U(sim, 'uStretch'), drops: U(sim, 'uDrops'), drop: U(sim, 'uDrop'), dropR: U(sim, 'uDropR') },
		draw: { filmA: U(draw, 'uFilmA'), filmB: U(draw, 'uFilmB'), mix: U(draw, 'uMix'), coverA: U(draw, 'uCoverA'), coverB: U(draw, 'uCoverB'), field: U(draw, 'uField'), texel: U(draw, 'uTexel'), refract: U(draw, 'uRefract'), highlight: U(draw, 'uHighlight'), aspect: U(draw, 'uAspect'),
			time: U(draw, 'uTime'), scale: U(draw, 'uScale'), illum: U(draw, 'uIllum'), blueish: U(draw, 'uBlueish'), surfDist: U(draw, 'uSurfDist'), drift: U(draw, 'uDrift') },
	};

	// the field: two half-float RG textures with framebuffers
	let SW = 0, SH = 0, fields = [], fbs = [], cur = 0;
	function makeField(w, h) {
		const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, w, h, 0, gl.RG, gl.HALF_FLOAT, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
		gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
		return { t, fb };
	}
	// the film: the two decoded frames the film is crossfading (film-frames.js → pair), as two textures.
	// An <img> uploads on the fast path — no read-back of the 2-D canvas — and only the frame that changed
	// is sent: as the scroll walks, the new B usually is the old A's neighbour, so the textures roll over.
	function makeTex() {
		const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		return { t, img: null, cover: [1, 1] };
	}
	let texA = makeTex(), texB = makeTex(), mixT = 0;
	function coverOf(img) {
		// the share of the image the viewport shows under object-fit: cover, about its centre
		const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
		const sc = Math.max(W / iw, H / ih);
		return [W / (iw * sc), H / (ih * sc)];
	}
	function put(tex, img) {
		if (tex.img === img) return;
		gl.bindTexture(gl.TEXTURE_2D, tex.t);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		tex.img = img; tex.cover = coverOf(img);
	}
	function uploadFilm() {
		const pr = film.pair; if (!pr) return;
		if (texA.img !== pr.a && texB.img === pr.a) { const s = texA; texA = texB; texB = s; }   // roll over
		put(texA, pr.a);
		if (pr.b) put(texB, pr.b);
		mixT = pr.b ? pr.t : 0;
		if (texA.img) { texA.cover = coverOf(texA.img); if (texB.img) texB.cover = coverOf(texB.img); }
	}

	let W = 1, H = 1;
	function resize() {
		W = window.innerWidth; H = window.innerHeight;
		const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
		canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
		SW = cfg.simWidth; SH = Math.max(16, Math.round(SW * H / W));
		for (const f of fields) { gl.deleteTexture(f.t); gl.deleteFramebuffer(f.fb); }
		fields = [makeField(SW, SH), makeField(SW, SH)];
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}
	window.addEventListener('resize', resize); resize();

	// the cursor's drops
	const pending = [];
	let lastP = null, lastT = 0, since = 0, lastDrop = 0;
	const toUv = (x, y) => [x / W, 1 - y / H];
	if (fine) window.addEventListener('pointermove', (e) => {
		const now = performance.now();
		if (lastP) {
			const dx = e.clientX - lastP[0], dy = e.clientY - lastP[1], dist = Math.hypot(dx, dy);
			since += dist;
			if (since >= cfg.drop.spacing && now - lastDrop >= cfg.drop.minGap) {
				since = 0; lastDrop = now;
				const dt = Math.max(0.008, (now - lastT) / 1000), speed = clamp(dist / dt / cfg.drop.speedFull, 0, 1);
				const [x, y] = toUv(e.clientX, e.clientY);
				pending.push([x, y, cfg.drop.move[0] + (cfg.drop.move[1] - cfg.drop.move[0]) * speed, cfg.drop.radius[0] + (cfg.drop.radius[1] - cfg.drop.radius[0]) * speed]);
			}
		}
		lastP = [e.clientX, e.clientY]; lastT = now;
	}, { passive: true });
	if (fine) window.addEventListener('pointerdown', (e) => { const [x, y] = toUv(e.clientX, e.clientY); pending.push([x, y, cfg.drop.press, cfg.drop.radius[1] * 1.3]); }, { passive: true });

	let presence = 0, depth = 0, awake = 0, raf = 0, quiet = 0;
	const dropBuf = new Float32Array(24), dropR = new Float32Array(8);
	function step() {
		gl.useProgram(sim); gl.bindVertexArray(vao);
		gl.viewport(0, 0, SW, SH);
		gl.uniform2f(u.sim.texel, 1 / SW, 1 / SH); gl.uniform1f(u.sim.damp, cfg.damping); gl.uniform1f(u.sim.stretch, cfg.stretch);
		for (let s = 0; s < cfg.steps; s++) {
			const n = Math.min(8, pending.length);
			energy *= cfg.damping;
			for (let i = 0; i < n; i++) { const d = pending[i]; dropBuf[i * 3] = d[0]; dropBuf[i * 3 + 1] = d[1]; dropBuf[i * 3 + 2] = d[2]; dropR[i] = d[3]; energy += d[2]; }
			gl.uniform1i(u.sim.drops, n); gl.uniform3fv(u.sim.drop, dropBuf); gl.uniform1fv(u.sim.dropR, dropR);
			pending.splice(0, n);
			const src = fields[cur], dst = fields[1 - cur];
			gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
			gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform1i(u.sim.field, 0);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			cur = 1 - cur;
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}
	function render() {
		gl.useProgram(draw); gl.bindVertexArray(vao);
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA.t); gl.uniform1i(u.draw.filmA, 0);
		gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB.t); gl.uniform1i(u.draw.filmB, 1);
		gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, fields[cur].t); gl.uniform1i(u.draw.field, 2);
		gl.uniform1f(u.draw.mix, mixT); gl.uniform2f(u.draw.coverA, texA.cover[0], texA.cover[1]); gl.uniform2f(u.draw.coverB, texB.cover[0], texB.cover[1]);
		gl.uniform2f(u.draw.texel, 1 / SW, 1 / SH);
		gl.uniform1f(u.draw.refract, cfg.refract); gl.uniform1f(u.draw.highlight, cfg.highlight); gl.uniform1f(u.draw.aspect, W / H);
		const sf = cfg.surface, deep = 1 - smooth(depth, sf.depthFade[0], sf.depthFade[1]);
		gl.uniform1f(u.draw.time, reduced ? 0 : performance.now() * sf.speed); gl.uniform1f(u.draw.scale, sf.scale);
		gl.uniform1f(u.draw.illum, sf.illumination * deep); gl.uniform1f(u.draw.blueish, sf.blueish);
		gl.uniform1f(u.draw.surfDist, sf.distortion); gl.uniform1f(u.draw.drift, sf.drift);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}
	// is the field still? no read-back (a GPU stall): the energy the drops put in, decayed as the field decays
	let energy = 0;
	function stillness() { return energy; }

	// the layer draws the film itself, so it only shows once the water is fully on the page (opacity 1):
	// during the hand-over two copies at the same partial opacity would add up
	const ON = 0.985;
	let tick = 0;
	function frame() {
		raf = 0;
		if (presence < ON) { canvas.style.visibility = 'hidden'; awake = 0; return; }
		tick++;
		uploadFilm();   // only what changed goes up
		step();
		render();
		canvas.style.visibility = 'visible';
		// the surface never rests, so the layer runs while the water is on the page; under reduced motion the
		// surface holds one frame and the layer sleeps once the rings are still
		if (reduced) {
			if (tick % 20 === 0 && !pending.length) quiet = energy < cfg.still ? quiet + 1 : 0; else if (pending.length) quiet = 0;
			if (quiet >= 3) { awake = 0; quiet = 0; return; }
		}
		raf = requestAnimationFrame(frame);
	}
	function wake() { if (!raf && presence >= ON) { awake = 1; raf = requestAnimationFrame(frame); } }
	if (fine) { window.addEventListener('pointermove', wake, { passive: true }); window.addEventListener('pointerdown', wake, { passive: true }); }

	return {
		enabled: true, cfg,
		debug() { return { energy, pending: pending.length, raf: !!raf, presence, glError: gl.getError(), sim: [SW, SH], tick }; },
		setPresence(p, P = depth) {
			presence = clamp(p, 0, 1); depth = clamp(P, 0, 1);
			if (presence >= ON) wake();
			if (presence < ON && raf) { cancelAnimationFrame(raf); raf = 0; canvas.style.visibility = 'hidden'; }
		},
	};
}
