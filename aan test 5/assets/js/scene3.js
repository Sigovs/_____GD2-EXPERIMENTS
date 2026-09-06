/* =============================================================================
   GD2 — index3 · choreography

   ORDER OF EVENTS, AND WHY IT IS THIS ORDER

   The path owns the first half. It is drawn from the summit downward over most
   of the scroll, it is never faded out, and it is still on the rock when the
   journey ends. Only after it has completed and been held for a beat does the
   near ground begin to move — so the takeover reads as the consequence of a
   finished journey rather than as an effect that interrupts one.

   The route is two visible runs of ONE curve. The scroll positions between them
   are the time the traveller spends behind the ridge, so the line goes, time
   passes, and it returns lower still travelling the way it was.

   The descent itself is one transform on a column two viewport-heights tall.
   The mountain leaves through the top because it is above; the canyon arrives
   from the bottom because it is below. Nothing crossfades, and the near ground
   — a nearer object, on its own faster rate — passes the lens between them.
   ========================================================================== */
(function () {
  'use strict';
  document.documentElement.classList.remove('no-js');
  if (!window.gsap) return;

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  gsap.registerPlugin(ScrollTrigger);
  var hasDraw = typeof DrawSVGPlugin !== 'undefined';
  if (hasDraw) gsap.registerPlugin(DrawSVGPlugin);

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };

  var frame = $('#frame'), col = $('#col'), fg = $('#fg'),
      lSky = $('#lSky'), lMtn = $('#lMtn'), exposure = $('#exposure'),
      marks = $('#marks'), copy = $('#copy'), cue = $('#cue'),
      media = $('#waterMedia'), video = $('#canyon');

  var SPANS = window.ROUTE_SPANS || [];
  var pairs = SPANS.map(function (s, i) {
    return { els: [$('#runHalo' + i), $('#run' + i)], t0: s[0], t1: s[1] };
  });
  var SIGS = $$('.sig');
  var segAll = $$('.route .seg');

  /* a signal sits beside its own point on the rock, on whichever side has room */
  function placeSignals() {
    $$('.anchor[data-sig]').forEach(function (a) {
      var el = $(a.getAttribute('data-sig'));
      if (!el) return;
      var m = a.getScreenCTM(); if (!m) return;
      var cx = +a.getAttribute('cx'), cy = +a.getAttribute('cy');
      var x = cx * m.a + cy * m.c + m.e, y = cx * m.b + cy * m.d + m.f;
      var fr = frame.getBoundingClientRect();
      var w = el.offsetWidth || 280, h = el.offsetHeight || 56;
      var px = x - fr.left, py = y - fr.top;
      var right = px > fr.width * 0.52;          /* push outward, into the dark air */
      el.classList.toggle('is-left', !right);
      el.classList.toggle('is-right', right);
      var lx = right ? px + 46 : px - w - 46;
      el.style.left = Math.max(16, Math.min(lx, fr.width - w - 16)) + 'px';
      el.style.top = Math.max(88, Math.min(py - h / 2, fr.height - h - 30)) + 'px';
    });
  }

  function setStart() {
    gsap.set(exposure, { opacity: 0 });
    gsap.set(col, { yPercent: 0 });
    gsap.set(lSky, { scale: 1.03, yPercent: 0, opacity: 1 });
    gsap.set(lMtn, { scale: 1.0, yPercent: 0, filter: 'blur(0px)', opacity: 1 });
    gsap.set(fg, { scale: 1, yPercent: 0, filter: 'blur(0px)', opacity: 1 });
    gsap.set(copy, { opacity: 1, yPercent: 0 });
    gsap.set('.copy h1 .ln > span', { yPercent: 0 });
    gsap.set('.copy .lede', { opacity: 1 });
    gsap.set('.copy .rule', { scaleX: 1 });
    gsap.set(marks, { opacity: 1 });
    gsap.set(SIGS, { opacity: 0, y: 8 });
    gsap.set('.route .anchor', { opacity: 0, scale: 0, transformOrigin: '50% 50%' });
    if (hasDraw) gsap.set(segAll, { drawSVG: '0%' });
    else gsap.set(segAll, { opacity: 0 });
  }

  function setRest() {
    setStart();
    gsap.set('.route .anchor', { opacity: 1, scale: 1 });
    if (hasDraw) gsap.set(segAll, { drawSVG: '100%' });
    else gsap.set(segAll, { opacity: 1 });
    placeSignals();
    gsap.set(SIGS, { opacity: 1, y: 0 });
  }

  if (reduce) { setRest(); gsap.set(cue, { opacity: 0 }); return; }

  /* =========================================================================
     ON-LOAD INTRO — one event of light, camera and depth
     ====================================================================== */
  setStart();
  var intro = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
  intro
    .set(exposure, { opacity: .58 })
    .set(lSky, { scale: 1.10 })
    .set(lMtn, { scale: 1.055, yPercent: 1.3 })
    .set(fg, { scale: 1.09, yPercent: 2.2, filter: 'blur(12px)' })
    .set(marks, { opacity: 0 })
    .set('.copy h1 .ln > span', { yPercent: 106 })
    .set('.copy .lede', { opacity: 0 })
    .set('.copy .rule', { scaleX: 0 })
    .set(cue, { opacity: 0 })
    .to(exposure, { opacity: 0, duration: 1.3, ease: 'power1.inOut' }, 0)
    .to(lSky, { scale: 1.03, duration: 1.65 }, 0)
    .to(lMtn, { scale: 1.0, yPercent: 0, duration: 1.65 }, 0)
    /* the near ground resolves last */
    .to(fg, { scale: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.55 }, .16)
    .to('.copy h1 .ln > span', { yPercent: 0, duration: .84, stagger: .075 }, .40)
    .to('.copy .lede', { opacity: 1, duration: .6 }, .80)
    .to('.copy .rule', { scaleX: 1, duration: .55 }, .88)
    /* attention lands where the route begins */
    .to(marks, { opacity: 1, duration: .3 }, .98)
    .to('#anchor0', { opacity: 1, scale: 1, duration: .42, ease: 'back.out(1.8)' }, 1.06)
    .to(cue, { opacity: 1, duration: .4 }, 1.32);

  var done = false;
  function endIntro(instant) {
    if (done) return; done = true;
    if (instant) { intro.progress(1); intro.kill(); }
    setStart();
    gsap.set('#anchor0', { opacity: 1, scale: 1 });
    gsap.set(cue, { opacity: 1 });
  }
  intro.eventCallback('onComplete', function () { endIntro(false); });
  intro.play();
  function yieldNow() { if (!done && window.scrollY > 2) endIntro(true); }
  ['scroll', 'wheel', 'touchstart'].forEach(function (e) {
    addEventListener(e, yieldNow, { passive: true });
  });

  /* =========================================================================
     THE SCROLL
     ====================================================================== */
  var tl = gsap.timeline({
    scrollTrigger: { trigger: '#film', start: 'top top', end: 'bottom bottom',
                     scrub: .62, invalidateOnRefresh: true }
  });
  tl.to({ s: 0 }, { s: 1, duration: 1, ease: 'none' }, 0);   /* spine: positions == progress */
  tl.to(cue, { opacity: 0, duration: .03, ease: 'none' }, .015);

  /* --- 0.05 → 0.46 : the descent is drawn ------------------------------- */
  var A0 = .05, A1 = .46, at = function (t) { return A0 + (A1 - A0) * t; };
  pairs.forEach(function (p) {
    var a = at(p.t0), b = at(p.t1);
    if (hasDraw) tl.to(p.els, { drawSVG: '100%', duration: b - a, ease: 'none' }, a);
    else tl.to(p.els, { opacity: 1, duration: .01, ease: 'none' }, a);
  });

  /* --- two signals, each reached by the path, never both at once --------- */
  var MOM = [{ t: .12, a: '#anchor1', s: '#sig0' }, { t: .55, a: '#anchor2', s: '#sig1' }];
  MOM.forEach(function (m, i) {
    var s = at(m.t);
    tl.to(m.a, { opacity: 1, scale: 1, duration: .012, ease: 'power2.out' }, s)
      .to(m.s, { opacity: 1, y: 0, duration: .03, ease: 'power2.out' }, s + .012);
    var out = (i < MOM.length - 1) ? at(MOM[i + 1].t) - .05 : .48;
    tl.to(m.s, { opacity: 0, y: -5, duration: .025, ease: 'none' }, Math.max(s + .06, out));
  });

  /* --- the world breathes while the route is drawn ----------------------- */
  tl.to(lSky, { yPercent: -1.8, ease: 'none', duration: .45 }, .04)
    .to(lMtn, { yPercent: -5.2, scale: 1.035, ease: 'none', duration: .45 }, .04)
    .to(fg,   { yPercent: -1.4, scale: 1.05, ease: 'none', duration: .45 }, .04);

  /* --- 0.46 → 0.52 : the finished journey is held, then the words clear --- */
  tl.to(copy, { yPercent: -10, opacity: 0, ease: 'none', duration: .06 }, .47);

  /* --- 0.53 → 0.64 : the near ground comes at the lens -------------------
     The route is NOT faded. The foreground simply gets in front of it. */
  tl.to(fg, { scale: 2.2, yPercent: -9, filter: 'blur(13px)', ease: 'none', duration: .11 }, .53)
    .to(lMtn, { filter: 'blur(6px)', ease: 'none', duration: .11 }, .55);

  /* --- 0.60 → 0.92 : the camera descends -------------------------------- */
  tl.to(col, { yPercent: -50, ease: 'none', duration: .31 }, .555);
  /* the mountain is far, so it lags and stays in frame while the water arrives */
  tl.to(lMtn, { yPercent: 12, ease: 'none', duration: .31 }, .555)
    .to(lSky, { yPercent: 7, ease: 'none', duration: .31 }, .555);

  /* --- 0.60 → 0.72 : it passes the lens and clears the frame ------------- */
  tl.to(fg, { scale: 2.9, yPercent: -180, filter: 'blur(20px)', ease: 'none', duration: .06 }, .59)
    .to(fg, { yPercent: -228, opacity: 0, ease: 'none', duration: .03 }, .626);

  /* =========================================================================
     THE FOOTAGE CLOCK — scroll says when, nothing says how
     ====================================================================== */
  var armed = false, started = false;
  ScrollTrigger.create({
    trigger: '#film', start: 'top top', end: 'bottom bottom',
    onUpdate: function (self) {
      var p = self.progress;
      if (!armed && p > .30) { armed = true; video.preload = 'auto'; try { video.load(); } catch (e) {} }
      if (!started && p > .58) {
        started = true;
        var q = video.play(); if (q && q.catch) q.catch(function () {});
        media.classList.add('is-playing');
      }
      if (started && p < .54 && !video.paused) video.pause();
      else if (started && p >= .58 && video.paused) video.play().catch(function () {});
    }
  });

  function refresh() { ScrollTrigger.refresh(); placeSignals(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh).catch(function () {});
  addEventListener('load', refresh, { once: true });
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(refresh, 180); });
  placeSignals();

  window.__film = { tl: tl, intro: intro, endIntro: endIntro, place: placeSignals };
})();
