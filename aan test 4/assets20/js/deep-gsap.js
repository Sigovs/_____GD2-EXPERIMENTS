/* GD2 — scene 2, the 2.5D ocean. index6.html only.

   The alternative to the WebGL diver, and the argument for it is cost: no
   renderer, no 900KB of three, no 3.3MB model, no skinned rig to fight. The
   footage is already a real ocean — this adds flat plates over it moving at
   different rates, and the depth comes out of the rates.

   THE ACTOR IS A SLOT, NOT THE SCENE. Everything that makes this a scene —
   the path, the parallax rates, the sonar, the checkpoints, the pointer
   nudge, the occlusion by the near rock — is written against a box that
   travels, and knows nothing about what is drawn inside it. ?actor=rov and
   ?actor=diver put different artwork in the same box, at the same scroll
   positions, so the comparison is between two subjects and not between two
   scenes. In debug the two can be swapped live without touching the scroll,
   which is the only way to judge them against the same frame.

   ONE TIMELINE, NO SECOND PIN. The section is already sticky and already has a
   scroll length; this attaches to it and creates nothing of its own.

   MOTIONPATHPLUGIN IS NOT VENDORED HERE and no CDN was added for it — the
   path is evaluated in this file with a Catmull-Rom, driven by one scrubbed
   proxy. Reported rather than quietly fetched.

   EVERYTHING VISIBLE IS A PLACEHOLDER. The rocks are generated SVG and both
   actors are proxies — enough to judge scale, path, timing, parallax and
   occlusion, and nothing that should survive into production. Each plate looks
   for a real file at assets20/ocean/plates/<name>.webp and uses it if it is
   there, so a bought asset drops in without touching a line of animation. */
