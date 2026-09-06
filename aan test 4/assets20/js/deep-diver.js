/* GD2 — scene 2, the diver.

   THREE LAYERS, NOT ONE STICKER
     video plate  →  the diver  →  water in front of him
   The last one is the point. A figure composited onto footage with nothing
   between them reads as a decal no matter how well it is lit, because the eye
   gets no evidence that there is water in the way. So a thin haze, a drift of
   slow motes and a bubble stream sit BETWEEN the camera and the body, and some
   of the motes cross in front of him.

   THE POSE IS BUILT FROM AXES, NOT FROM EULER ANGLES
   Guessing three angles produced a man lying on his back with a leg in the
   air. The attitude is now constructed: his head follows the path's own
   tangent, his belly faces the seabed, and his back is tipped toward the
   camera so the tank reads across the top of the silhouette. Those three
   statements are the rotation — there is nothing to tune by eye except how far
   the back is tipped.

   PERSPECTIVE, LONG LENS, FIXED DISTANCE
   26 degrees and no Z travel at all. The earlier orthographic build removed
   foreshortening entirely and the body went flat; the one before it flew the
   figure away from the camera and it read as a shrinking sticker. A long lens
   at a fixed distance keeps the volume and lets scale move only 6%.

   FOUR TRANSFORMS, FOUR OWNERS, NO SHARING
     trajectoryGroup      scroll: position along the S, and the shallow scale
     pointerOffsetGroup   pointer: a small damped offset around that base
     orientationGroup     pose: tangent attitude, drag
     gltf.scene           the Swim_Idle skeleton, on its own clock, forwards */

import * as THREE from 'three';
import { GLTFLoader } from 'three/loaders/GLTFLoader.js';

const SECTION = '.deep';
const STAGE = '.deep__stage';
const MODEL = 'assets20/models/gd2-diver-swim.glb';

const CHECKPOINTS = [0.24, 0.52, 0.78];
const HYSTERESIS = 0.02;

/* The path runs RIGHT and DOWN, into the gorge — never back toward the left
   edge, because the head follows the tangent and a leftward leg would turn him
   round to face out of frame. x rises the whole way; the S is in how fast. */
const PATH = [
  { x: 0.185, y: 0.215, s: 1.00 },
  { x: 0.240, y: 0.350, s: 0.985 },
  { x: 0.272, y: 0.495, s: 0.968 },
  { x: 0.330, y: 0.620, s: 0.952 },
  { x: 0.395, y: 0.735, s: 0.940 },
];
const PATH_NARROW = [
  { x: 0.20, y: 0.395, s: 1.00 },
  { x: 0.26, y: 0.445, s: 0.985 },
  { x: 0.32, y: 0.500, s: 0.968 },
  { x: 0.40, y: 0.555, s: 0.952 },
  { x: 0.48, y: 0.605, s: 0.940 },
];

const FOV = 26;
const CAM_Z = 10;

/* His length across the screen, as a fraction of the WIDTH. This sizes the
   model's longest axis, and once he is laid out along the path his silhouette
   spans wider than that — at 0.195 he measured 25.4vw on screen against the
   19-21 asked for, so the figure is set from the measured result rather than
   from the nominal number. */
const LEN_VW = 0.152;
const LEN_VW_NARROW = 0.32;

/* The roll about his own length: where his chest points, in degrees, measured
   from straight down. 25 would be belly-down with the back turned a quarter
   toward the camera — and it showed his chest, because a quarter turn from
   belly-down still faces the lens on this heading.

   Settled by the skeleton rather than by reading a dark silhouette, which I
   got backwards twice: headfront is his face, so the sign of its dot product
   with the direction to the camera says which side we are on. At 205 it reads
   +0.45 — his face. At 25 it reads -0.54 — his back. */
const TILT = { deg: 25 };
/* and the roll is never allowed to wander far enough for his chest to come
   round to the lens */
const ROLL_FREE = 7;
/* the heading the tangent is blended toward, so he never swims out of frame */
const PREFERRED = new THREE.Vector3(1, -0.30, 0).normalize();
const TANGENT_BLEND = 0.45;
/* HOW HE CARRIES HIMSELF ALONG THE DESCENT — an attitude and an arm opening,
   keyed to scroll and slerped between. This replaces a single global pitch
   cap; one number could not hold a dive and a hover at once.

   THE ENTRANCE IS THE ONE THAT WORKS, so the rest is keyed toward it rather
   than away from it. The first version levelled him to 11 degrees and opened
   the arms all the way, and both of those are what went wrong: flat reads as
   inert, and fully extended arms come out the same length and at the same
   angle as his legs, so the silhouette grows a second pair. He now stays on a
   real descent the whole way down and the arms only ease off the chest — the
   attitude that reads on entry is the attitude he keeps. */
const POSES = [
  { at: 0.00, pitch: -78, arms: 0.00 },
  { at: 0.30, pitch: -60, arms: 0.12 },
  { at: 0.62, pitch: -48, arms: 0.26 },
  { at: 1.00, pitch: -40, arms: 0.38 },
];
/* how much the path's own tangent is still allowed to steer the heading left
   and right. The pitch now comes from POSES, so the tangent only yaws. */
const TANGENT_YAW = 0.5;

/* WHERE HE ENDS UP IS A DIFFERENT QUESTION FROM HOW HE IS TURNED, and keeping
   them in one table was the mistake: the attitudes were right and he still
   arrived a long way under the copy, because the path was written in
   percentages that know nothing about where the dots actually are.

   The three anchors are now SOLVED from the page. For each checkpoint the
   group is moved until his leading hand sits at the dot's own centre height
   and his fingertips stop short of the divider. Everything is read with
   getBoundingClientRect and re-solved on resize. */
const HAND_GAP = 48;      /* px his fingertips stop short of the divider */
const EDGE_GUARD = 32;    /* px no part of him may ever come closer than */
const ENTRY = { x: 0.155, y: 0.115 };   /* he dives in here, above and left */

/* the arms keep a slow life of their own on top of the scroll pose. It is not
   a stroke: they reach a little, steer, and come back to the chest. Amplitude
   is a fraction of the tucked-to-extended arc, so the angles come out right
   without anyone naming a joint axis — that arc is ~80 degrees at the elbow,
   so 0.10 of it is the 8 the brief asks for. */
const ARM_LIFE = { period: 2.7, amp: 0.24, phase: 2.1, idle: 0.38 };

const BUBBLES = {
  max: 44, maxNarrow: 18,
  every: [0.35, 0.8],     /* seconds between releases */
  burst: [2, 7],          /* how many come out at once */
  rise: [0.34, 0.78],     /* world units per second */
  riseUp: [0.62, 1.15],   /* climbing, they have to OUTRUN him or they read as tethered */
  life: [2.6, 4.6],
  /* BIMODAL, not a range. A uniform draw gives a crowd of middling blobs; real
     exhaust is mostly a fine mist with the occasional big one shouldering
     through it. Four out of five come from the fine band. */
  fine: [0.0028, 0.0095],
  fat: [0.014, 0.030],
  fatChance: 0.2,
  grow: 1.8,              /* how much bigger by the end of the climb */
};

/* NEUTRAL SWIM POSE — authored, and the base the clip is mixed OVER.
   Pulling the clip back toward the BIND pose was the wrong target: bind is a
   man standing to attention, so damping toward it fought the swim rather than
   settling it, and whatever survived still had one arm up and one hanging.

   The pose is given as DIRECTIONS each limb should point, in the model's own
   standing frame (+Y along him toward the head, +Z the way he faces). Naming
   directions rather than joint angles means nothing here depends on knowing
   which local axis a given bone happens to rotate about — each bone is simply
   turned until it aims where it is told.

   Order matters: the neck is aimed before the head, because aiming a bone
   changes the frame its children are solved in. */
const NEUTRAL = [
  /* bone            child            where it must point (model space) */
  /* THE CLAVICLES ARE LEFT ALONE. Aiming them at the pure side raised the
     shoulders from the model's A-pose into a T, and the skin around the neck
     could not follow — the head came away from the body with a hole under it,
     hanging off the tank. Nothing above the upper arm is posed now; the file's
     own shoulder rest is better than anything aimed blind. */
  /* upper arms lie along the body, about 18 degrees off it */
  ['LeftArm',       'LeftForeArm',  [-0.30, -0.94,  0.15]],
  ['RightArm',      'RightForeArm', [ 0.30, -0.94,  0.15]],
  /* The elbows fold, and the hands come to rest at the ribs. They must NOT
     converge at the midline: aimed inward and forward, the two hands met in
     front of his face and read as a wrestler's guard. Almost no cross-body
     component now, and carried further down toward the feet, so they sit where
     a diver's hands actually rest. */
  ['LeftForeArm',   'LeftHand',     [-0.05, -0.55,  0.83]],
  ['RightForeArm',  'RightHand',    [ 0.05, -0.55,  0.83]],
  /* legs trail, ~11 degrees apart, with a real knee in them */
  ['LeftUpLeg',     'LeftLeg',      [-0.10, -0.995, 0.00]],
  ['RightUpLeg',    'RightLeg',     [ 0.10, -0.995, 0.00]],
  ['LeftLeg',       'LeftFoot',     [-0.10, -0.95, -0.29]],
  ['RightLeg',      'RightFoot',    [ 0.10, -0.95, -0.29]],
  /* HEAD UP, AND SHARED BETWEEN TWO JOINTS. Aiming the face straight along his
     length asked the neck for a right angle in one hinge, and a skinned neck
     given 90 degrees does not bend — it folds, and the head disappeared inside
     the shoulders entirely. About 30 degrees at the neck and 33 at the head is
     the same lifted gaze with nothing crushed. */
  ['neck',          'Head',         [ 0.00,  0.94, -0.34]],
  ['Head',          'headfront',    [ 0.00,  0.48,  0.88]],
];
/* ARMS EXTENDED — the second half of the arm pose, reached at the point.
   Same idea as NEUTRAL: the joints below the shoulders are aimed forward along
   his own length (+Y is toward his head), so the arms open out ahead of him
   instead of sitting at the straps.

   THE ELBOW KEEPS A BEND. The first version aimed the forearm straight along
   the upper arm — 8 degrees between them, which is a locked joint, and it read
   exactly like a wooden puppet with two poles for arms. Reaching forward under
   water is still about 33 degrees of elbow, with the hands carried a little
   inward and a little toward the chest.

   AND THEY MUST NOT READ AS A SECOND PAIR OF LEGS. Sent forward-and-down they
   left the frame at the same angle and the same length as the thighs, and the
   silhouette came out with four matching limbs. They now run close to his own
   axis and converge slightly in front of him — a streamlined reach rather than
   two more legs. */
