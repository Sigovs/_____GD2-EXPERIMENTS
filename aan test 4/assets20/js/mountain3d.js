/* =========================================================================
   GD2 — the mountain in 3D, and the route drawn ON it (index3 only)

   Two movements, one camera:
     INTRO   ~22° about the mountain's vertical axis, once, on load.
     SCROLL  a further ~14° across the pin.
   No tilt in either: pitch is identical at both ends, so the horizon of the
   model never rocks and it reads as walking around a mountain rather than
   tipping an object.

   THE ROUTE IS GEOMETRY, NOT AN OVERLAY. The old SVG was authored in
   percentages of a flat plate; on terrain that turns it would slide off the
   slope within a degree. Here the summit is found by raycasting, every point
   of the descent takes its height from the surface below it, and the line is
   a real object in the scene — so it stays welded to the rock no matter where
   the camera goes. The readouts are HTML, positioned each frame by projecting
   their anchor point through the camera.

   Unlit: the scan carries baked light and ships no normals.
   ====================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

/* Per-page configuration. index3 and index4 are the same build shown against
   two different mountains, so the model and its resting pose are the only
   things that differ — set window.M3D before this module loads. */
const CFG = Object.assign({
  model: 'assets20/models/mountain-web.glb',
  rest:  { yaw: 104.5, pitch: 4, dist: 1.28, fov: 35, tx: 0.24, ty: 0.02 },
  openYaw: -22, scrollYaw: 14,
  /* the descent: how far it reaches, how far it wraps, and where on screen it
     is asked to finish (0..1 of the frame) */
  reach: 0.46, startBearing: 56, sweep: -58,
  /* where the near-ground plate starts eating the frame, as a fraction
     of the hero's height — nothing is annotated below it */
  groundLine: 0.70,
}, window.M3D || {});

const MODEL = CFG.model;

const REST = { ...CFG.rest };
const OPEN = { yaw: REST.yaw + CFG.openYaw, pitch: REST.pitch, dist: REST.dist * 1.10,
               fov: REST.fov, tx: REST.tx, ty: REST.ty };
const SCROLL_YAW  = CFG.scrollYaw;
const SCROLL_DIST = -0.04;
const INTRO_MS    = 2600;

/* the route finishes drawing at this much of the pin — the hero's own phase A,
   so the descent still ends before the landscape starts to move */
const DRAW_UNTIL = 0.55;

/* where the readouts sit along the line, and what they say */
/* dx/dy nudge a reading clear of whatever the terrain puts behind it. The
   first one sits on the apex, whose lit snow is the brightest pixel in the
   frame, so it steps right until the measurement clears 4.5:1. */
const STOPS = [
  { at: 0.00, dx: 40, dy: -4, k: 'Signal 001',      s: '600M+ consumer profiles, updated daily' },
  { at: 0.40, dx: 0,  dy: 0,  k: 'Signal detected', s: 'Every visit begins with a trace.' },
  { at: 0.78, dx: 0,  dy: 0,  k: 'Profile built',   s: 'Anonymous activity becomes actionable insight.' },
];

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root  = document.documentElement;
const hero  = document.querySelector('.hero');
const plate = document.querySelector('.hero__plate');

if (!plate || !hero || !window.WebGLRenderingContext) {
  root.setAttribute('data-m3d', 'off');
} else {
  root.setAttribute('data-m3d', reduced ? 'still' : 'intro');
  build().catch(err => { console.warn('[mountain3d]', err); root.setAttribute('data-m3d', 'off'); });
}

