/* =============================================================================
   GD2 — index2 · two scenes, one vertical space

   THERE IS NO ROUTE LINE AND NO CALLOUTS IN THIS FILE.
   The generated polyline that used to be here is withdrawn. As a picture it was
   a pale line lassoing a mountain, and under water it was a large bright zigzag
   along the edge of the frame that flattened the depth of the footage. A frame
   with nothing in it but landscape is worth more than a frame with a line that
   explains the movement. The trajectory will be rebuilt separately, from the
   behaviour of aan test 4/index3.html, and judged on its own before anything
   else goes back in.

   WHAT THIS FILE STILL DOES

   The two environments are two panels of one column, two viewport-heights tall,
   with the canyon physically below the mountain. The camera descends by moving
   that column upward: the mountain leaves through the top because it is above,
   the water arrives from the bottom because it is below, and at the middle both
   are on screen with nothing but an edge between them. Neither environment ever
   changes opacity — there is no crossfade anywhere in the film.

   The near ground is deliberately not in the column. It is a nearer object, so
   it moves faster: it comes at the lens, grows, loses focus while staying dense,
   and clears the frame ahead of the world behind it. That difference in rate is
   what makes it read as passing close to the camera.

   The footage owns itself. Scroll decides when the water starts; nothing decides
   how it runs.
   ========================================================================== */
