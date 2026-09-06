/* =============================================================================
   GD2 — index1 · one continuous shot, two environments

   THE WHOLE FILM IS ONE SCRUBBED TIMELINE ON ONE PIN.
   Two pinned sections would put a boundary exactly where the shot must not have
   one. The mountain layers and the water layer are siblings inside a single
   sticky frame; the near ridge is the only thing that changes what you are
   looking at.

   THE RIDGE IS THE TRANSITION, NOT A CROSSFADE.
   It rises a little and grows a lot, keeps its density, and goes into optical
   blur. A large rise would bare the bottom of the frame and leave a stoppable
   frame with nothing in it; a small rise with a large scale keeps the frame
   full the whole way through. The water resolves INSIDE that blur, underneath
   the ridge, so the ridge is still in front of the water while the water
   arrives. That is what makes it read as passing through the near ground
   rather than as one picture replacing another.

   THE FOOTAGE OWNS ITSELF.
   Scroll decides WHEN the water starts. Nothing decides how it runs. Mapping
   currentTime onto scroll turns the wheel into a transport control and freezes
   the water the moment the reader stops, which is the opposite of a place.

   THE ROUTE IS THREE SEGMENTS, NOT ONE CURVE.
   A single bezier over a photograph reads as a decoration lying on top of it.
   The line is authored as polylines with real corners, it breaks where a ridge
   crosses it and picks up lower on a new bearing, and the near-ridge plate sits
   above it in z-order so the plate cuts it — occlusion by compositing rather
   than by a mask. Underwater it is the same stroke continuing downward, not a
   second line starting from zero.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document.documentElement;
  doc.classList.remove('no-js');

  if (!window.gsap) return;                    /* the page still reads without us */
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  gsap.registerPlugin(ScrollTrigger);
  var hasDraw = typeof DrawSVGPlugin !== 'undefined';
  if (hasDraw) gsap.registerPlugin(DrawSVGPlugin);

  var $  = function (s) { return document.querySelector(s); };
  var frame   = $('#frame'),
      lSky    = $('#lSky'),  lMtn = $('#lMtn'), lFg = $('#lFg'),
      lWater  = $('#lWater'), lExp = $('#lExp'),
      marks   = $('#marks'), deepMarks = $('#deepMarks'),
      copy    = $('#copy'),  deepCopy  = $('#deepCopy'), cue = $('#cue'),
      video   = $('#canyon');

  var LEADS = ['#ldA', '#ldB', '#ldC'];
  var COS   = ['#coA', '#coB', '#coC'];
  /* every segment is drawn twice — a dark halo under a light line — so the route
     holds on snow and on sky without putting a scrim over the photograph */
  var ALLSEG = [].slice.call(document.querySelectorAll('.route .seg'));
  var segPairs = (function () {
    var n = [].slice.call(document.querySelectorAll('#marks .route .seg')), out = [];
    for (var i = 0; i < n.length; i += 2) out.push([n[i], n[i + 1]]);
    return out;
  })();
  var deepPair = [].slice.call(document.querySelectorAll('#deepMarks .route .seg'));

  /* ---------------------------------------------------------------------
     A callout is placed where its leader actually ends, measured from the
     live SVG. Hard-coding percentages breaks the link between the anchor on
     the rock and the words the moment the viewport changes shape.
     ------------------------------------------------------------------ */
  function placeCallouts() {
    document.querySelectorAll('.leader[data-co]').forEach(function (ld) {
      var co = document.querySelector(ld.getAttribute('data-co'));
      if (!co) return;
      var m = ld.getScreenCTM(); if (!m) return;
      var pt = ld.getPointAtLength(ld.getTotalLength());
      var x = pt.x * m.a + pt.y * m.c + m.e;
      var y = pt.x * m.b + pt.y * m.d + m.f;
      var fr = frame.getBoundingClientRect();
      var w  = co.offsetWidth || 300, hgt = co.offsetHeight || 60;
      var lx = Math.min(x - fr.left + 14, fr.width - w - 18);
      co.style.left = Math.max(18, lx) + 'px';
      co.style.top  = Math.max(70, Math.min(y - fr.top - hgt / 2, fr.height - hgt - 24)) + 'px';
      co.style.right = 'auto';
    });
  }

  /* -------------------------------------------------------------------------
     The state the scroll starts from. The intro's last frame and the scroll's
     first frame are the same frame, so handing over mid-intro cannot jump.
     ---------------------------------------------------------------------- */
  function setStartState() {
    gsap.set(lExp, { opacity: 0 });
    gsap.set(frame, { '--k': 0 });
    gsap.set(lSky,  { scale: 1.04, yPercent: 0 });
    gsap.set(lMtn,  { scale: 1.00, yPercent: 0 });
    gsap.set(lFg,   { scale: 1.00, yPercent: 0, filter: 'blur(0px)' });
    gsap.set(lWater,{ opacity: 0, visibility: 'hidden', scale: 1.16 });
    gsap.set(copy,  { opacity: 1, yPercent: 0 });
    gsap.set('.copy h1 .ln > span', { yPercent: 0, opacity: 1 });
    gsap.set('.copy .rule', { scaleX: 1 });
    gsap.set(marks, { opacity: 1 });
    gsap.set(deepMarks, { opacity: 0 });
    gsap.set(deepCopy, { opacity: 0, yPercent: 4 });
    gsap.set(COS, { opacity: 0, yPercent: 6 });
    gsap.set('.route .anchor', { opacity: 0, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(lMtn, { filter: 'blur(0px)' });
    if (hasDraw) {
      gsap.set(ALLSEG, { drawSVG: '0%' });
      gsap.set('.route .leader', { drawSVG: '0%' });
    } else {
      gsap.set(ALLSEG.concat(['.route .leader']), { opacity: 0 });
    }
  }

  /* The finished, authored still — used for reduced motion and as the end
     state the intro can be snapped to. */
  function setRestState() {
    setStartState();
    gsap.set(COS, { opacity: 1, yPercent: 0 });
    gsap.set('.route .anchor', { opacity: 1, scale: 1 });
    if (hasDraw) gsap.set(ALLSEG.concat(['.route .leader']), { drawSVG: '100%' });
    else gsap.set(ALLSEG.concat(['.route .leader']), { opacity: 1 });
    placeCallouts();
  }

  /* =========================================================================
     REDUCED MOTION — two authored stills, no pin, no scrub.
     ====================================================================== */
  if (reduce) {
    setRestState();
    gsap.set(cue, { opacity: 0 });
    /* The second still is real markup in the document (see .rm-still), not a
       clone assembled here — a composed frame that stands on its own. */
    return;
  }

  /* =========================================================================
     ON-LOAD INTRO — one event of light, camera and depth.
     It starts from an image that already means something: the sky, the
     mountain's mass and the near ridge are all on screen from the first
     painted frame. What the intro does is open the exposure, settle the
     camera and bring the near ground into focus. Nothing flies in.
     ====================================================================== */
  setStartState();

  var intro = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
  intro
    .set(lExp,  { opacity: .62 })
    .set(lSky,  { scale: 1.10 })
    .set(lMtn,  { scale: 1.055, yPercent: 1.2 })
    .set(lFg,   { scale: 1.10,  yPercent: 2.2, filter: 'blur(12px)' })
    .set(marks, { opacity: 0 })
    .set('.copy h1 .ln > span', { yPercent: 106 })
    .set('.copy .lede', { opacity: 0 })
    .set('.copy .rule', { scaleX: 0 })
    .set(cue, { opacity: 0 })
    /* light first: the frame opens */
    .to(lExp, { opacity: 0, duration: 1.25, ease: 'power1.inOut' }, 0)
    /* then the camera settles — all three planes at different rates, which is
       the depth; the near ground resolves last */
    .to(lSky, { scale: 1.04, duration: 1.6, ease: 'power2.out' }, 0)
    .to(lMtn, { scale: 1.00, yPercent: 0, duration: 1.6, ease: 'power2.out' }, 0)
    .to(lFg,  { scale: 1.00, yPercent: 0, filter: 'blur(0px)', duration: 1.5, ease: 'power2.out' }, .12)
    /* the type belongs to the same event, it does not arrive separately */
    .to('.copy h1 .ln > span', { yPercent: 0, duration: .82, stagger: .075 }, .38)
    .to('.copy .lede', { opacity: 1, duration: .6 }, .78)
    .to('.copy .rule', { scaleX: 1, duration: .55, ease: 'power2.out' }, .86)
    /* attention is handed to the summit, which is where the scroll picks up */
    .to(marks, { opacity: 1, duration: .3 }, .95)
    .to('#ldA .anchor', { opacity: 1, scale: 1, duration: .38, ease: 'back.out(2)' }, 1.02)
    .to(cue, { opacity: 1, duration: .4 }, 1.25);
  /* ~1.65s of real duration; the frame is legible from 0.0s */

  var introDone = false;
  function endIntro(instant) {
    if (introDone) return;
    introDone = true;
    if (instant) { intro.progress(1); intro.kill(); }
    setStartState();                        /* the exact frame scroll begins from */
    gsap.set(cue, { opacity: 1 });
  }
  intro.eventCallback('onComplete', function () { endIntro(false); });
  intro.play();

  /* If the reader scrolls during the intro it yields immediately. Because the
     intro's end state IS the scroll's start state, there is nothing to jump. */
  function yieldToScroll() {
    if (!introDone && window.scrollY > 2) endIntro(true);
  }
  addEventListener('scroll', yieldToScroll, { passive: true });
  addEventListener('wheel', yieldToScroll, { passive: true });
  addEventListener('touchstart', yieldToScroll, { passive: true });

  /* =========================================================================
     THE SCROLL — one scrubbed timeline over one pin.
     ====================================================================== */
  var tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#film',
      start: 'top top',
      end: 'bottom bottom',
      scrub: .55,
      invalidateOnRefresh: true
    }
  });

  /* A spine tween that spans the whole film and does nothing else.
     Without it the timeline's duration is only as long as its last tween ends,
     and every position below — authored as a fraction of the film — would be
     renormalised against that shorter duration, sliding the entire second half
     out of step with the scroll. With it, position 0.83 IS progress 0.83. */
  tl.to({ spine: 0 }, { spine: 1, duration: 1, ease: 'none' }, 0);

  /* --- 0.00 → 0.06 : the composition is held. Nothing moves but the cue. --- */
  tl.to(cue, { opacity: 0, duration: .04, ease: 'none' }, .02);

  /* --- 0.03 → 0.40 : the route is drawn by the reader, summit downward ------
     Each segment gets its own span, and the gaps between the spans are the
     ridges: the line is genuinely absent there, then picks up lower. */
  var SPAN = [[.03, .13], [.16, .26], [.29, .40]];
  segPairs.forEach(function (pair, i) {
    var a = SPAN[i][0], b = SPAN[i][1];
    if (hasDraw) tl.to(pair, { drawSVG: '100%', duration: b - a, ease: 'none' }, a);
    else tl.to(pair, { opacity: 1, duration: .02, ease: 'none' }, a);
    /* the anchor lands first, then its leader, then the words */
    tl.to(LEADS[i] + ' .anchor', { opacity: 1, scale: 1, duration: .02, ease: 'power2.out' }, a + (b - a) * .55)
      .to(LEADS[i] + ' .leader', hasDraw ? { drawSVG: '100%', duration: .03, ease: 'none' }
                                         : { opacity: 1, duration: .03 }, a + (b - a) * .62)
      .to(COS[i], { opacity: 1, yPercent: 0, duration: .04, ease: 'power2.out' }, a + (b - a) * .68);
  });
  /* the summit anchor is already lit by the intro; light its leader with segment A */
  tl.to('#ldA .leader', hasDraw ? { drawSVG: '100%', duration: .03, ease: 'none' }
                                : { opacity: 1, duration: .03 }, .05);

  /* --- 0.06 → 0.44 : the world drifts. Different rates ARE the depth. ------ */
  tl.to(lSky, { yPercent: -2.0, ease: 'none', duration: .38 }, .06)
    .to(lMtn, { yPercent: -7.0, scale: 1.035, ease: 'none', duration: .38 }, .06)
    .to(lFg,  { yPercent: -2.0, scale: 1.10,  ease: 'none', duration: .38 }, .06);

  /* --- 0.30 → 0.42 : the words leave before the takeover starts ----------- */
  tl.to(copy, { yPercent: -14, opacity: 0, ease: 'none', duration: .12 }, .30);

  /* --- 0.44 → 0.62 : THE TAKEOVER -----------------------------------------
     The near ridge comes at the camera. Small rise, large growth, density
     kept, focus lost. The route and its callouts go out first so the ridge
     is not carrying type across the seam. */
  tl.to(COS, { opacity: 0, ease: 'none', duration: .05 }, .43)
    .to(marks, { opacity: 0, ease: 'none', duration: .06 }, .44)
    .to(lFg, { yPercent: -13, scale: 3.4, filter: 'blur(46px)', ease: 'none', duration: .22 }, .44)
    /* the mountain behind it keeps moving, so the ridge is passing something,
       and the camera's focus goes with the near ground — not just the plate */
    .to(lMtn, { yPercent: -13, scale: 1.13, filter: 'blur(16px)', ease: 'none', duration: .20 }, .45)
    .to(lSky, { yPercent: -4, filter: 'blur(10px)', ease: 'none', duration: .20 }, .45);

  /* --- 0.50 → 0.66 : the water resolves INSIDE the blur -------------------
     It is under the ridge in z-order, so for the whole of this span the ridge
     is still physically in front of it. No crossfade of two backgrounds. */
  tl.set(lWater, { visibility: 'visible' }, .50)
    .to(lWater, { opacity: 1, scale: 1.0, ease: 'none', duration: .15 }, .525)
    /* the mountain leaves behind the water, not in front of it */
    .to(lMtn, { opacity: 0, ease: 'none', duration: .08 }, .56)
    .to(lSky, { opacity: 0, ease: 'none', duration: .08 }, .56)
    /* the ridge finally clears the frame — by now the water is the picture */
    .to(lFg, { opacity: 0, scale: 3.1, ease: 'none', duration: .12 }, .60);

  /* --- 0.62 → 1.00 : the descent continues, underwater -------------------- */
  tl.to(deepMarks, { opacity: 1, ease: 'none', duration: .04 }, .63);
  if (hasDraw) tl.to(deepPair, { drawSVG: '100%', duration: .26, ease: 'none' }, .64);
  else tl.to(deepPair, { opacity: 1, duration: .04, ease: 'none' }, .64);
  tl.to('#ldD .anchor', { opacity: 1, scale: 1, duration: .03, ease: 'power2.out' }, .80)
    .to('#ldD .leader', hasDraw ? { drawSVG: '100%', duration: .04, ease: 'none' }
                                : { opacity: 1, duration: .04 }, .82)
    /* the first underwater content belongs to the space: it arrives while the
       camera is still moving, anchored to the line, not stacked on the video */
    .to(deepCopy, { opacity: 1, yPercent: 0, duration: .07, ease: 'power2.out' }, .83);

  /* =========================================================================
     THE FOOTAGE CLOCK — scroll starts it, nothing else touches it.
     ====================================================================== */
  var started = false, armed = false;
  function armVideo() {
    if (armed) return; armed = true;
    video.preload = 'auto';
    try { video.load(); } catch (e) {}
  }
  function startVideo() {
    if (started) return; started = true;
    var p = video.play();
    if (p && p.catch) p.catch(function () {});     /* poster stays, frame is complete */
    lWater.classList.add('is-playing');
  }
  ScrollTrigger.create({
    trigger: '#film', start: 'top top', end: 'bottom bottom',
    onUpdate: function (self) {
      if (self.progress > .22) armVideo();
      if (self.progress > .49) startVideo();
      /* leaving the water upward pauses it so it is not running unseen */
      if (started && self.progress < .44 && !video.paused) video.pause();
      else if (started && self.progress >= .49 && video.paused) video.play().catch(function(){});
    }
  });

  /* =========================================================================
     Measurement. Without a refresh after fonts and images the trigger is
     measured against the wrong height and the last third of the film never
     plays.
     ====================================================================== */
  function refresh() { ScrollTrigger.refresh(); placeCallouts(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh).catch(function(){});
  addEventListener('load', refresh, { once: true });
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(refresh, 180); });

  /* a small hook so the checkpoint capture can address exact states */
  placeCallouts();
  window.__film = { tl: tl, intro: intro, endIntro: endIntro, place: placeCallouts };
})();