const ARMS_OUT = [
  ['LeftArm',      'LeftForeArm',  [-0.16,  0.95,  0.24]],
  ['RightArm',     'RightForeArm', [ 0.16,  0.95,  0.24]],
  ['LeftForeArm',  'LeftHand',     [ 0.26,  0.87,  0.42]],
  ['RightForeArm', 'RightHand',    [-0.26,  0.87,  0.42]],
];

/* his gaze at rest, kept so the pointer can turn only the head a little */
const GAZE = new THREE.Vector3(0, 0.55, 0.84).normalize();
/* HOW MUCH OF THE CLIP SURVIVES, PER LIMB — one weight for the whole body was
   the mistake. At a flat 0.33 the kick measured 11.5 degrees at the thigh,
   which is inside the band asked for and still read as nothing: belly-down
   with his back to the lens, the kick plane is edge-on to the camera and the
   foreshortening eats most of it. The legs therefore get most of the clip and
   the upper body almost none — the arms keep the authored pose, the spine only
   breathes, and everything the eye can actually see moving is the kick. */
const CLIP_MIX = {
  LeftUpLeg: 0.78, RightUpLeg: 0.78, LeftLeg: 0.78, RightLeg: 0.78,
  LeftFoot: 0.80, RightFoot: 0.80, LeftToeBase: 0.80, RightToeBase: 0.80,
  Hips: 0.26, Spine: 0.24, Spine01: 0.24, Spine02: 0.26,
  /* THE ARMS TAKE NONE OF THE CLIP. Aiming a bone sets its DIRECTION and
     leaves the twist about that direction free — so whatever the clip had done
     to the roll survived, and it landed differently every frame. That is what
     turned the elbows inside out and flattened the bend: the joint was being
     asked to point somewhere while something else decided which way it folded.
     With the clip off them the arms are two authored poses and a blend, which
     has no free axis left in it. */
  LeftShoulder: 0.05, RightShoulder: 0.05,
  LeftArm: 0, RightArm: 0, LeftForeArm: 0, RightForeArm: 0,
  LeftHand: 0, RightHand: 0,
  neck: 0.14, Head: 0.10,
};
const CLIP_DEFAULT = 0.20;

const LIMIT = {
  ptrX: 25, ptrY: 15,           /* a nudge to his course, not a leash */
  ptrYaw: 12, ptrPitch: 5, ptrRoll: 3,
  headYaw: 7,                   /* the head turns a little further than the body */
};
const TAU = { pos: 0.45, rot: 0.5, home: 0.9, swim: 0.85 };
/* free rotation by dragging is off for now */
const DRAG = false;
const D2R = Math.PI / 180;

/* TEMPORARY — the pose editor, behind ?diverDebug=1 and nothing else. None of
   it runs on the live page: no listeners, no panel, no cost. It exists so the
   three checkpoint angles get chosen by eye and handed back as numbers, rather
   than argued about. */
const DEBUG = /[?&]diverDebug=1/.test(location.search);
const STORE = 'gd2.diverPoses';

/* ======================================================================
   TWO DIRECTIONS. ?diverFlow=up runs the whole thing the other way: he
   enters from below the frame and climbs, and the reader scrolling DOWN
   drives him UP, into the lit rift at the top of the shot.

   It is a different proposition, not a mirrored one. The descent shares
   its direction with the reader and so tends to vanish into the scroll;
   climbing sets the figure against it, and the eye keeps finding him
   because he is the one thing moving the other way. The light he is
   heading for is already the brightest thing in the plate, so the shot
   supplies the destination for free — and the bubbles, which rise
   whatever he does, finally agree with him instead of contradicting.

   x here is a fraction of the VIDEO COLUMN, not of the page: the column
   is what he is composed inside, and it moves with the divider.
   ================================================================== */
const FLOW = /[?&]diverFlow=up/.test(location.search) ? 'up' : 'down';

const UP_PATH = [
  { p: 0.00, x: 0.44, y: 1.10, s: 1.00, o: 0.00 },
  { p: 0.08, x: 0.47, y: 0.91, s: 1.00, o: 1.00 },
  { p: 0.30, x: 0.55, y: 0.72, s: 0.97, o: 1.00 },
  { p: 0.54, x: 0.48, y: 0.52, s: 0.93, o: 1.00 },
  { p: 0.78, x: 0.57, y: 0.30, s: 0.88, o: 1.00 },
  { p: 1.00, x: 0.53, y: 0.07, s: 0.83, o: 0.10 },
];

/* Climbing, the attitude runs the other way and gets steeper as he nears
   the light: a shallow 28 off the horizontal down at the floor, almost
   upright by the time he reaches the rift. Arms mostly out ahead of him,
   in the direction of travel, still working. */
const POSES_UP = [
  { at: 0.00, pitch: 28, arms: 0.55 },
  { at: 0.30, pitch: 44, arms: 0.62 },
  { at: 0.62, pitch: 66, arms: 0.70 },
  { at: 1.00, pitch: 84, arms: 0.78 },
];

/* A BUBBLE IS MOSTLY A HOLE. What makes one read is the bright meniscus at
   its edge and one specular pin — the middle is water you can see through, not
   a glowing centre. Drawn as a rim gradient with a small offset highlight, so
   the first version's solid dots stop looking like a stream of lamps. */
function bubbleSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  /* a THIN meniscus. The first ring was so wide it read as a doughnut rather
     than a bubble — the bright band now sits in the outer twelfth and the rest
     of the disc is water. */
  const rim = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rim.addColorStop(0.00, 'rgba(210,238,255,0.05)');
  rim.addColorStop(0.70, 'rgba(210,238,255,0.08)');
  rim.addColorStop(0.88, 'rgba(232,248,255,0.30)');
  rim.addColorStop(0.955, 'rgba(255,255,255,0.80)');
  rim.addColorStop(0.99, 'rgba(210,238,255,0.14)');
  rim.addColorStop(1.00, 'rgba(210,238,255,0)');
  g.fillStyle = rim;
  g.beginPath(); g.arc(64, 64, 64, 0, 6.2832); g.fill();
  const hi = g.createRadialGradient(47, 44, 0, 47, 44, 16);
  hi.addColorStop(0, 'rgba(255,255,255,0.92)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hi;
  g.beginPath(); g.arc(47, 44, 16, 0, 6.2832); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---- a soft round sprite, drawn rather than fetched ---------------------- */
function dot(soft) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(soft ? 0.25 : 0.55, 'rgba(255,255,255,' + (soft ? 0.34 : 0.8) + ')');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function boot() {
  const section = document.querySelector(SECTION);
  const stage = document.querySelector(STAGE);
  if (!section || !stage || !window.gsap || !window.ScrollTrigger) return;
  if (stage.querySelector('.deep__diver')) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = window.matchMedia('(max-width: 62rem)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');

  if (!document.createElement('canvas').getContext('webgl2')) return;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'deep__diver';
  canvas.setAttribute('aria-hidden', 'true');
  stage.insertBefore(canvas, stage.querySelector('.deep__marks') || null);

  const grip = document.createElement('div');
  grip.className = 'deep__grip';
  grip.setAttribute('aria-hidden', 'true');
  stage.insertBefore(grip, stage.querySelector('.deep__marks') || null);

  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true, powerPreference: 'high-performance',
  });
  renderer.setClearAlpha(0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  /* Key from the rift: it is the bright thing in this frame and it is up and
     to the left, so everything follows from that. The rim is cold and comes
     from the same side to pick the tank and the fin edges off the wall. */
  const key = new THREE.DirectionalLight(0xd2ecff, 3.1);
  key.position.set(-2.0, 3.4, 1.0);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fd6ff, 3.4);
  rim.position.set(-2.6, 1.4, -1.2);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0x24486b, 0.34);
  fill.position.set(1.2, -1.0, 2.6);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight(0x35688f, 0x06090f, 1.0));

  const trajectoryGroup = new THREE.Group();
  const pointerOffsetGroup = new THREE.Group();
  const orientationGroup = new THREE.Group();
  trajectoryGroup.add(pointerOffsetGroup);
  pointerOffsetGroup.add(orientationGroup);
  scene.add(trajectoryGroup);
  trajectoryGroup.visible = false;

  let mixer = null, clipAction = null, curve = null, model = null;
  /* seeded, not null: solveAnchors() runs from inside buildCurve() and asks for
     a scale before the table below it has been written */
  let scaleAt = [1.00, 0.985, 0.968, 0.952, 0.940];
  let materials = [];
  const calm = [];      /* every bone, with the neutral pose the clip mixes over */
  let regulator = null, headBone = null, faceBone = null;
  const _gaze = new THREE.Vector3(), _up = new THREE.Vector3(0, 0, 1);                 /* the head bone: where bubbles start */
  let progress = 0, divider = 0.52, armsOut = 0;
  /* where scroll says he is headed, and whether he has been placed once */
  const target = new THREE.Vector3();
  let targetScale = 1, swimming = false;
  let anchors = null, needSolve = FLOW !== 'up';
  /* the climb keys opacity and its own parameter stops; the descent does not */
  let fadeAt = null, stops = null;
  const trace = [];
  const hands = [];
  /* how much the reader is moving, 0..1 — the arms follow it */
  let motion = 0, lastP = 0;
  let halfW = 0.09, halfH = 0.12;       /* his own screen half-extent */

  const state = { raf: 0, running: false, checkpoint: -1, mounted: false };
  const ptr = { x: 0.5, y: 0.5, active: false };
  const off = { x: 0, y: 0 };
  const aim = { yaw: 0, pitch: 0, roll: 0 };
  const drag = { on: false, yaw: 0, pitch: 0, vYaw: 0, vPitch: 0, px: 0, py: 0, t: 0 };

  const qPose = new THREE.Quaternion();
  const _armQ = new THREE.Quaternion();
  const qSpin = new THREE.Quaternion();
  const eSpin = new THREE.Euler(0, 0, 0, 'YXZ');
  const vFwd = new THREE.Vector3(), vBelly = new THREE.Vector3(), vSide = new THREE.Vector3();
  const mBasis = new THREE.Matrix4();

  function frame() { return { w: stage.clientWidth || 1, h: stage.clientHeight || 1 }; }
  function frustum() { return 2 * CAM_Z * Math.tan(FOV * D2R / 2); }

  /* ---- water in front of him --------------------------------------------- */
  const water = new THREE.Group();
  scene.add(water);
  const bubbleTex = bubbleSprite(), moteTex = dot(true);

  /* ---- bubbles ------------------------------------------------------------
     Sprites, not a Points cloud, because each one needs its own size and its
     own fade and a PointsMaterial has one of each for the whole set. Sixteen
     draw calls is nothing next to the body.

     They are released in ONES AND TWOS every second and a half, not streamed:
     a continuous column reads as a dotted UI line, which is exactly what the
     first attempt looked like. Once a bubble exists it belongs to the water —
     it keeps its own world position and the diver swims away from it. */
  const NB = narrow.matches ? BUBBLES.maxNarrow : BUBBLES.max;
  const bubbles = [];
  for (let i = 0; i < NB; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: bubbleTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xcfeeff, opacity: 0,
    }));
    s.visible = false;
    water.add(s);
    bubbles.push({ sp: s, alive: false, age: 0, life: 1, rise: 0.5, r0: 0.02, seed: 0, drift: 0 });
  }
  let nextPuff = 0.6;

  /* motes live BETWEEN the camera and the body, which is the whole reason they
     are here: some of them cross in front of him and that is the only cue that
     says there is water between the viewer and the subject */
  const NM = 130;
  const moteGeo = new THREE.BufferGeometry();
  const mPos = new Float32Array(NM * 3), mSeed = new Float32Array(NM), mRate = new Float32Array(NM);
  const moteSize = new Float32Array(NM);
  for (let i = 0; i < NM; i++) {
    mSeed[i] = Math.random() * 100; mRate[i] = 0.006 + Math.random() * 0.02;
    moteSize[i] = 0.5 + Math.random();
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    map: moteTex, size: 0.05, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.30, sizeAttenuation: true,
    color: 0x9ec8e8,
  }));
  water.add(motes);

  /* the haze: one soft sheet in front of the body, cold and very thin */
  const haze = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: dot(true), transparent: true, opacity: 0.16, depthWrite: false,
      color: 0x2f6f9e, blending: THREE.AdditiveBlending,
    })
  );
  haze.position.z = 3.2;
  water.add(haze);

  /* ---- the pose ----------------------------------------------------------
     THE MODEL'S OWN AXES ARE MEASURED, NOT ASSUMED. Every earlier attempt
     guessed which local axis was his length and which was his chest, and the
     giveaway that the guess was wrong is that flipping the "belly" sign also
     flipped where his HEAD pointed — a roll about the long axis cannot do
     that, so the axis being rolled around was not his long axis.

     The skeleton answers it directly. Hips->Head is his length; Head->headfront
     is the way he faces. Two measured vectors, and the rotation is then just
     the change of basis from his frame to the one this scene wants — no signs
     to try.
     ---------------------------------------------------------------------- */
  const mFrom = new THREE.Matrix4();      /* his own frame, filled at load */
  let framed = false;

  /* Turn one bone until the joint below it lies along `dir`, with `dir` given
     in the MODEL's frame. The bone's own axis conventions never come into it:
     the current direction to the child is measured, the wanted one is
     converted into the same space, and the minimal rotation between the two is
     applied. */
  const _pq = new THREE.Quaternion(), _mq = new THREE.Quaternion();
  const _cur = new THREE.Vector3(), _want = new THREE.Vector3(), _q = new THREE.Quaternion();
  function aimBone(bone, child, dir) {
    if (!bone || !child || !bone.parent) return;
    model.getWorldQuaternion(_mq).invert();
    bone.parent.getWorldQuaternion(_pq);
    _pq.premultiply(_mq).invert();               /* model space -> parent space */
    _want.fromArray(dir).normalize().applyQuaternion(_pq).normalize();
    _cur.copy(child.position).applyQuaternion(bone.quaternion).normalize();
    if (_cur.lengthSq() < 1e-8) return;
    _q.setFromUnitVectors(_cur, _want);
    bone.quaternion.premultiply(_q);
    bone.updateMatrixWorld(true);
  }

  function buildNeutral(root) {
    const by = {};
    root.traverse(function (o) { if (o.isBone) by[o.name] = o; });
    root.updateWorldMatrix(true, true);
    for (let i = 0; i < NEUTRAL.length; i++) {
      const n = NEUTRAL[i];
      aimBone(by[n[0]], by[n[1]], n[2]);
    }
    /* remember the result: this is what the clip gets mixed over, every frame */
    calm.length = 0;
    for (const name in by) {
      if (!by.hasOwnProperty(name)) continue;
      const w = CLIP_MIX[name] != null ? CLIP_MIX[name] : CLIP_DEFAULT;
      calm.push({ bone: by[name], pose: by[name].quaternion.clone(),
                  /* the rest offset too: the clip animates TRANSLATION on every
                     joint, and the hips channel walks the whole body off the
                     origin. Rotation was being corrected and position was not,
                     which is why the solver and the runtime disagreed about
                     where his hand was by 86px. Joints in a skinned figure do
                     not slide — the rotations carry all the motion. */
                  at: by[name].position.clone(),
                  /* AND THE SCALE. The clip carries a scale track on all 24
                     bones too, and the head's crushed it to nothing — the
                     figure was swimming about with no head on it. Rotation was
                     blended, position was pinned, and scale was left to the
                     clip, which is the one channel a skinned humanoid has no
                     business animating at all. */
                  sc: by[name].scale.clone(),
                  keep: 1 - w, out: null });
    }

    /* then solve the SAME arms again, extended, and keep that as the far end of
       the blend. Two authored poses, one factor between them — no second rig
       and nothing to keep in sync. */
    for (let i = 0; i < ARMS_OUT.length; i++) {
      const n = ARMS_OUT[i];
      aimBone(by[n[0]], by[n[1]], n[2]);
    }
    for (let i = 0; i < calm.length; i++) {
      const nm = calm[i].bone.name;
      if (/Arm$|ForeArm$/.test(nm)) calm[i].out = calm[i].bone.quaternion.clone();
      calm[i].bone.quaternion.copy(calm[i].pose);      /* back to tucked */
    }
    root.updateWorldMatrix(true, true);
  }

  function measureRig(root) {
    const byName = {};
    root.traverse(function (o) { if (o.isBone) byName[o.name] = o; });
    const hips = byName.Hips, head = byName.Head, face = byName.headfront;
    if (!hips || !head || !face) return false;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    root.updateWorldMatrix(true, true);
    hips.getWorldPosition(a); head.getWorldPosition(b); face.getWorldPosition(c);
    const up = b.clone().sub(a).normalize();            /* along him, toward the head */
    const front = c.sub(b);                             /* where he faces */
    front.addScaledVector(up, -front.dot(up)).normalize();
    const side = new THREE.Vector3().crossVectors(up, front).normalize();
    mFrom.makeBasis(side, up, front);
    framed = true;
    return true;
  }

  /* the two keyed values, read off POSES at a given scroll position */
  function keyAt(p) {
    const K = FLOW === 'up' ? POSES_UP : POSES;
    const t = THREE.MathUtils.clamp(p, 0, 1);
    let i = 0;
    while (i < K.length - 2 && t > K[i + 1].at) i++;
    const a = K[i], b = K[i + 1];
    const f = THREE.MathUtils.clamp((t - a.at) / (b.at - a.at || 1), 0, 1);
    const s = f * f * (3 - 2 * f);                    /* no corner at the keys */
    return { pitch: a.pitch + (b.pitch - a.pitch) * s,
             arms: a.arms + (b.arms - a.arms) * s };
  }

  function poseAlong(tangent, pitchDeg) {
    /* a missing pitch used to make the whole quaternion NaN, which killed the
       model's matrix and rendered nothing at all — silently, because a NaN
       transform throws no error */
    if (!isFinite(pitchDeg)) pitchDeg = POSES[0].pitch;
    /* The tangent only yaws him now. His PITCH is keyed — a dive at the top, a
       run in the middle, level at the point — because one cap cannot describe
       both an entrance and a hover. */
    vFwd.copy(tangent);
    vFwd.y = 0;
    if (vFwd.lengthSq() < 1e-6) vFwd.set(1, 0, 0);
    vFwd.normalize().lerp(new THREE.Vector3(1, 0, 0), 1 - TANGENT_YAW).normalize();
    const r = pitchDeg * D2R;
    vFwd.multiplyScalar(Math.cos(r));
    vFwd.y = Math.sin(r);
    vFwd.normalize();



    /* Where his CHEST must point: at the seabed, and away from the camera, so
       what faces us is his back with the tank on it. The tilt is the only
       taste number here — how far off a pure belly-down the back is turned to
       make it a three-quarter rather than a plan view. */
    const t = TILT.deg * D2R;
    vBelly.set(0, -Math.cos(t), -Math.sin(t));
    vBelly.addScaledVector(vFwd, -vBelly.dot(vFwd)).normalize();
    vSide.crossVectors(vFwd, vBelly).normalize();

    mBasis.makeBasis(vSide, vFwd, vBelly);
    if (framed) mBasis.multiply(mFrom.clone().transpose());   /* his frame -> this one */
    qPose.setFromRotationMatrix(mBasis);
  }

  /* ---- measuring him on screen -------------------------------------------
     Everything below works in stage pixels, because that is the space the dots
     and the divider live in. World and screen are related by one constant at
     this fixed camera distance: the frustum height over the stage height. */
  function pxPerWorld() { return stage.clientHeight / frustum(); }

  const _v = new THREE.Vector3();
  function toScreen(v) {
    _v.copy(v).project(camera);
    return { x: (_v.x + 1) / 2 * stage.clientWidth, y: (1 - _v.y) / 2 * stage.clientHeight };
  }
  /* FROM THE BONES, NOT FROM Box3.setFromObject.

     setFromObject is wrong for this file and wrong by a mile: it takes the
     geometry's own bounding box and transforms it by the MESH's world matrix,
     but this model carries its 0.01 scale on the armature node above the mesh,
     so the box never gets scaled down. Measured with the group parked at the
     origin it returned a silhouette 5541px wide on a 1440px stage — about 26
     times life size — which is what threw the solved anchors 2900px off screen.

     The joints are exact, cheap, and unlike a rest-pose box they follow the
     pose. What they miss is the flesh outside them — fins past the toes, the
     tank past the spine — so the box is padded by a fraction of his own span. */
  const BOUNDS_PAD = 0.13;
  const _box = new THREE.Box3();
  function screenBounds() {
    let l = 1e9, r = -1e9, t = 1e9, bo = -1e9;
    for (let i = 0; i < calm.length; i++) {
      calm[i].bone.getWorldPosition(_v);
      const s = toScreen(_v);
      l = Math.min(l, s.x); r = Math.max(r, s.x); t = Math.min(t, s.y); bo = Math.max(bo, s.y);
    }
    if (l > r) return { l: 0, r: 0, t: 0, b: 0 };
    const pad = Math.max(r - l, bo - t) * BOUNDS_PAD;
    l -= pad; r += pad; t -= pad; bo += pad;

    /* UNION with the geometry box, because neither one is the silhouette on its
       own: the joints follow the pose but stop short of the fins and the tank,
       and the geometry box knows the flesh but only in the rest pose. Measured
       against each other at checkpoint 01 they disagreed by 35px, and taking
       the smaller is how he ended up 3px into the copy. */
    _box.setFromObject(model);
    if (isFinite(_box.min.x) && _box.max.x - _box.min.x < 40) {
      for (let i = 0; i < 8; i++) {
        const s = toScreen(_v.set(i & 1 ? _box.max.x : _box.min.x,
                                  i & 2 ? _box.max.y : _box.min.y,
                                  i & 4 ? _box.max.z : _box.min.z));
        l = Math.min(l, s.x); r = Math.max(r, s.x); t = Math.min(t, s.y); bo = Math.max(bo, s.y);
      }
    }
    return { l: l, r: r, t: t, b: bo };
  }
  /* the LEADING hand — whichever of the two is further along his heading, so
     the anchor stays correct if he ever turns the other way */
  function handScreen() {
    if (!hands.length) return null;
    let best = null;
    for (let i = 0; i < hands.length; i++) {
      hands[i].getWorldPosition(_v);
      const s = toScreen(_v);
      if (!best || s.x > best.x) best = s;
    }
    return best;
  }

  /* ---- the three anchors, solved from the page ---------------------------
     He is posed exactly as he will be at that checkpoint, parked at the world
     origin, measured, and then moved by whatever it takes to put his hand on
     the dot and his fingertips short of the divider. */
  /* the heading at a given scroll position, off the curve if there is one */
  const _tan = new THREE.Vector3();
  function tangentAt(p) {
    if (!curve) return PREFERRED;
    const ct = anchors ? curveT(p) : p;
    const a = curve.getPoint(Math.max(0, ct - 0.04));
    const b = curve.getPoint(Math.min(1, ct + 0.04));
    _tan.subVectors(b, a);
    return _tan.lengthSq() < 1e-9 ? PREFERRED : _tan.normalize();
  }

  function solveAnchors() {
    if (!model || narrow.matches) return null;
    const rings = [].slice.call(document.querySelectorAll('.feat__ring'));
    if (rings.length < 3) return null;
    const sr = stage.getBoundingClientRect();
    const dividerPx = divider * sr.width;
    const scale = 1 / pxPerWorld();

    const keepQ = orientationGroup.quaternion.clone();
    const keepP = trajectoryGroup.position.clone();
    const keepS = trajectoryGroup.scale.x;
    const keepArms = armsOut;

    const out = [];
    trace.length = 0;
    for (let i = 0; i < 3; i++) {
      /* the ACTIVATION point, not the bare threshold — that is the instant the
         dot lights, and it is where his hand has to be level with it */
      const p = CHECKPOINTS[i] + HYSTERESIS;
      const key = keyAt(p);
      /* posed off the SAME tangent the runtime will use, or the attitude
         differs between solve and play and the hand lands somewhere else */
      poseAlong(tangentAt(p), key.pitch);
      orientationGroup.quaternion.copy(qPose);
      armsOut = key.arms;
      trajectoryGroup.position.set(0, 0, 0);
      trajectoryGroup.scale.setScalar(scaleFor(p));

      /* AVERAGED OVER FOUR PHASES OF THE CYCLE. Solving at one instant fixes
         his hand to wherever the kick happened to have it, which left a
         standing 32px bias; the mean of a cycle is the position he actually
         holds, and what is left is the wander itself, which is his and should
         not be corrected away. */
      let hx = 0, hy = 0, br = 0, n = 0;
      const keepT = mixer ? mixer.time : 0;
      const dur = clipAction ? clipAction.getClip().duration : 1;
      for (let k = 0; k < 4; k++) {
        if (mixer) mixer.setTime(dur * k / 4);
        poseBones(key.arms, dur * k / 4);
        scene.updateMatrixWorld(true);
        const bb = screenBounds(), hh = handScreen();
        if (!hh) break;
        hx += hh.x; hy += hh.y; br += bb.r; n++;
      }
      if (mixer) mixer.setTime(keepT);
      if (!n) break;
      const h = { x: hx / n, y: hy / n }, b = { r: br / n };
      const ringRect = rings[i].getBoundingClientRect();
      const wantY = ringRect.top + ringRect.height / 2 - sr.top;
      trace.push({ i: i, handX: Math.round(h.x), handY: Math.round(h.y),
                   rightEdge: Math.round(b.r), dividerPx: Math.round(dividerPx),
                   wantY: Math.round(wantY) });
      /* THE FINGERTIPS are what stops short of the divider — the rule is about
         his hand reaching for the dot, not about his widest point. Anchoring
         the silhouette's edge instead pushed him 130px clear at checkpoint 02,
         where the arms are only half extended and the rightmost thing on him
         is a fin. */
      let dx = (dividerPx - HAND_GAP - h.x) * scale;
      /* and then, only if that would put any part of him inside the guard, he
         gives back exactly the difference */
      const over = (b.r + dx / scale) - (dividerPx - EDGE_GUARD);
      if (over > 0) dx -= over * scale;
      out.push(new THREE.Vector3(dx, -(wantY - h.y) * scale, 0));
    }

    orientationGroup.quaternion.copy(keepQ);
    trajectoryGroup.position.copy(keepP);
    trajectoryGroup.scale.setScalar(keepS);
    armsOut = keepArms;
    return out.length === 3 ? out : null;
  }

  /* ---- path -------------------------------------------------------------- */
  function buildCurve() {
    const src = narrow.matches ? PATH_NARROW : PATH;
    const f = frame(), a = f.w / f.h, fh = frustum(), fw = fh * a;
    const at = function (x, y) { return new THREE.Vector3((x - 0.5) * fw, (0.5 - y) * fh, 0); };

    /* CLIMBING: the keys are read straight, no anchors. He is deliberately not
       tied to the three dots here — the copy opens on scroll as it always did
       and he supplies a counter-current beside it, which is the whole point of
       running him the other way. x is a fraction of the video column, so the
       path travels with the divider instead of with the window. */
    if (FLOW === 'up') {
      const col = narrow.matches ? 1 : divider;
      curve = new THREE.CatmullRomCurve3(
        UP_PATH.map(function (k) { return at(k.x * col, k.y); }), false, 'catmullrom', 0.5);
      scaleAt = UP_PATH.map(function (k) { return k.s; });
      fadeAt = UP_PATH.map(function (k) { return k.o; });
      stops = UP_PATH.map(function (k) { return k.p; });
      return;
    }
    fadeAt = null; stops = null;

    /* Anchors are never solved from in here. buildCurve() runs inside the very
       first resize(), while the model is still being scaled and its matrices
       have not settled — solving there returned a silhouette 5541px wide and
       threw the anchors 2900px off screen. The solve is deferred to a frame,
       by which point everything it measures is real; until then the authored
       path is used, and the curve is rebuilt the moment the answer arrives. */
    const solved = anchors;
    if (solved) {
      /* entry and exit are authored — he has to come from somewhere above and
         leave somewhere below — but the three the copy cares about are the
         page's own numbers, not mine */
      const after = solved[2].clone();
      after.x += fh * 0.02; after.y -= fh * 0.16;
      curve = new THREE.CatmullRomCurve3(
        [at(ENTRY.x, ENTRY.y), solved[0], solved[1], solved[2], after],
        false, 'catmullrom', 0.5);
      scaleAt = [1.00, 0.985, 0.968, 0.952, 0.940];
      anchors = solved;
      return;
    }
    /* the phone has no dots to aim at, so it keeps the authored path */
    const mx = halfW + 0.015, my = halfH + 0.02;
    const right = (narrow.matches ? 1 : divider) - mx;
    curve = new THREE.CatmullRomCurve3(src.map(function (p) {
      const x = Math.min(Math.max(p.x, mx), right);
      const y = Math.min(Math.max(p.y, my), 1 - my);
      return at(x, y);
    }), false, 'catmullrom', 0.5);
    scaleAt = src.map(function (p) { return p.s; });
  }

  /* Run once the matrices are real, and again after every resize. If it comes
     back with three points the curve is rebuilt around them; if it cannot (a
     phone, no dots on screen) the authored path stands and nothing is lost. */
  function resolveAnchors() {
    const got = solveAnchors();
    if (!got) return;
    anchors = got;
    buildCurve();
    apply(progress);
  }

  function keyed(list, p) {
    if (!stops) return null;
    const t = THREE.MathUtils.clamp(p, 0, 1);
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1]) i++;
    const f = (t - stops[i]) / (stops[i + 1] - stops[i] || 1);
    return THREE.MathUtils.lerp(list[i], list[i + 1], THREE.MathUtils.clamp(f, 0, 1));
  }

  function scaleFor(p) {
    if (stops) return keyed(scaleAt, p);
    const n = scaleAt.length - 1, f = THREE.MathUtils.clamp(p, 0, 1) * n;
    const i = Math.min(n - 1, Math.floor(f));
    return THREE.MathUtils.lerp(scaleAt[i], scaleAt[i + 1], f - i);
  }

  /* His own half-extent on screen, used to keep him off the edges and off the
     copy. setFromObject already returns WORLD space — every parent transform
     is in it — so the size is converted straight against the frustum. Applying
     the orientation again on top of it, which an earlier pass did, double-
     rotates the box and reports him at 212% of the frame. */
  function measureSelf() {
    if (!model) return;
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(model).getSize(size);
    const fh = frustum();
    halfW = (size.x / 2) / (fh * camera.aspect);
    halfH = (size.y / 2) / fh;
  }

  function resize() {
    const f = frame();
    if (!f.w || !f.h) return;
    camera.aspect = f.w / f.h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(f.w, f.h, false);

    const say = document.querySelector('.deep__say');
    if (say && !narrow.matches) divider = say.getBoundingClientRect().left / f.w;
    grip.style.width = (narrow.matches ? 0 : divider * 100) + '%';

    if (model) {
      const a = f.w / f.h, fh = frustum();
      const want = (narrow.matches ? LEN_VW_NARROW : LEN_VW) * a * fh;
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3(); box.getSize(size);
      const cur = Math.max(size.x, size.y, size.z) / model.scale.x;
      model.scale.setScalar(want / cur);
      measureSelf();
    }
    /* the haze covers the frame it is drawn in front of */
    const d = CAM_Z - haze.position.z;
    const hh = 2 * d * Math.tan(FOV * D2R / 2);
    haze.scale.set(hh * camera.aspect * 1.6, hh * 1.6, 1);
    seedMotes();
    buildCurve();
    apply(progress);
  }

  function seedMotes() {
    const fh = frustum(), fw = fh * camera.aspect;
    for (let i = 0; i < NM; i++) {
      mPos[i * 3] = (Math.random() - 0.5) * fw * 1.1;
      mPos[i * 3 + 1] = (Math.random() - 0.5) * fh * 1.1;
      mPos[i * 3 + 2] = 1.2 + Math.random() * 5.4;      /* all in front of him */
    }
    moteGeo.attributes.position.needsUpdate = true;
  }

  /* SCROLL PROGRESS IS NOT CURVE PARAMETER. A five-point Catmull-Rom puts its
     control points at t = 0, .25, .5, .75, 1, but the checkpoints fire at .24,
     .52 and .78 — so he sailed past each anchor before its dot lit, measured at
     96 and 103px below the dot it was supposed to be level with. This bends the
     parameter so the three solved anchors are reached exactly when their own
     checkpoints do.

     And the keys are the ACTIVATION points, not the raw thresholds: an item
     lights at its threshold plus the hysteresis, so aiming at the bare
     threshold still left him 50 and 89px past the dot by the time it came on. */
  const T_MAP = [[0, 0],
                 [CHECKPOINTS[0] + HYSTERESIS, 0.25],
                 [CHECKPOINTS[1] + HYSTERESIS, 0.5],
                 [CHECKPOINTS[2] + HYSTERESIS, 0.75],
                 [1, 1]];
  function curveT(p) {
    let i = 0;
    while (i < T_MAP.length - 2 && p > T_MAP[i + 1][0]) i++;
    const a = T_MAP[i], b = T_MAP[i + 1];
    const f = (p - a[0]) / (b[0] - a[0] || 1);
    return a[1] + (b[1] - a[1]) * THREE.MathUtils.clamp(f, 0, 1);
  }

  function apply(p) {
    if (!curve) return;
    progress = p;
    const t = THREE.MathUtils.clamp(p, 0, 1);
    /* SCROLL SETS A TARGET; IT DOES NOT SET HIM.
       Writing the curve point straight onto the group made the wheel teleport
       him — a hard flick and he was simply somewhere else, which is the one
       thing a swimmer cannot do. Scroll now says where he is HEADED, and the
       body closes on it under its own inertia in the tick. Stopping lets him
       arrive; hurrying makes him cover ground. */
    const ct = anchors ? curveT(t) : t;
    target.copy(curve.getPoint(ct));
    targetScale = scaleFor(t);
    if (!swimming) {          /* the first placement is instant, not a swim in */
      trajectoryGroup.position.copy(target);
      trajectoryGroup.scale.setScalar(targetScale);
      swimming = true;
    }
    const a = curve.getPoint(Math.max(0, ct - 0.04));
    const b = curve.getPoint(Math.min(1, ct + 0.04));
    const key = keyAt(t);
    poseAlong(vSide.subVectors(b, a).normalize(), key.pitch);
    armsOut = key.arms;

    /* He enters from under the frame and leaves inside the light, so the climb
       keys his own opacity: invisible below the bottom edge, solid for the
       whole swim, and thinning to a tenth as the rift takes him. The descent
       keys nothing — it has no vanishing to do. */
    if (fadeAt) {
      const o = keyed(fadeAt, t);
      for (let i = 0; i < materials.length; i++) materials[i].opacity = o;
      trajectoryGroup.visible = o > 0.01;
    }
    /* the tangent is still computed while the editor is open — RESET needs
       something to return to — but it is not allowed to write the attitude,
       or every scroll would undo the pose being set */
    if (edit.on) orientationGroup.quaternion.copy(edit.quat);
  }

  /* ---- the arms ----------------------------------------------------------
     Base is the scroll blend between the two authored poses. On top of it a
     slow life, expressed as a wobble in that same blend factor rather than as
     angles on named joints: a tenth of a 80-degree elbow arc IS eight degrees,
     and nothing here has to know which axis an elbow turns about.

     Left and right run out of phase, so he steers rather than rows. The
     amplitude follows the reader — full while they are moving, easing down to
     a fifth when they stop, never to nothing. */
  /* ONE PIPELINE, TWO CALLERS. The tick runs it after the mixer; the anchor
     solver runs it too, so both are looking at the same body.

     They were not, and that was the bias: the solver measured a figure with no
     clip on it at all, while the runtime measured one with a tenth of the clip
     still in the arms, and his hand came out 74px lower than the solver had
     been told. A residual that a solver cannot see is a residual it cannot
     correct for. */
  function poseBones(armsFactor, t) {
    setArms(armsFactor, t);
    for (let i = 0; i < calm.length; i++) {
      const c = calm[i];
      if (!c.out) c.bone.quaternion.slerp(c.pose, c.keep);
      /* joints rotate; they never slide and they never resize. The clip carries
         translation and scale on all 24 bones — the hips translation walked the
         whole body off its origin, and the head's scale crushed the head. */
      c.bone.position.copy(c.at);
      c.bone.scale.copy(c.sc);
    }
  }

  function setArms(base, t) {
    const amp = ARM_LIFE.amp * (ARM_LIFE.idle + (1 - ARM_LIFE.idle) * motion);
    const w = 2 * Math.PI / ARM_LIFE.period;
    for (let i = 0; i < calm.length; i++) {
      const c = calm[i];
      if (!c.out) continue;
      const right = c.bone.name.charAt(0) === 'R';
      const f = THREE.MathUtils.clamp(
        base + amp * Math.sin(t * w + (right ? ARM_LIFE.phase : 0)), 0, 1);
      _armQ.copy(c.pose).slerp(c.out, f);
      c.bone.quaternion.slerp(_armQ, c.keep);
    }
  }

  /* ---- the hard rule ------------------------------------------------------
     Solved anchors put him in the right place; the arm cycle then moves his
     fingertips a few pixels either way. This is the guarantee on top: whatever
     the cycle is doing, no part of him is ever within EDGE_GUARD of the
     divider. Cheap — eight corners — and it runs after everything else has
     had its say. */
  function keepOffTheCopy() {
    if (!model || narrow.matches) return;
    scene.updateMatrixWorld(true);
    const b = screenBounds();
    const limit = divider * stage.clientWidth - EDGE_GUARD;
    if (b.r > limit) {
      trajectoryGroup.position.x -= (b.r - limit) / pxPerWorld();
    }
  }

  function checkpointFor(p) {
    let n = -1;
    for (let i = 0; i < CHECKPOINTS.length; i++) {
      const edge = CHECKPOINTS[i] + (state.checkpoint >= i ? -HYSTERESIS : HYSTERESIS);
      if (p >= edge) n = i;
    }
    return n;
  }
  function syncFeats(p) {
    const n = checkpointFor(p);
    if (n === state.checkpoint) return;
    state.checkpoint = n;
    const items = document.querySelectorAll('.feat');
    const target = items[Math.max(0, n)];
    if (!target) return;
    const btn = target.querySelector('.feat__btn');
    if (btn && !target.hasAttribute('data-open')) btn.click();
  }

  const damp = function (cur, goal, tau, dt) { return goal + (cur - goal) * Math.exp(-dt / tau); };

  function steerTo(dt) {
    if (edit.on) return;          /* the hand owns the course while editing */
    const f = frame();
    const usePtr = fine.matches && !narrow.matches && !reduced.matches;
    const home = !usePtr || !ptr.active;
    let gx = 0, gy = 0, gYaw = 0, gPitch = 0, gRoll = 0;
    if (!home) {
      const px = Math.min(ptr.x, divider - 0.01);
      const here = trajectoryGroup.position;
      const fh = frustum();
      const ax = (px - 0.5) * fh * camera.aspect - here.x;
      const ay = (0.5 - ptr.y) * fh - here.y;
      /* climbing, the pointer is barely allowed to touch him: he is holding a
         line to a fixed destination and a cursor pulling him off it reads as
         indecision rather than as life */
      const soft = FLOW === 'up' ? 0.4 : 1;
      const maxX = LIMIT.ptrX * soft / f.h * fh, maxY = LIMIT.ptrY * soft / f.h * fh;
      gx = THREE.MathUtils.clamp(ax, -maxX, maxX);
      gy = THREE.MathUtils.clamp(ay, -maxY, maxY);
      gYaw = THREE.MathUtils.clamp(ax / maxX, -1, 1) * LIMIT.ptrYaw;
      gPitch = THREE.MathUtils.clamp(-ay / maxY, -1, 1) * LIMIT.ptrPitch;
      gRoll = THREE.MathUtils.clamp(ax / maxX, -1, 1) * LIMIT.ptrRoll;
    }
    const tp = home ? TAU.home : TAU.pos, tr = home ? TAU.home : TAU.rot;
    off.x = damp(off.x, gx, tp, dt); off.y = damp(off.y, gy, tp, dt);
    aim.yaw = damp(aim.yaw, gYaw, tr, dt);
    aim.pitch = damp(aim.pitch, gPitch, tr, dt);
    aim.roll = damp(aim.roll, gRoll, tr, dt);
    pointerOffsetGroup.position.set(off.x, off.y, 0);

    eSpin.set(aim.pitch * D2R, aim.yaw * D2R,
              THREE.MathUtils.clamp(aim.roll, -ROLL_FREE, ROLL_FREE) * D2R, 'YXZ');
    qSpin.setFromEuler(eSpin);
    orientationGroup.quaternion.slerp(qSpin.premultiply(qPose), 1 - Math.exp(-dt / (TAU.rot * 0.45)));
  }

  /* ---- water, per frame --------------------------------------------------- */
  const vTmp = new THREE.Vector3();
  function stirWater(dt, now) {
    const fh = frustum(), fw = fh * camera.aspect;
    if (regulator && !reduced.matches) {
      const rnd = function (a) { return a[0] + Math.random() * (a[1] - a[0]); };
      nextPuff -= dt;
      if (nextPuff <= 0) {
        nextPuff = rnd(BUBBLES.every);
        regulator.getWorldPosition(vTmp);
        let want = Math.round(rnd(BUBBLES.burst));
        for (let i = 0; i < bubbles.length && want > 0; i++) {
          const b = bubbles[i];
          if (b.alive) continue;
          b.alive = true; b.age = 0;
          b.life = rnd(BUBBLES.life);
          b.rise = rnd(FLOW === 'up' ? BUBBLES.riseUp : BUBBLES.rise);
          b.r0 = rnd(Math.random() < BUBBLES.fatChance ? BUBBLES.fat : BUBBLES.fine);
          b.seed = Math.random() * 6.28;
          b.drift = (Math.random() - 0.5) * 0.16;
          /* born at the regulator, and from then on it is the water's, not his */
          b.sp.position.copy(vTmp).add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.05, 0.02, (Math.random() - 0.5) * 0.05));
          b.sp.visible = true;
          want--;
        }
      }
      const stopAt = narrow.matches ? 1e9
        : (divider * stage.clientWidth - EDGE_GUARD) / pxPerWorld() - frustum() * camera.aspect / 2;
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        if (!b.alive) continue;
        b.age += dt;
        const u = b.age / b.life;
        if (u >= 1) { b.alive = false; b.sp.visible = false; continue; }
        b.sp.position.y += b.rise * dt;
        b.sp.position.x += (b.drift + Math.sin(b.seed + b.age * 2.1) * 0.05) * dt;
        b.sp.position.z += Math.cos(b.seed + b.age * 1.7) * 0.04 * dt;
        /* they never drift into the reading column either */
        if (b.sp.position.x > stopAt) b.sp.position.x = stopAt;
        const r = b.r0 * (1 + (BUBBLES.grow - 1) * u);
        b.sp.scale.setScalar(r);
        /* in quickly, out slowly */
        b.sp.material.opacity = 0.62 * Math.min(1, u * 8) * (1 - u * u);
      }
    }
    for (let i = 0; i < NM; i++) {
      mPos[i * 3 + 1] -= mRate[i] * dt * 12;
      mPos[i * 3] += Math.sin(now * 0.15 + mSeed[i]) * dt * 0.05;
      if (mPos[i * 3 + 1] < -fh * 0.58) {
        mPos[i * 3 + 1] = fh * 0.58;
        mPos[i * 3] = (Math.random() - 0.5) * fw * 1.1;
      }
    }
    moteGeo.attributes.position.needsUpdate = true;
  }

  const clock = new THREE.Clock();
  function tick() {
    state.raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta());
    const now = clock.getElapsedTime();
    if (needSolve && model) { needSolve = false; resolveAnchors(); }
    if (mixer && !state.frozen) {
      mixer.update(dt);
      /* The mixer has just written the raw clip over every bone. Pull it back
         onto the authored pose, so what survives is a breath of the cycle on a
         body that is already arranged — not the cycle deciding the pose. */
      poseBones(armsOut, now);
      /* and the head looks a little further than the body turns. A neck that
         leads the shoulders is most of what separates a swimmer from a mannequin
         being carried by a current. */
      if (headBone && faceBone) {
        _gaze.copy(GAZE).applyAxisAngle(_up, -aim.yaw * (LIMIT.headYaw / LIMIT.ptrYaw) * D2R);
        aimBone(headBone, faceBone, [_gaze.x, _gaze.y, _gaze.z]);
      }
    }
    /* HE SWIMS TO IT. The gap between where he is and where scroll wants him
       is closed on a time constant, not assigned — a framerate-independent
       ease, so the same swim happens at 60 and at 144Hz. TAU.swim is long
       enough that a hard flick reads as him covering distance. */
    if (swimming && !edit.on) {
      const k = 1 - Math.exp(-dt / TAU.swim);
      trajectoryGroup.position.lerp(target, k);
      const s = trajectoryGroup.scale.x;
      trajectoryGroup.scale.setScalar(s + (targetScale - s) * k);
    }
    /* and how hard he is working is how far behind he is — catching up is the
       one moment the arms have a reason to pull */
    const behind = trajectoryGroup.position.distanceTo(target) / (frustum() * 0.25);
    motion = Math.max(motion * Math.exp(-dt / 0.7), Math.min(1, behind));
    lastP = progress;
    if (!reduced.matches && !state.frozen) { steerTo(dt); stirWater(dt, now); }
    if (!edit.on) keepOffTheCopy();
    if (edit.on) {
      orientationGroup.quaternion.copy(edit.quat);
      orientationGroup.scale.setScalar(edit.scale);
      pointerOffsetGroup.position.set(edit.off.x, edit.off.y, 0);
      edit.paint && edit.paint();
    }
    renderer.render(scene, camera);
  }
  function start() { if (state.running) return; state.running = true; clock.getDelta(); tick(); }
  function stop() { state.running = false; cancelAnimationFrame(state.raf); }

  const io = new IntersectionObserver(function (e) { e[0].isIntersecting ? start() : stop(); },
    { rootMargin: '10% 0px' });

  function onMove(e) {
    const r = stage.getBoundingClientRect();
    ptr.x = (e.clientX - r.left) / r.width;
    ptr.y = (e.clientY - r.top) / r.height;
    ptr.active = ptr.x < divider && ptr.y > 0 && ptr.y < 1;
  }
  function onLeave() { ptr.active = false; }
  function onDown(e) {
    if (!fine.matches || narrow.matches || reduced.matches) return;
    drag.on = true; drag.px = e.clientX; drag.py = e.clientY;
    drag.t = performance.now(); drag.vYaw = drag.vPitch = 0;
    grip.setAttribute('data-dragging', '');
    grip.setPointerCapture && grip.setPointerCapture(e.pointerId);
  }
  function onDrag(e) {
    if (!drag.on) return;
    const now = performance.now();
    const dt = Math.max(0.008, Math.min(0.1, (now - drag.t) / 1000));
    drag.t = now;
    const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
    drag.px = e.clientX; drag.py = e.clientY;
    const f = frame();
    const dYaw = dx / f.w * 150, dPitch = dy / f.h * 90;
    drag.yaw += dYaw;
    drag.pitch = THREE.MathUtils.clamp(drag.pitch + dPitch, -LIMIT.dragPitch, LIMIT.dragPitch);
    drag.vYaw = dYaw / dt; drag.vPitch = dPitch / dt;
  }
  function onUp(e) {
    if (!drag.on) return;
    drag.on = false;
    grip.removeAttribute('data-dragging');
    drag.vYaw = THREE.MathUtils.clamp(drag.vYaw * 0.28, -90, 90);
    drag.vPitch = THREE.MathUtils.clamp(drag.vPitch * 0.28, -60, 60);
  }
  if (fine.matches) {
    stage.addEventListener('pointermove', onMove, { passive: true });
    stage.addEventListener('pointerleave', onLeave, { passive: true });
    grip.addEventListener('pointerdown', onDown);
    grip.addEventListener('pointermove', onDrag);
    grip.addEventListener('pointerup', onUp);
    grip.addEventListener('pointercancel', onUp);
  }

  new GLTFLoader().load(MODEL, function (gltf) {
    model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3(); box.getSize(size);
    const mid = new THREE.Vector3(); box.getCenter(mid);
    model.scale.multiplyScalar(1 / Math.max(size.x, size.y, size.z));
    model.position.sub(mid.multiplyScalar(1 / Math.max(size.x, size.y, size.z)));

    model.traverse(function (o) {
      if (o.isBone) {
        if (o.name === 'Head') { headBone = o; regulator = regulator || o; }
        if (o.name === 'headfront') faceBone = o;
        if (o.name === 'LeftHand' || o.name === 'RightHand') hands.push(o);
      }
      if (!o.isMesh) return;
      o.frustumCulled = false;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
        if (!m) return;
        /* the file declares no metallicFactor, so it inherits glTF's default of
           1.0 — fully metallic, no env map, no diffuse response, black. It only
           looked right because an emissive pass was drawing the whole figure. */
        m.metalness = 0.06;
        m.roughness = Math.min(1, (typeof m.roughness === 'number' ? m.roughness : 0.41) + 0.22);
        m.emissiveIntensity = 0;
        if (m.emissiveMap) m.emissiveMap = null;
        if (m.emissive) m.emissive.setHex(0x000000);
        /* the water's own cast, very soft, so he belongs to the plate */
        if (m.color) m.color.lerp(new THREE.Color(0x6f9fc4), 0.16);
        m.transparent = true;
        materials.push(m);
      });
    });

    orientationGroup.add(model);
    measureRig(model);
    buildNeutral(model);
    poseAlong(PREFERRED, POSES[0].pitch);
    orientationGroup.quaternion.copy(qPose);

    const clip = gltf.animations && gltf.animations[0];
    if (clip) {
      mixer = new THREE.AnimationMixer(model);
      const action = clipAction = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.timeScale = reduced.matches ? 0.10 : 0.82;
      action.play();
      mixer.update(0.4);
    }

    resize();
    apply(reduced.matches ? 0.5 : 0);
    trajectoryGroup.visible = true;
    io.observe(stage);
    if (DEBUG) mountEditor();
    state.mounted = true;
    renderer.render(scene, camera);
  }, undefined, function () { canvas.remove(); grip.remove(); });

  const master = ScrollTrigger.create({
    trigger: SECTION,
    start: function () { return 'top top-=' + Math.round(window.innerHeight * 0.9); },
    end: 'bottom bottom',
    scrub: 0.7,
    invalidateOnRefresh: true,
    onUpdate: function (self) {
      if (!reduced.matches) apply(self.progress);
      syncFeats(self.progress);
    },
  });

  let rt = 0;
  function onResize() { clearTimeout(rt); rt = setTimeout(resize, 160); }
  window.addEventListener('resize', onResize, { passive: true });

  /* ======================================================================
     THE POSE EDITOR — temporary, ?diverDebug=1 only.

     While it is on, the two systems that would fight the hand are stood down:
     the tangent stops writing the attitude and the pointer stops nudging the
     course. The swim cycle keeps running underneath, because the pose has to
     be judged with the legs moving. Scroll and the three checkpoints are
     untouched, so an angle can be set against the copy it belongs to.

     It writes to the same three transforms the scene already owns — offset on
     the pointer group, rotation and scale on the orientation group — so
     whatever comes back is directly usable as POSES later.
     ================================================================== */
  const edit = {
    on: false, cp: 0, scale: 1,
    quat: new THREE.Quaternion(), off: new THREE.Vector2(),
    saved: [null, null, null],
  };

  function mountEditor() {
    edit.on = true;
    edit.quat.copy(qPose);
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) edit.saved = JSON.parse(raw);
    } catch (e) { /* a private window, or a corrupt entry: start clean */ }

    /* the left half only. The right is the reading column, and a transparent
       sheet over it would eat the wheel and every click on the accordion. */
    const pad = document.createElement('div');
    pad.className = 'deep__edit';
    stage.appendChild(pad);

    const panel = document.createElement('div');
    panel.className = 'deep__editui';
    panel.innerHTML =
      /* a build marker, so a stale cached module is visible at a glance
         instead of being mistaken for broken input */
      '<b>DIVER POSE EDITOR <em>b4</em></b>' +
      '<div>CHECKPOINT <s data-cp>1</s></div>' +
      '<div>POSITION <s data-pos></s></div>' +
      '<div>ROTATION <s data-rot></s></div>' +
      '<div>SCALE <s data-scl></s></div>' +
      '<div>SAVED <s data-has></s></div>' +
      '<div>POINTER <s data-ptr></s></div>' +
      '<div>DELTA <s data-del></s></div>' +
      '<p><button data-save>SAVE POSE</button>' +
      '<button data-reset>RESET</button>' +
      '<button data-copy>COPY JSON</button></p>' +
      '<i>drag rotate · shift roll · alt/right move · wheel scale · 1 2 3 save · R reset · C copy</i>';
    document.body.appendChild(panel);
    const el = {
      cp: panel.querySelector('[data-cp]'), pos: panel.querySelector('[data-pos]'),
      rot: panel.querySelector('[data-rot]'), scl: panel.querySelector('[data-scl]'),
      has: panel.querySelector('[data-has]'),
      ptr: panel.querySelector('[data-ptr]'), del: panel.querySelector('[data-del]'),
    };

    const drag = { on: false, x: 0, y: 0, dx: 0, dy: 0, mode: 'rot', phase: '—', id: null };
    const qd = new THREE.Quaternion(), axis = new THREE.Vector3();
    document.body.classList.add('diver-debug');

    /* ON WINDOW, IN THE CAPTURE PHASE, not on the pad. The pad is a child of a
       stage that already has a full-bleed absolute layer over it for the copy,
       so anything hung on the pad is behind that layer and never sees a press.
       Capturing at the window is the only place guaranteed to be ahead of
       every other listener on the page. */
    function overVideo(e) {
      /* never steal a press aimed at the panel's own buttons */
      if (e.target && e.target.closest && e.target.closest('.deep__editui')) return false;
      const r = stage.getBoundingClientRect();
      /* any part of the stage on screen is enough. An earlier 40px guard meant
         a press near the edge of the section did nothing and looked broken. */
      if (r.bottom <= 0 || r.top >= window.innerHeight) return false;
      return e.clientX < divider * r.width + r.left;
    }
    function onDownE(e) {
      if (!overVideo(e)) return;
      drag.on = true; drag.id = e.pointerId; drag.phase = 'DOWN';
      drag.x = e.clientX; drag.y = e.clientY; drag.dx = drag.dy = 0;
      drag.mode = (e.button === 2 || e.altKey) ? 'move' : e.shiftKey ? 'roll' : 'rot';
      const host = pad || document.documentElement;
      if (host.setPointerCapture) { try { host.setPointerCapture(e.pointerId); } catch (err) {} }
      e.preventDefault(); e.stopPropagation();
    }
    function onMoveE(e) {
      if (!drag.on) return;                 /* once down, follow the hand anywhere */
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      drag.dx = dx; drag.dy = dy; drag.phase = 'MOVE';
      if (drag.mode === 'move') {
        const fh = frustum();
        edit.off.x += dx / stage.clientHeight * fh;
        edit.off.y -= dy / stage.clientHeight * fh;
      } else if (drag.mode === 'roll') {
        /* about his own length: the model's +Y carried into world by the pose
           he is currently in, so a roll stays a roll at any attitude */
        axis.set(0, 1, 0).applyQuaternion(edit.quat).normalize();
        edit.quat.premultiply(qd.setFromAxisAngle(axis, (dx + dy) * 0.006));
      } else {
        edit.quat.premultiply(qd.setFromAxisAngle(axis.set(0, 1, 0), dx * 0.006));
        edit.quat.premultiply(qd.setFromAxisAngle(axis.set(1, 0, 0), dy * 0.006));
      }
      e.preventDefault(); e.stopPropagation();
    }
    function onUpE(e) {
      if (!drag.on) return;
      drag.on = false; drag.phase = 'UP';
      const host = pad || document.documentElement;
      if (host.releasePointerCapture && drag.id != null) {
        try { host.releasePointerCapture(drag.id); } catch (err) {}
      }
      drag.id = null;
    }
    function onWheelE(e) {
      if (!overVideo(e)) return;
      edit.scale = THREE.MathUtils.clamp(edit.scale * Math.exp(-e.deltaY * 0.0012), 0.25, 4);
      e.preventDefault(); e.stopPropagation();
    }
    function onMenuE(e) { if (overVideo(e)) e.preventDefault(); }

    const CAP = { capture: true };
    window.addEventListener('pointerdown', onDownE, CAP);
    window.addEventListener('pointermove', onMoveE, CAP);
    window.addEventListener('pointerup', onUpE, CAP);
    window.addEventListener('pointercancel', onUpE, CAP);
    window.addEventListener('wheel', onWheelE, { capture: true, passive: false });
    window.addEventListener('contextmenu', onMenuE, CAP);
    edit.drag = drag;

    function snapshot() {
      return {
        checkpoint: edit.cp + 1,
        position: [+edit.off.x.toFixed(4), +edit.off.y.toFixed(4)],
        quaternion: [+edit.quat.x.toFixed(5), +edit.quat.y.toFixed(5),
                     +edit.quat.z.toFixed(5), +edit.quat.w.toFixed(5)],
        scale: +edit.scale.toFixed(4),
      };
    }
    function save(i) {
      edit.saved[i] = snapshot();
      edit.saved[i].checkpoint = i + 1;
      try { localStorage.setItem(STORE, JSON.stringify(edit.saved)); } catch (e) {}
      flash('saved ' + (i + 1));
    }
    function reset() {
      edit.quat.copy(qPose); edit.off.set(0, 0); edit.scale = 1;
    }
    function copy() {
      const json = JSON.stringify(edit.saved, null, 2);
      if (navigator.clipboard) navigator.clipboard.writeText(json).then(function () { flash('copied'); },
        function () { flash('clipboard refused — see console'); console.log(json); });
      else { console.log(json); flash('see console'); }
    }
    let note = '', noteT = 0;
    function flash(s) { note = s; noteT = performance.now(); }

    panel.querySelector('[data-save]').onclick = function () { save(edit.cp); };
    panel.querySelector('[data-reset]').onclick = reset;
    panel.querySelector('[data-copy]').onclick = copy;

    window.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'r') reset();
      else if (k === 'c') copy();
      else if (k === '1' || k === '2' || k === '3') save(+k - 1);
    });

    const eul = new THREE.Euler();
    edit.paint = function () {
      edit.cp = Math.max(0, state.checkpoint);
      eul.setFromQuaternion(edit.quat, 'XYZ');
      el.cp.textContent = (edit.cp + 1) + ' / 3';
      el.pos.textContent = edit.off.x.toFixed(3) + ', ' + edit.off.y.toFixed(3);
      el.rot.textContent = (eul.x / D2R).toFixed(1) + '°, ' + (eul.y / D2R).toFixed(1) +
                           '°, ' + (eul.z / D2R).toFixed(1) + '°';
      el.scl.textContent = edit.scale.toFixed(3);
      el.ptr.textContent = edit.drag.phase + (edit.drag.on ? '  [' + edit.drag.mode + ']' : '');
      el.del.textContent = edit.drag.dx + ', ' + edit.drag.dy;
      el.has.textContent = edit.saved.map(function (s, i) { return s ? (i + 1) : '·'; }).join(' ') +
        (note && performance.now() - noteT < 1400 ? '   ' + note : '');
    };
    edit.teardown = function () {
      window.removeEventListener('pointerdown', onDownE, CAP);
      window.removeEventListener('pointermove', onMoveE, CAP);
      window.removeEventListener('pointerup', onUpE, CAP);
      window.removeEventListener('pointercancel', onUpE, CAP);
      window.removeEventListener('wheel', onWheelE, { capture: true });
      window.removeEventListener('contextmenu', onMenuE, CAP);
      document.body.classList.remove('diver-debug');
      pad.remove(); panel.remove();
    };
  }

  window.__gd2Diver = {
    dispose: function () {
      stop(); io.disconnect();
      window.removeEventListener('resize', onResize);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      master.kill();
      if (mixer) { mixer.stopAllAction(); if (model) mixer.uncacheRoot(model); }
      scene.traverse(function (o) {
        if (o.isMesh || o.isPoints) {
          o.geometry && o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
            if (!m) return;
            Object.keys(m).forEach(function (k) { const v = m[k]; if (v && v.isTexture) v.dispose(); });
            m.dispose();
          });
        }
      });
      renderer.dispose(); canvas.remove(); grip.remove();
      delete window.__gd2Diver;
    },
    /* WHICH SIDE OF HIM IS FACING THE LENS, decided by the skeleton instead of
       by squinting at a dark silhouette. headfront is his face: if the vector
       from Head to it points away from the camera, the camera has his back. */
    get facing() {
      if (!model) return null;
      let H = null, F = null, P = null;
      model.traverse(function (o) {
        if (o.name === 'Head') H = o;
        if (o.name === 'headfront') F = o;
        if (o.name === 'Hips') P = o;
      });
      if (!H || !F || !P) return { err: 'bones missing' };
      const h = new THREE.Vector3(), f = new THREE.Vector3(), p = new THREE.Vector3();
      H.getWorldPosition(h); F.getWorldPosition(f); P.getWorldPosition(p);
      const face = f.sub(h).normalize();
      const long = h.clone().sub(p).normalize();
      const toCam = camera.position.clone().sub(h).normalize();
      const d = face.dot(toCam);
      return {
        tilt: TILT.deg,
        faceDotCamera: +d.toFixed(3),
        sees: d > 0.15 ? 'HIS FACE' : d < -0.15 ? 'HIS BACK' : 'edge on',
        headLeadsRight: long.x > 0,
        headPitchDeg: +(Math.asin(THREE.MathUtils.clamp(long.y, -1, 1)) / D2R).toFixed(1),
      };
    },
    /* is the swim actually running, and does it reach the bones? */
    get anim() {
      if (!mixer) return { mixer: false };
      const a = clipAction;
      let leg = null;
      model && model.traverse(function (o) { if (o.name === 'LeftUpLeg') leg = o; });
      return {
        mixerTime: +mixer.time.toFixed(3),
        enabled: a ? a.enabled : null,
        paused: a ? a.paused : null,
        weight: a ? +a.getEffectiveWeight().toFixed(3) : null,
        timeScale: a ? +a.getEffectiveTimeScale().toFixed(3) : null,
        running: a ? a.isRunning() : null,
        legQuat: leg ? [+leg.quaternion.x.toFixed(4), +leg.quaternion.y.toFixed(4),
                        +leg.quaternion.z.toFixed(4), +leg.quaternion.w.toFixed(4)] : null,
      };
    },
    /* where the leading hand actually is, in stage pixels */
    get hand() { return model ? handScreen() : null; },
    get trace() { return trace.slice(); },
    get probe() {
      const o = { group: trajectoryGroup.position.toArray().map(function(n){return +n.toFixed(3);}),
                  groupScale: +trajectoryGroup.scale.x.toFixed(4),
                  modelPos: model.position.toArray().map(function(n){return +n.toFixed(3);}),
                  modelScale: +model.scale.x.toFixed(6), bones: {} };
      const v = new THREE.Vector3();
      ['Hips','Head','LeftHand','RightHand','LeftFoot'].forEach(function (n) {
        model.traverse(function (b) { if (b.name === n) { b.getWorldPosition(v); o.bones[n] = v.toArray().map(function(k){return +k.toFixed(3);}); } });
      });
      var sk = null; model.traverse(function (m) { if (m.isSkinnedMesh) sk = m; });
      if (sk) { sk.computeBoundingBox();
        o.skinBoxLocal = [sk.boundingBox.min.toArray().map(function(k){return +k.toFixed(3);}), sk.boundingBox.max.toArray().map(function(k){return +k.toFixed(3);})];
        o.meshWorldScale = +new THREE.Vector3().setFromMatrixScale(sk.matrixWorld).x.toFixed(6); }
      return o;
    },
    /* the solved anchors as the camera sees them, so a test can tell an aiming
       error apart from a curve-parameter error */
    /* the head, in his own terms: how far it sits from the neck against how
       long he is, and where it lands on screen. A head folded into the chest
       or flung off the body both show up here as a number. */
    get headCheck() {
      if (!model) return null;
      let H = null, N = null, P = null;
      model.traverse(function (o) {
        if (o.name === 'Head') H = o;
        if (o.name === 'neck') N = o;
        if (o.name === 'Hips') P = o;
      });
      if (!H || !N || !P) return { err: 'bones missing' };
      const h = new THREE.Vector3(), n = new THREE.Vector3(), p = new THREE.Vector3();
      H.getWorldPosition(h); N.getWorldPosition(n); P.getWorldPosition(p);
      const body = n.distanceTo(p) || 1e-6;
      const s = toScreen(h);
      return {
        neckToHead: +(h.distanceTo(n) / body).toFixed(3),   /* ~0.3-0.6 is sane */
        screen: [Math.round(s.x), Math.round(s.y)],
        onScreen: s.x > 0 && s.x < stage.clientWidth && s.y > 0 && s.y < stage.clientHeight,
      };
    },
    get anchorsScreen() {
      if (!anchors) return null;
      return anchors.map(function (v) { const s = toScreen(v); return [s.x, s.y]; });
    },
    get solved() { return anchors ? anchors.map(function (v) { return [+v.x.toFixed(3), +v.y.toFixed(3)]; }) : null; },
    get where() { return { pos: [+trajectoryGroup.position.x.toFixed(3), +trajectoryGroup.position.y.toFixed(3)], scale: +trajectoryGroup.scale.x.toFixed(3), bounds: screenBounds(), pxw: +pxPerWorld().toFixed(2), fr: +frustum().toFixed(3) }; },
    get progress() { return progress; },
    get checkpoint() { return state.checkpoint; },
    get mounted() { return state.mounted; },
    /* the two numbers that decide the silhouette, exposed so they can be
       judged against the plate instead of guessed */
    setTilt: function (deg) {
      if (deg != null) TILT.deg = deg;
      apply(progress);
      orientationGroup.quaternion.copy(qPose);
      renderer.render(scene, camera);
    },

    /* Strip the scene back to the body alone — no swim cycle, no pointer, no
       water — so the base attitude can be judged with nothing moving in front
       of it. This is a review switch, not a runtime state. */
    freeze: function (on) {
      state.frozen = !!on;
      water.visible = !on;
      if (on) {
        off.x = off.y = 0; aim.yaw = aim.pitch = aim.roll = 0;
        drag.yaw = drag.pitch = drag.vYaw = drag.vPitch = 0;
        pointerOffsetGroup.position.set(0, 0, 0);
        orientationGroup.quaternion.copy(qPose);
        /* the pose is normally re-asserted every frame inside the loop, and
           freezing stops the loop — so without this the still shows the raw
           clip, knees and elbows thrown wide, which is not what ships */
        for (let i = 0; i < calm.length; i++) calm[i].bone.quaternion.copy(calm[i].pose);
      }
      renderer.render(scene, camera);
    },
    bounds: function () {
      if (!model) return null;
      const b = new THREE.Box3().setFromObject(model);
      let l = 1e9, r = -1e9, t = 1e9, bo = -1e9;
      const v = new THREE.Vector3();
      for (let i = 0; i < 8; i++) {
        /* already world space — localToWorld here would transform it twice */
        v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z)
          .project(camera);
        const x = (v.x + 1) / 2 * 100, y = (1 - v.y) / 2 * 100;
        l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); bo = Math.max(bo, y);
      }
      return { l: +l.toFixed(1), r: +r.toFixed(1), t: +t.toFixed(1), b: +bo.toFixed(1) };
    },
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else { boot(); }