(function () {
  'use strict';

  var SECTION = '.deep';
  var STAGE = '.deep__stage';

  var DEBUG = /[?&]oceanDebug=1/.test(location.search);
  var WANT_ACTOR = (/[?&]actor=(diver|rov)/.exec(location.search) || [, 'rov'])[1];

  /* THE PATH, in fractions of the frame, and it belongs to the SCENE — neither
     actor may have its own. He starts under the bottom-left corner, climbs, and
     finishes inside the lit opening. x is pulled inward as he rises because the
     canyon narrows toward the light: a straight diagonal reads as a slide, this
     reads as a passage. */
  var PATH = [
    { p: 0.00, x: 0.085, y: 1.14, s: 1.00 },
    { p: 0.18, x: 0.150, y: 0.88, s: 0.96 },
    { p: 0.42, x: 0.235, y: 0.645, s: 0.91 },
    { p: 0.68, x: 0.310, y: 0.410, s: 0.86 },
    { p: 0.88, x: 0.372, y: 0.230, s: 0.81 },
    { p: 1.00, x: 0.415, y: 0.105, s: 0.78 },
  ];
  /* one column, no room to wander: the copy owns the full width on a phone, so
     the actor keeps to the band between the intro and the row */
  var PATH_NARROW = [
    { p: 0.00, x: 0.14, y: 0.80, s: 1.00 },
    { p: 0.40, x: 0.30, y: 0.62, s: 0.94 },
    { p: 0.75, x: 0.46, y: 0.48, s: 0.88 },
    { p: 1.00, x: 0.58, y: 0.36, s: 0.84 },
  ];

  var CHECKPOINTS = [0.24, 0.52, 0.78];
  var HYSTERESIS = 0.02;

  /* how far each plane travels against the scroll, as a fraction of the frame */
  var RATE = { far: 0.15, mid: 0.35, near: 0.65 };

  var PTR = { px: 22, deg: 4.5, tau: 0.45 };
  var EDGE_GUARD = 30;          /* px the actor keeps off the reading column */

  /* ======================================================================
     THE ACTORS

     Each one owns only what is true of the artwork: how big it is drawn, how
     much of the path's own heading it should take, and what idles inside it.
     Both are drawn pointing RIGHT in a 0..100 box, so the scene can aim them
     the same way. Nothing below reads the path, the checkpoints or the layers.
     ================================================================== */
  var ACTORS = {
    rov: {
      label: 'ROV',
      size: 15,          /* svh */
      scale: 1,
      /* it holds its attitude: a machine does not pitch with every bend */
      follow: 0.55,
      bank: 1,
      art:
        '<svg viewBox="0 0 100 100" focusable="false">' +
        '<defs><linearGradient id="rovCone" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" stop-color="#7fe6ff" stop-opacity=".55"/>' +
          '<stop offset="1" stop-color="#7fe6ff" stop-opacity="0"/>' +
        '</linearGradient></defs>' +
        '<path class="rov__cone" d="M70 50 L100 24 L100 76 Z"/>' +
        '<rect class="rov__hull" x="26" y="38" width="46" height="24" rx="7"/>' +
        '<rect class="rov__trim" x="33" y="43" width="20" height="7" rx="3"/>' +
        '<rect class="rov__hull" x="20" y="27" width="17" height="11" rx="5"/>' +
        '<rect class="rov__hull" x="20" y="62" width="17" height="11" rx="5"/>' +
        '<g class="rov__prop"><path class="rov__trim" d="M22 32.5 h13 M28.5 29 v7"/></g>' +
        '<g class="rov__prop"><path class="rov__trim" d="M22 67.5 h13 M28.5 64 v7"/></g>' +
        '<circle class="rov__glow" cx="70" cy="44" r="7"/>' +
        '<circle class="rov__glow" cx="70" cy="56" r="7"/>' +
        '<circle class="rov__lamp" cx="70" cy="44" r="2.6"/>' +
        '<circle class="rov__lamp" cx="70" cy="56" r="2.6"/>' +
        '</svg>',
      tick: function (el, dt, t, state) {
        state.spin = (state.spin || 0) + dt * 520;
        var p = el.querySelectorAll('.rov__prop');
        for (var i = 0; i < p.length; i++) p[i].style.transform = 'rotate(' + state.spin + 'deg)';
      },
    },

    diver: {
      label: 'DIVER',
      /* drawn longer than the machine and read as a body, so he needs less box
         to carry the same presence */
      size: 13,
      scale: 1,
      /* a body DOES pitch with the path — that is most of what separates him
         from a machine holding a heading */
      follow: 0.95,
      bank: 0.5,
      art:
        '<svg viewBox="0 0 100 100" focusable="false">' +
        '<g class="dv">' +
        /* trunk, head and tank, drawn swimming to the right */
        '<ellipse class="dv__body" cx="52" cy="50" rx="24" ry="8.5"/>' +
        '<circle class="dv__body" cx="76" cy="47.5" r="7"/>' +
        '<rect class="dv__tank" x="40" y="37" width="20" height="8" rx="4"/>' +
        '<path class="dv__line" d="M69 43 q7 -3 9 2"/>' +
        /* two arms, tucked and bent, held close in front */
        '<path class="dv__limb" d="M64 53 q9 4 14 1"/>' +
        '<path class="dv__limb" d="M63 47 q10 2 15 -2"/>' +
        /* two legs with fins, one leading the other so the kick reads */
        '<g class="dv__leg dv__leg--a">' +
          '<path class="dv__limb" d="M30 51 q-13 3 -20 -2"/>' +
          '<path class="dv__fin" d="M10 49 l-11 -6 l2 10 z"/>' +
        '</g>' +
        '<g class="dv__leg dv__leg--b">' +
          '<path class="dv__limb" d="M30 49 q-13 -4 -21 1"/>' +
          '<path class="dv__fin" d="M9 50 l-12 5 l1 -10 z"/>' +
        '</g>' +
        '</g>' +
        '</svg>',
      tick: function (el, dt, t, state) {
        /* a slow flutter, out of phase between the two legs */
        var w = t * 1.9;
        var a = el.querySelector('.dv__leg--a'), b = el.querySelector('.dv__leg--b');
        if (a) a.style.transform = 'rotate(' + (Math.sin(w) * 7).toFixed(2) + 'deg)';
        if (b) b.style.transform = 'rotate(' + (Math.sin(w + 2.2) * 7).toFixed(2) + 'deg)';
      },
    },
  };

  var NS = 'http://www.w3.org/2000/svg';
  function svg(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    return e;
  }

  /* THE WALLS ARE THE ASSETS THAT ALREADY EXIST, not shapes.
     Generated polygons were a placeholder and a bad one — flat black wedges
     with a hard edge, sitting on a photographic plate. These two were drawn for
     exactly this job earlier in the project:

       left.webp   727x1799, from "left cover test.png"
       right.webp  1023x1824, from "right cover test.png"

     Neither is mirrored. Each already carries its soft edge on its INNER side
     — the left one fades on its right, the right one on its left — so the
     lighting stays true to the side it was drawn for and no CSS mask is needed
     to blend them. Only their height is ever set; the width follows from the
     file, so they cannot be distorted. */
  var WALLS = {
    near: { src: 'assets20/ocean/plates/left.webp',  side: 'l', h: 1.14, show: 0.30 },
    mid:  { src: 'assets20/ocean/plates/right.webp', side: 'r', h: 1.06, show: 0.30 },
  };

  function boot() {
    var section = document.querySelector(SECTION);
    var stage = document.querySelector(STAGE);
    if (!section || !stage || !window.gsap || !window.ScrollTrigger) return;
    if (stage.querySelector('.ocean')) return;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    var narrow = window.matchMedia('(max-width: 62rem)');
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)');

    /* ---- layers ---------------------------------------------------------- */
    var ocean = document.createElement('div');
    ocean.className = 'ocean' + (DEBUG ? ' ocean--debug' : '');
    ocean.setAttribute('aria-hidden', 'true');

    var far = document.createElement('div'); far.className = 'ocean__far';
    var mid = document.createElement('div'); mid.className = 'ocean__mid';
    var near = document.createElement('div'); near.className = 'ocean__near';
    var actorEl = document.createElement('div'); actorEl.className = 'ocean__actor';
    var dust = document.createElement('div'); dust.className = 'ocean__dust';

    /* Each wall lives inside a clip that is exactly the video column wide, so
       it can bleed off its own side and still be physically unable to reach
       the reading column. That is the guarantee, not a margin someone has to
       remember to keep. */
    var wallEls = {};
    Object.keys(WALLS).forEach(function (k) {
      var w = WALLS[k];
      var clip = document.createElement('div');
      clip.className = 'ocean__clip';
      var img = document.createElement('img');
      img.className = 'ocean__wall ocean__wall--' + w.side;
      img.src = w.src;
      img.alt = '';
      img.decoding = 'async';
      img.loading = 'lazy';
      clip.appendChild(img);
      (k === 'mid' ? mid : near).appendChild(clip);
      wallEls[k] = img;
      img.addEventListener('load', function () { measure(); place(prog); });
    });

    var ping = svg('svg', { class: 'ocean__ping', preserveAspectRatio: 'none' });
    var rings = [];
    for (var r = 0; r < 3; r++) {
      var c = svg('circle', { class: 'ping__r', r: 10, cx: 0, cy: 0 });
      ping.appendChild(c); rings.push(c);
    }

    var pathDbg = svg('svg', { class: 'ocean__path', preserveAspectRatio: 'none' });
    var pathLine = svg('path', {});
    pathDbg.appendChild(pathLine);
    var pathDots = [];

    /* ORDER IS THE ARGUMENT: the near rock goes in AFTER the actor, so it can
       pass in front of it. Something never occluded reads as a sticker on the
       video however well it is drawn. */
    ocean.appendChild(far);
    ocean.appendChild(mid);
    ocean.appendChild(actorEl);
    ocean.appendChild(near);
    ocean.appendChild(ping);
    ocean.appendChild(dust);
    ocean.appendChild(pathDbg);

    var media = stage.querySelector('.deep__media');
    if (media && media.nextSibling) stage.insertBefore(ocean, media.nextSibling);
    else stage.appendChild(ocean);

    /* ---- the actor slot -------------------------------------------------- */
    var actorName = ACTORS[WANT_ACTOR] ? WANT_ACTOR : 'rov';
    var actor = ACTORS[actorName];
    var actorState = {};

    function mountActor(name) {
      actorName = ACTORS[name] ? name : 'rov';
      actor = ACTORS[actorName];
      actorState = {};
      actorEl.className = 'ocean__actor ocean__actor--' + actorName;
      actorEl.style.width = actor.size + 'svh';
      actorEl.style.height = actor.size + 'svh';
      actorEl.innerHTML = actor.art;
      measure();
      place(prog);
      if (DEBUG) hud();
    }

    /* ---- dust ------------------------------------------------------------ */
    var motes = [];
    if (!reduced.matches) {
      var N = narrow.matches ? 16 : 34;
      for (var i = 0; i < N; i++) {
        var el = document.createElement('i');
        var sz = 1 + Math.random() * 2.6;
        el.style.width = sz.toFixed(1) + 'px';
        el.style.height = sz.toFixed(1) + 'px';
        dust.appendChild(el);
        motes.push({ el: el, x: Math.random(), y: Math.random(),
                     v: 0.006 + Math.random() * 0.02, s: Math.random() * 6.28,
                     o: 0.15 + Math.random() * 0.5 });
      }
    }


    /* ---- geometry -------------------------------------------------------- */
    var keys = narrow.matches ? PATH_NARROW : PATH;
    var divider = 0.52, box = { w: 1, h: 1 }, actorSize = 1;
    var ringAt = [];

    function measure() {
      box.w = stage.clientWidth || 1;
      box.h = stage.clientHeight || 1;
      var say = document.querySelector('.deep__say');
      if (say && !narrow.matches) divider = say.getBoundingClientRect().left / box.w;
      actorSize = actorEl.offsetWidth || 1;

      /* checkpoint positions come from the DOM, never from constants, and are
         re-read here so a resize cannot leave them stale */
      var sr = stage.getBoundingClientRect();
      ringAt = [].slice.call(document.querySelectorAll('.feat__ring')).map(function (n) {
        var q = n.getBoundingClientRect();
        return { x: q.left + q.width / 2 - sr.left, y: q.top + q.height / 2 - sr.top };
      });
      layoutWalls();
      drawDebugPath();
    }

    /* Height is the only dimension set; the width comes from the file, so the
       aspect is the asset's own and nothing can squash it. The offset is
       whatever leaves `show` of the column visible — computed, not guessed, so
       it holds at any width, and the clip makes reaching the copy impossible
       rather than merely unlikely. */
    function layoutWalls() {
      var colW = (narrow.matches ? 1 : divider) * box.w;
      [].slice.call(ocean.querySelectorAll('.ocean__clip')).forEach(function (c) {
        c.style.width = colW.toFixed(1) + 'px';
      });
      Object.keys(WALLS).forEach(function (k) {
        var w = WALLS[k], img = wallEls[k];
        if (!img || !img.naturalWidth) return;
        var h = box.h * w.h;
        var natural = img.naturalWidth / img.naturalHeight;
        img.style.height = h.toFixed(1) + 'px';
        img.style.width = 'auto';
        img.style[w.side === 'l' ? 'left' : 'right'] =
          (-(h * natural - colW * w.show)).toFixed(1) + 'px';
      });
    }

    /* Catmull-Rom through the keys. Written out because MotionPathPlugin is not
       vendored and this page does not add a CDN for it. */
    function at(p) {
      var t = Math.max(0, Math.min(1, p));
      var i = 0;
      while (i < keys.length - 2 && t > keys[i + 1].p) i++;
      var a = keys[i], b = keys[i + 1];
      var f = (t - a.p) / ((b.p - a.p) || 1);
      var p0 = keys[Math.max(0, i - 1)], p3 = keys[Math.min(keys.length - 1, i + 2)];
      function cr(v0, v1, v2, v3, u) {
        var u2 = u * u, u3 = u2 * u;
        return 0.5 * ((2 * v1) + (-v0 + v2) * u +
               (2 * v0 - 5 * v1 + 4 * v2 - v3) * u2 +
               (-v0 + 3 * v1 - 3 * v2 + v3) * u3);
      }
      var x = cr(p0.x, a.x, b.x, p3.x, f);
      var y = cr(p0.y, a.y, b.y, p3.y, f);
      var s = cr(p0.s, a.s, b.s, p3.s, f) * actor.scale;
      /* it may never reach the copy: its own half-width plus a guard. The rule
         is the scene's, so it holds whichever actor is in the slot. */
      var half = (actorSize * s / 2 + EDGE_GUARD) / box.w;
      var lim = (narrow.matches ? 1 : divider) - half;
      return { x: Math.min(x, lim), y: y, s: s };
    }

    function drawDebugPath() {
      if (!DEBUG) return;
      var d = '', i;
      for (i = 0; i <= 60; i++) {
        var q = at(i / 60);
        d += (i ? ' L' : 'M') + (q.x * box.w).toFixed(1) + ',' + (q.y * box.h).toFixed(1);
      }
      pathLine.setAttribute('d', d);
      pathDots.forEach(function (c) { c.remove(); });
      pathDots = CHECKPOINTS.map(function (cp2) {
        var q = at(cp2);
        var c = svg('circle', { r: 4, cx: (q.x * box.w).toFixed(1), cy: (q.y * box.h).toFixed(1) });
        pathDbg.appendChild(c);
        return c;
      });
    }

    /* ---- state ----------------------------------------------------------- */
    var prog = 0, cp = -1;
    var aim = { x: 0, y: 0, rot: 0 };
    var want = { x: 0, y: 0, rot: 0 };

    function place(p) {
      var q = at(p);
      var nxt = at(Math.min(1, p + 0.02));
      var dx = (nxt.x - q.x) * box.w, dy = (nxt.y - q.y) * box.h;
      /* how much of the heading the actor takes is the ACTOR's business; the
         heading itself is the scene's */
      var rot = Math.atan2(dy, dx) * 180 / Math.PI * actor.follow;

      gsap.set(actorEl, {
        x: q.x * box.w - actorSize / 2 + aim.x,
        y: q.y * box.h - actorSize / 2 + aim.y,
        rotation: rot + aim.rot * actor.bank,
        scale: q.s,
      });

      gsap.set(far,  { y: -p * RATE.far * box.h * 0.4 });
      gsap.set(mid,  { y: -p * RATE.mid * box.h * 0.4, x: p * 0.02 * box.w });
      gsap.set(near, { y: -p * RATE.near * box.h * 0.4, x: -p * 0.05 * box.w });
    }

    /* ---- sonar ----------------------------------------------------------- */
    function pulse(i) {
      var el = rings[i % rings.length];
      var q = at(prog);
      el.setAttribute('cx', (q.x * box.w + aim.x).toFixed(1));
      el.setAttribute('cy', (q.y * box.h + aim.y).toFixed(1));
      gsap.killTweensOf(el);
      gsap.fromTo(el,
        { attr: { r: actorSize * 0.35 }, opacity: 0.75 },
        { attr: { r: actorSize * 2.6 }, opacity: 0, duration: 1.5, ease: 'power2.out' });
    }

    /* the accordion is driven through its own button — the one surface it
       exposes — so aria, the reserve that stops the row jumping, and manual
       clicking all keep working exactly as they do on index.html */
    function setChapter(p) {
      var n = -1;
      for (var i = 0; i < CHECKPOINTS.length; i++) {
        var edge = CHECKPOINTS[i] + (cp >= i ? -HYSTERESIS : HYSTERESIS);
        if (p >= edge) n = i;
      }
      if (n === cp) return;
      var forward = n > cp;
      cp = n;
      var items = document.querySelectorAll('.feat');
      var target = items[Math.max(0, n)];
      if (target) {
        var btn = target.querySelector('.feat__btn');
        if (btn && !target.hasAttribute('data-open')) btn.click();
      }
      if (n >= 0 && forward && !reduced.matches) pulse(n);
      if (DEBUG) hud();
    }

    /* ---- the one timeline ------------------------------------------------ */
    var proxy = { p: 0 };
    var master = gsap.timeline({
      scrollTrigger: {
        id: 'ocean',
        trigger: SECTION,
        /* THE BRIEF SAID 'top top' AND THAT IS WRONG FOR THIS DOM. .deep carries
           a -180svh margin so it can slide under the hero during the mountain
           dissolve, which means its top clears the viewport top long before the
           water owns the screen — measured, 45% of the timeline was spent
           before there was anything to look at, and the actor did nearly half
           its travel unseen. This starts where the water actually takes the
           frame, which is the same boundary deep.js draws the route across, so
           the two agree. No new pin and no new scroll length: it is the
           section's own. */
        start: function () { return 'top top-=' + Math.round(window.innerHeight * 0.9); },
        end: 'bottom bottom',
        scrub: 1.6,
        invalidateOnRefresh: true,
        markers: DEBUG,
        onUpdate: function (self) {
          prog = self.progress;
          setChapter(prog);
          if (DEBUG) hud();
        },
      },
    });
    master.to(proxy, {
      p: 1, ease: 'none',
      onUpdate: function () { if (!reduced.matches) place(proxy.p); },
    });

    /* ---- pointer, and only a nudge --------------------------------------- */
    function onMove(e) {
      if (!fine.matches || narrow.matches || reduced.matches) return;
      var r = stage.getBoundingClientRect();
      var nx = (e.clientX - r.left) / r.width;
      var ny = (e.clientY - r.top) / r.height;
      if (nx >= divider) { want.x = want.y = want.rot = 0; return; }
      var q = at(prog);
      want.x = gsap.utils.clamp(-PTR.px, PTR.px, (nx - q.x) * r.width * 0.25);
      want.y = gsap.utils.clamp(-PTR.px, PTR.px, (ny - q.y) * r.height * 0.25);
      want.rot = gsap.utils.clamp(-PTR.deg, PTR.deg, (ny - q.y) * 40);
    }
    function onLeave() { want.x = want.y = want.rot = 0; }
    if (fine.matches) {
      stage.addEventListener('pointermove', onMove, { passive: true });
      stage.addEventListener('pointerleave', onLeave, { passive: true });
    }

    /* ---- frame loop ------------------------------------------------------ */
    var last = 0, raf = 0, running = false;
    function tick(time) {
      var dt = last ? Math.min(0.05, (time - last) / 1000) : 0.016;
      last = time;
      if (!reduced.matches) {
        var k = 1 - Math.exp(-dt / PTR.tau);
        aim.x += (want.x - aim.x) * k;
        aim.y += (want.y - aim.y) * k;
        aim.rot += (want.rot - aim.rot) * k;
        place(prog);
        if (actor.tick) actor.tick(actorEl, dt, time / 1000, actorState);
        for (var m = 0; m < motes.length; m++) {
          var d = motes[m];
          d.y -= d.v * dt * 6;
          if (d.y < -0.05) { d.y = 1.05; d.x = Math.random(); }
          var wob = Math.sin(time / 1000 * 0.7 + d.s) * 0.006;
          d.el.style.transform = 'translate3d(' + ((d.x + wob) * box.w).toFixed(1) + 'px,' +
                                 (d.y * box.h).toFixed(1) + 'px,0)';
          d.el.style.opacity = d.o;
        }
      }
      raf = requestAnimationFrame(tick);
    }
    var io = new IntersectionObserver(function (e) {
      if (e[0].isIntersecting) {
        if (!running) { running = true; last = 0; raf = requestAnimationFrame(tick); }
      } else { running = false; cancelAnimationFrame(raf); }
    }, { rootMargin: '10% 0px' });
    io.observe(stage);

    /* ---- debug hud, and the switch that makes the comparison fair -------- */
    var hudEl = null;
    function hud() {
      if (!DEBUG) return;
      if (!hudEl) {
        hudEl = document.createElement('div');
        hudEl.className = 'ocean-hud';
        document.body.appendChild(hudEl);
        hudEl.addEventListener('click', function (e) {
          var b = e.target.closest('[data-act]');
          if (b) mountActor(b.getAttribute('data-act'));
        });
      }
      var q = at(prog);
      hudEl.innerHTML =
        '<b>ocean 2.5D</b>' +
        'actor <s>' + actor.label + '</s><br>' +
        'progress <s>' + prog.toFixed(3) + '</s><br>' +
        'chapter <s>' + (cp < 0 ? '—' : '0' + (cp + 1)) + '</s><br>' +
        'x <s>' + (q.x * 100).toFixed(1) + '%</s><br>' +
        'y <s>' + (q.y * 100).toFixed(1) + '%</s><br>' +
        'scale <s>' + q.s.toFixed(3) + '</s><br>' +
        'divider <s>' + (divider * 100).toFixed(1) + '%</s>' +
        /* swapping in place, at the scroll position already on screen: the two
           concepts get judged against the same frame instead of two reloads */
        '<p class="ocean-hud__sw">' +
          '<button data-act="rov"' + (actorName === 'rov' ? ' data-on' : '') + '>ROV</button>' +
          '<button data-act="diver"' + (actorName === 'diver' ? ' data-on' : '') + '>DIVER</button>' +
        '</p>';
    }
    if (DEBUG) {
      window.addEventListener('keydown', function (e) {
        if (e.key === 'a' || e.key === 'A') mountActor(actorName === 'rov' ? 'diver' : 'rov');
      });
    }

    var rt = 0;
    function onResize() {
      clearTimeout(rt);
      rt = setTimeout(function () { measure(); place(prog); ScrollTrigger.refresh(); }, 160);
    }
    window.addEventListener('resize', onResize, { passive: true });

    mountActor(actorName);
    place(reduced.matches ? 0.55 : 0);
    if (DEBUG) hud();

    window.__gd2Ocean = {
      get progress() { return prog; },
      get chapter() { return cp; },
      get actor() { return actorName; },
      setActor: mountActor,
      get divider() { return divider; },
      get pos() { var q = at(prog); return { x: q.x, y: q.y, s: q.s }; },
      get rect() {
        var a = actorEl.getBoundingClientRect(), sr = stage.getBoundingClientRect();
        return { l: a.left - sr.left, r: a.right - sr.left,
                 t: a.top - sr.top, b: a.bottom - sr.top };
      },
      dispose: function () {
        cancelAnimationFrame(raf); io.disconnect();
        window.removeEventListener('resize', onResize);
        stage.removeEventListener('pointermove', onMove);
        stage.removeEventListener('pointerleave', onLeave);
        master.scrollTrigger && master.scrollTrigger.kill();
        master.kill(); ocean.remove();
        if (hudEl) hudEl.remove();
        delete window.__gd2Ocean;
      },
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else { boot(); }
})();