async function build() {
  const canvas = document.createElement('canvas');
  canvas.className = 'm3d';
  canvas.setAttribute('aria-hidden', 'true');
  plate.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearAlpha(0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(REST.fov, 1, 0.01, 100);

  const gltf = await new GLTFLoader().loadAsync(MODEL);
  const model = gltf.scene;
  model.traverse(o => {
    if (!o.isMesh) return;
    const src = o.material;
    o.material = new THREE.MeshBasicMaterial({ map: src.map || null, toneMapped: false });
    if (src.map) src.map.colorSpace = THREE.SRGBColorSpace;
    o.frustumCulled = false;
  });
  /* ---- normalise, so one set of camera numbers fits any mountain --------
     The two models arrive at wildly different scales — one is ~1 unit across,
     the other ~16 — and a camera distance that frames one puts the camera
     inside the other. Every model is scaled so its larger horizontal side is
     exactly 1 and its centre sits at the origin. After this the pose constants
     mean the same thing on every page. */
  scene.add(model);
  model.updateMatrixWorld(true);
  {
    const b = new THREE.Box3().setFromObject(model);
    const sz = b.getSize(new THREE.Vector3());
    const c  = b.getCenter(new THREE.Vector3());
    const k  = 1 / Math.max(sz.x, sz.z);
    model.scale.setScalar(k);
    model.position.set(-c.x * k, -c.y * k, -c.z * k);
    model.updateMatrixWorld(true);
  }

  const box = new THREE.Box3().setFromObject(model);
  const ctr = box.getCenter(new THREE.Vector3());

  /* ---- the terrain, as a height grid ---------------------------------
     The obvious way to sit a line on a surface is to raycast down onto it.
     It is also unusable here: ~950 rays against 188k triangles with no BVH is
     ~180 million triangle tests, and it cost ELEVEN SECONDS before the first
     frame. Measured, not guessed — the download took 24ms.

     So the surface is asked once instead of a thousand times: a single pass
     over the vertices fills a 2D grid of maximum heights, and every later
     query is an array lookup. Same answer, ~40ms. */
  const G = 288;
  const gh = new Float32Array(G * G).fill(-Infinity);
  {
    const v = new THREE.Vector3();
    const spanX = box.max.x - box.min.x, spanZ = box.max.z - box.min.z;
    model.traverse(o => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position, mw = o.matrixWorld;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mw);
        let ix = ((v.x - box.min.x) / spanX * (G - 1)) | 0;
        let iz = ((v.z - box.min.z) / spanZ * (G - 1)) | 0;
        if (ix < 0) ix = 0; else if (ix > G - 1) ix = G - 1;
        if (iz < 0) iz = 0; else if (iz > G - 1) iz = G - 1;
        const k = iz * G + ix;
        if (v.y > gh[k]) gh[k] = v.y;
      }
    });
    /* a coarse grid over a dense mesh leaves no holes, but a sparse one can —
       one dilation pass so a lookup never lands on emptiness */
    for (let k = 0; k < gh.length; k++) {
      if (gh[k] !== -Infinity) continue;
      const x = k % G, z = (k / G) | 0;
      let best = -Infinity;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= G || nz >= G) continue;
        const w = gh[nz * G + nx];
        if (w > best) best = w;
      }
      gh[k] = best;
    }
  }
  /* Bilinear, not nearest. Nearest snaps consecutive path points to cell
     centres and the descent comes out as a staircase — visible in the first
     render and the reason this is interpolated. */
  const SPX = box.max.x - box.min.x, SPZ = box.max.z - box.min.z;
  const cell = (ix, iz) => {
    if (ix < 0) ix = 0; else if (ix > G - 1) ix = G - 1;
    if (iz < 0) iz = 0; else if (iz > G - 1) iz = G - 1;
    return gh[iz * G + ix];
  };
  const surfaceY = (x, z) => {
    const fx = (x - box.min.x) / SPX * (G - 1);
    const fz = (z - box.min.z) / SPZ * (G - 1);
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz;
    const a = cell(ix, iz),     b = cell(ix + 1, iz);
    const c = cell(ix, iz + 1), d = cell(ix + 1, iz + 1);
    if (a === -Infinity || b === -Infinity || c === -Infinity || d === -Infinity) return null;
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  };

  /* Is a point behind the mountain from a given eye? Marched against the same
     height grid, so it costs nothing — and it is what lets the route be judged
     for how much of itself it hides before a bearing is even chosen. */
  const hiddenFromPos = (c, p) => {
    for (let i = 3; i < 42; i++) {
      const s = i / 42;
      const gx = c.x + (p.x - c.x) * s, gz = c.z + (p.z - c.z) * s;
      const gy = c.y + (p.y - c.y) * s;
      const g = surfaceY(gx, gz);
      if (g !== null && g > gy + 0.006) return true;
    }
    return false;
  };

  let summit = { y: -Infinity, x: ctr.x, z: ctr.z };
  {
    const spanX = box.max.x - box.min.x, spanZ = box.max.z - box.min.z;
    for (let k = 0; k < gh.length; k++) {
      if (gh[k] <= summit.y) continue;
      summit = { y: gh[k],
                 x: box.min.x + (k % G) / (G - 1) * spanX,
                 z: box.min.z + ((k / G) | 0) / (G - 1) * spanZ };
    }
  }

  /* ---- the descent, around the form ----------------------------------
     A straight run out from the summit reads flat: it stays on one face and
     never meets anything that could hide it. This one SWEEPS around the
     mountain's own axis while it drops, so it wraps the cone — which means
     part of it is on the far side, genuinely behind rock, and the reader
     loses the line and finds it again lower down. That is depth stated by
     occlusion rather than by drawing.

     The line is barely lifted off the surface (LIFT) so ridges in front of it
     do the hiding for free, through the depth buffer. */
  const _r0 = plate.getBoundingClientRect();
  const W0 = _r0.width || 1440, H0 = _r0.height || 900;

  const SWEEP = CFG.sweep;            /* degrees of wrap; negative sweeps toward the lens */
  const REACH = (box.max.x - box.min.x) * CFG.reach;
  const LIFT  = 0.0022;
  const easeP = t => t * t * (3 - 2 * t);

  const buildPts = (theta0) => {
    const out = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const th = (theta0 + SWEEP * easeP(t)) * Math.PI / 180;
      const r  = REACH * Math.pow(t, 0.82);
      const x = summit.x + Math.sin(th) * r;
      const z = summit.z + Math.cos(th) * r;
      const y = surfaceY(x, z);
      if (y === null) continue;
      out.push(new THREE.Vector3(x, y + LIFT, z));
    }
    return out;
  };

  /* Where the descent runs is set RELATIVE TO THE CAMERA, not searched for.

     A bearing equal to the camera's own yaw points straight at the lens — that
     is the middle of the silhouette. Ninety degrees off it is the edge. So the
     descent starts about 55° round the visible face and sweeps back to the
     camera bearing: it crosses the front of the mountain diagonally, dips
     behind whatever ridges stand in the way, and arrives low and near the
     centre of the frame instead of sliding off the side.

     Judged at the yaw the camera reaches once the route is fully drawn, since
     that is when the composition has to hold. */
  const camYaw = REST.yaw + SCROLL_YAW * 0.62;
  const theta0 = camYaw + CFG.startBearing;
  const pts = buildPts(theta0);
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35);
  const dense = curve.getPoints(360);

  const flat = [];
  for (const p of dense) flat.push(p.x, p.y, p.z);
  const lineGeo = new LineGeometry();
  lineGeo.setPositions(flat);

  const lineMat = new LineMaterial({
    color: 0x00ECFF, linewidth: 1.9, transparent: true, opacity: 0.95,
    dashed: true, dashSize: 0, gapSize: 1e3,
    depthTest: true,          /* the rock in front of it does the hiding */
  });
  const line = new Line2(lineGeo, lineMat);
  line.computeLineDistances();
  line.frustumCulled = false;
  line.renderOrder = 2;
  scene.add(line);
  const routeLen = curve.getLength();
  const hiddenFrom = (p) => hiddenFromPos(camera.position, p);


  /* ---- the readouts, as HTML on the page ------------------------------ */
  const marks = document.createElement('div');
  marks.className = 'm3d-marks';
  hero.appendChild(marks);
  const stops = STOPS.map(st => {
    const el = document.createElement('div');
    el.className = 'm3d-stop';
    el.innerHTML =
      `<span class="m3d-dot"></span>` +
      `<div class="m3d-say"><p class="annot__k">${st.k}</p><p class="annot__s">${st.s}</p></div>`;
    marks.appendChild(el);
    const say = el.querySelector('.m3d-say');
    if (st.dx || st.dy) {
      say.style.transform = `translate(${st.dx || 0}px, calc(-.35em + ${st.dy || 0}px))`;
    }
    return { ...st, el, p: curve.getPointAt(st.at) };
  });

  const place = (p) => {
    camera.fov = p.fov; camera.updateProjectionMatrix();
    const yaw = p.yaw * Math.PI / 180, pitch = p.pitch * Math.PI / 180;
    camera.position.set(
      ctr.x + p.dist * Math.cos(pitch) * Math.sin(yaw),
      ctr.y + p.dist * Math.sin(pitch),
      ctr.z + p.dist * Math.cos(pitch) * Math.cos(yaw));
    camera.lookAt(ctr.x + p.tx, ctr.y + p.ty, ctr.z);
  };

  let W = 0, H = 0, dirty = true;
  const size = () => {
    const r = plate.getBoundingClientRect();
    W = r.width; H = r.height;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    lineMat.resolution.set(W * renderer.getPixelRatio(), H * renderer.getPixelRatio());
    dirty = true;
  };
  size();
  addEventListener('resize', size, { passive: true });

  let scrollP = 0;
  const readScroll = () => {
    const st = window.ScrollTrigger && ScrollTrigger.getAll().find(t => t.pin);
    const p = st ? st.progress : 0;
    if (Math.abs(p - scrollP) > 0.0004) { scrollP = p; dirty = true; }
  };
  addEventListener('scroll', readScroll, { passive: true });

  const at = (t, s) => ({
    yaw:   OPEN.yaw  + (REST.yaw  - OPEN.yaw)  * t + SCROLL_YAW  * s,
    pitch: REST.pitch,
    dist:  OPEN.dist + (REST.dist - OPEN.dist) * t + SCROLL_DIST * s,
    fov:   REST.fov, tx: REST.tx, ty: REST.ty,
  });
  const ease = t => (t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2);

  const v = new THREE.Vector3();
  const project = (p3) => {
    v.copy(p3).project(camera);
    return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, z: v.z };
  };

  window.__setPose = (o) => { Object.assign(REST, o); dirty = true; };
  window.__m3d = { frames: 0, settled: reduced, t0: performance.now(),
                   summit: summit, routeLen };

  let introT = reduced ? 1 : 0;
  const t0 = performance.now();
  if (reduced) root.setAttribute('data-m3d', 'ready');

  const loop = (now) => {
    if (introT < 1) {
      introT = Math.min(1, (now - t0) / INTRO_MS);
      dirty = true;
      if (introT >= 1) {
        root.setAttribute('data-m3d', 'ready');
        window.__m3d.settled = true; window.__m3d.settledAt = now;
      }
    }
    if (dirty) {
      place(at(ease(introT), scrollP));

      /* the line draws with the reader: one dash that grows, one gap that
         never ends — the same idea as the SVG's stroke-dashoffset, in 3D */
      const drawn = introT < 1 ? 0 : Math.min(1, scrollP / DRAW_UNTIL);
      lineMat.dashSize = routeLen * drawn;
      lineMat.gapSize  = routeLen * 2;

      renderer.render(scene, camera);

      for (const st of stops) {
        const s = project(st.p);
        /* a reading never enters the reading column, and never outlives the
           piece of line it belongs to */
        /* A reading is on screen only while ALL of this holds:
           — its piece of line has been drawn;
           — that piece is not behind rock (marched on the height grid);
           — it is out of the reading column;
           — it is above the near ground. Those rocks are a 2D plate, not
             geometry, so the depth buffer cannot hide anything behind them;
             the frame line has to be stated instead;
           — and the descent's own phase is still running. Once the landscape
             starts moving the route is over, and a reading that outlives it
             hangs in a scene that has already left. */
        const on = drawn >= st.at + 0.02
                && !hiddenFrom(st.p)
                && s.x > W * 0.44
                && s.y < H * CFG.groundLine
                && scrollP < DRAW_UNTIL + 0.06;
        /* the container rides the anchor exactly; only the reading is nudged,
           so the dot never leaves the route it is marking */
        st.el.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)`;
        st.el.style.opacity = on ? '1' : '0';
      }
      window.__m3d.frames++;
      window.__m3d.drawn = drawn;
      dirty = false;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