(function () {
  'use strict';
  document.documentElement.classList.remove('no-js');
  if (!window.gsap) return;

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  gsap.registerPlugin(ScrollTrigger);

  var $ = function (s) { return document.querySelector(s); };
  var col = $('#col'), fg = $('#fg'),
      lSky = $('#lSky'), lMtn = $('#lMtn'), exposure = $('#exposure'),
      copy = $('#copy'), cue = $('#cue'),
      media = $('#waterMedia'), video = $('#canyon'), deepCopy = $('#deepCopy');

  /* the frame the scroll begins from — and the frame the intro ends on, so a
     hand-over mid-intro cannot jump */
  function setStart() {
    gsap.set(exposure, { opacity: 0 });
    gsap.set(col, { yPercent: 0 });
    gsap.set(lSky, { scale: 1.04, yPercent: 0, opacity: 1 });
    gsap.set(lMtn, { scale: 1.0, yPercent: 0, filter: 'blur(0px)', opacity: 1 });
    gsap.set(fg, { scale: 1, yPercent: 0, filter: 'blur(0px)', opacity: 1 });
    gsap.set(copy, { opacity: 1, yPercent: 0 });
    gsap.set('.copy h1 .ln > span', { yPercent: 0 });
    gsap.set('.copy .lede', { opacity: 1 });
    gsap.set('.copy .rule', { scaleX: 1 });
    gsap.set(deepCopy, { opacity: 0, y: 12 });
  }

  if (reduce) {
    setStart();
    gsap.set(cue, { opacity: 0 });
    gsap.set(deepCopy, { opacity: 1, y: 0 });
    return;
  }

  /* =========================================================================
     ON-LOAD INTRO — light, camera and depth as one event.
     The first painted frame already carries sky, mountain mass and near ground.
     What the intro does is open the exposure, settle the three planes at
     different rates, and bring the near ground into focus last.
     ====================================================================== */
  setStart();
  var intro = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
  intro
    .set(exposure, { opacity: .60 })
    .set(lSky, { scale: 1.11 })
    .set(lMtn, { scale: 1.06, yPercent: 1.4 })
    .set(fg, { scale: 1.11, yPercent: 2.4, filter: 'blur(13px)' })
    .set('.copy h1 .ln > span', { yPercent: 106 })
    .set('.copy .lede', { opacity: 0 })
    .set('.copy .rule', { scaleX: 0 })
    .set(cue, { opacity: 0 })
    .to(exposure, { opacity: 0, duration: 1.25, ease: 'power1.inOut' }, 0)
    .to(lSky, { scale: 1.04, duration: 1.6 }, 0)
    .to(lMtn, { scale: 1.0, yPercent: 0, duration: 1.6 }, 0)
    .to(fg, { scale: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.5 }, .12)
    .to('.copy h1 .ln > span', { yPercent: 0, duration: .82, stagger: .075 }, .38)
    .to('.copy .lede', { opacity: 1, duration: .6 }, .78)
    .to('.copy .rule', { scaleX: 1, duration: .55 }, .86)
    .to(cue, { opacity: 1, duration: .4 }, 1.25);

  var done = false;
  function endIntro(instant) {
    if (done) return; done = true;
    if (instant) { intro.progress(1); intro.kill(); }
    setStart();
    gsap.set(cue, { opacity: 1 });
  }
  intro.eventCallback('onComplete', function () { endIntro(false); });
  intro.play();
  function yieldNow() { if (!done && window.scrollY > 2) endIntro(true); }
  ['scroll', 'wheel', 'touchstart'].forEach(function (e) {
    addEventListener(e, yieldNow, { passive: true });
  });

  /* =========================================================================
     THE SCROLL — one scrubbed timeline on one pin
     ====================================================================== */
  var tl = gsap.timeline({
    scrollTrigger: { trigger: '#film', start: 'top top', end: 'bottom bottom',
                     scrub: .6, invalidateOnRefresh: true }
  });
  /* a spine that spans the film so every position below is a true fraction of
     it, not a fraction of wherever the last tween happens to end */
  tl.to({ s: 0 }, { s: 1, duration: 1, ease: 'none' }, 0);

  tl.to(cue, { opacity: 0, duration: .03, ease: 'none' }, .015);

  /* --- 0.03 → 0.46 : the mountain is held, and breathes ------------------
     Three planes at three rates. This is the only movement in the first half,
     and it is slow enough that any frame stopped inside it is still a still. */
  tl.to(lSky, { yPercent: -2.2, ease: 'none', duration: .43 }, .03)
    .to(lMtn, { yPercent: -6.5, scale: 1.045, ease: 'none', duration: .43 }, .03)
    .to(fg,   { yPercent: -2.0, scale: 1.09, ease: 'none', duration: .43 }, .03);

  /* the words leave before the takeover begins */
  tl.to(copy, { yPercent: -12, opacity: 0, ease: 'none', duration: .10 }, .36);

  /* --- 0.47 → 0.60 : the near ground comes at the lens ------------------- */
  tl.to(fg, { scale: 2.3, yPercent: -8, filter: 'blur(18px)', ease: 'none', duration: .13 }, .47)
    /* the camera's focus travels with the near ground rather than one plate
       going soft on its own */
    .to(lMtn, { filter: 'blur(7px)', ease: 'none', duration: .13 }, .49);

  /* --- 0.58 → 0.90 : THE CAMERA DESCENDS --------------------------------
     One transform. The column is two viewport-heights of world; moving it up by
     half its height moves the camera down by exactly one viewport. */
  tl.to(col, { yPercent: -50, ease: 'none', duration: .33 }, .555);
  /* the mountain is the far object, so it lags: its mass is still in the frame
     while the water is arriving, and the crossover never empties out */
  tl.to(lMtn, { yPercent: 13, ease: 'none', duration: .33 }, .555)
    .to(lSky, { yPercent: 8, ease: 'none', duration: .33 }, .555);

  /* --- 0.58 → 0.70 : it passes the lens and clears the frame -------------
     Held any longer it is a blurred field with nothing in it, and the world's
     own rock — sharp, and travelling with the column — is a far better thing to
     have above the rising water. */
  tl.to(fg, { scale: 3.2, yPercent: -150, filter: 'blur(30px)', ease: 'none', duration: .09 }, .58)
    .to(fg, { yPercent: -196, opacity: 0, ease: 'none', duration: .04 }, .655);

  /* --- 0.93 → 1.00 : the canyon's first words --------------------------- */
  tl.to(deepCopy, { opacity: 1, y: 0, duration: .05, ease: 'power2.out' }, .93);

  /* =========================================================================
     THE FOOTAGE CLOCK — scroll says when, nothing says how
     ====================================================================== */
  var armed = false, started = false;
  ScrollTrigger.create({
    trigger: '#film', start: 'top top', end: 'bottom bottom',
    onUpdate: function (self) {
      var p = self.progress;
      if (!armed && p > .26) { armed = true; video.preload = 'auto'; try { video.load(); } catch (e) {} }
      if (!started && p > .54) {
        started = true;
        var q = video.play(); if (q && q.catch) q.catch(function () {});
        media.classList.add('is-playing');
      }
      if (started && p < .50 && !video.paused) video.pause();
      else if (started && p >= .54 && video.paused) video.play().catch(function () {});
    }
  });

  function refresh() { ScrollTrigger.refresh(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh).catch(function () {});
  addEventListener('load', refresh, { once: true });
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(refresh, 180); });

  window.__film = { tl: tl, intro: intro, endIntro: endIntro };
})();
