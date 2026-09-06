/* =========================================================================
   GD2 — index5

   Motion is applied per act at the lowest method that does the job (DNA45):

     reveals          IntersectionObserver + a CSS transition. No timeline
                      needed to fade something in once.
     masthead         a scroll listener and one attribute.
     the descent      ScrollTrigger, because it is genuinely scrubbed and
                      pinned — the only place on this page that is.

   The static page is complete without any of this (DNA39): every word is in
   the document, the record reads as a list of fields, and the descent is a
   composed frame. Remove this file and nothing disappears.
   ====================================================================== */
(function () {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- reveals ---------------------------------------------------------
     Once, on first entry. Nothing re-animates on the way back up: an entrance
     replayed on content already read is noise (DNA84). */
  (function reveals() {
    var items = document.querySelectorAll('[data-rise]');
    if (!items.length) return;
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.setAttribute('data-in', ''); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.setAttribute('data-in', '');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  })();

  /* ---- the bar folds, and inverts over the light act --------------------
     A fixed dark glass bar sitting on paper is the one thing act 4 breaks, so
     the bar is told which ground it is over. It is part of the composition,
     not chrome laid on top of it (U10). */
  (function bar() {
    var mh = document.querySelector('.mh');
    var nav = document.querySelector('.mh__nav');
    var burger = document.querySelector('.burger');
    var turn = document.querySelector('.turn');
    if (!mh) return;

    if (nav && burger) {
      var close = function () {
        nav.dataset.open = 'false';
        burger.setAttribute('aria-expanded', 'false');
      };
      burger.addEventListener('click', function () {
        var open = nav.dataset.open === 'true';
        nav.dataset.open = String(!open);
        burger.setAttribute('aria-expanded', String(!open));
      });
      document.addEventListener('click', function (e) { if (!mh.contains(e.target)) close(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    }

    var wasCompact = null, wasLight = null;
    function onScroll() {
      var compact = scrollY > 80;
      if (compact !== wasCompact) {
        wasCompact = compact;
        if (compact) mh.setAttribute('data-compact', '');
        else mh.removeAttribute('data-compact');
      }
      if (turn) {
        var r = turn.getBoundingClientRect();
        var mid = mh.getBoundingClientRect().bottom;
        var light = r.top < mid && r.bottom > mid;
        if (light !== wasLight) {
          wasLight = light;
          document.documentElement.setAttribute('data-bar', light ? 'light' : 'dark');
        }
      }
    }
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

  /* ---- act 3 · the descent ---------------------------------------------
     One primary temporal idea in this viewport (MJ2): the descent. The summit
     dissolves into water, and the record resolves field by field as it goes.

     Not pinned on mobile — the mobile shot list is authored separately
     (DNA44, DNA67): there the act is two stills and the record resolves on
     entry, because a pinned scrub on a phone spends the reader's scroll and
     returns very little.
     ====================================================================== */
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  gsap.matchMedia().add({
    wide:  '(min-width: 62rem) and (prefers-reduced-motion: no-preference)',
    still: '(prefers-reduced-motion: reduce)',
    narrow:'(max-width: 61.999rem) and (prefers-reduced-motion: no-preference)',
  }, function (ctx) {
    var m = ctx.conditions;
    var stage  = document.querySelector('.descent__stage');
    var water  = document.querySelector('.descent__layer--water');
    var video  = water && water.querySelector('video');
    var peak   = document.querySelector('.descent__layer--peak img');
    var rows   = gsap.utils.toArray('[data-field]');
    if (!stage || !water) return;

    var resolve = function (n) {
      rows.forEach(function (row, i) {
        var on = i < n;
        var bar = row.querySelector('.record__bar');
        if (on) row.setAttribute('data-on', ''); else row.removeAttribute('data-on');
        if (bar) bar.style.setProperty('--fill', on ? 1 : 0);
      });
    };

    /* the still: the act has already arrived. Water showing, record resolved,
       nothing waiting on a scroll that will never be scrubbed (DNA43). */
    if (m.still) {
      gsap.set(water, { opacity: 1 });
      resolve(rows.length);
      if (video) video.removeAttribute('preload');
      return;
    }

    var playWater = function () {
      if (!video) return;
      if (!video.getAttribute('src') && video.readyState === 0) video.load();
      var p = video.play(); if (p && p.catch) p.catch(function () {});
    };

    if (m.narrow) {
      /* mobile: no pin. The water crossfades in when the act is centred and
         the record resolves in one go — the frame does the work, not the
         transport. */
      /* triggered on the record, not on the section: the section's top crosses
         60% of the viewport while the record is still below the fold, so the
         move it exists to show was playing where nobody was looking. */
      ScrollTrigger.create({
        trigger: document.querySelector('.record') || stage, start: 'top 82%',
        onEnter: function () {
          playWater();
          gsap.to(water, { opacity: 1, duration: 1.1, ease: 'power2.out' });
          rows.forEach(function (_, i) {
            gsap.delayedCall(0.25 + i * 0.13, function () { resolve(i + 1); });
          });
        },
        once: true,
      });
      return;
    }

    /* desktop: one pinned, scrubbed act — and the only pin on the page (DNA47) */
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: stage,
        start: 'top top',
        end: '+=230%',
        pin: true,
        pinSpacing: true,
        scrub: 0.75,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onEnter: playWater,
        onEnterBack: playWater,
        onUpdate: function (self) {
          /* the record resolves across the middle of the act, so the reader
             meets the fields while the ground is still changing under them */
          var t = gsap.utils.clamp(0, 1, (self.progress - 0.18) / 0.62);
          resolve(Math.round(t * rows.length));
        },
      },
    });

    /* the surface gives way. A slow push on the summit, the water rising
       through it — one continuous place, not two pictures (DNA65). */
    tl.to(peak,  { scale: 1.10, duration: 1, ease: 'none' }, 0)
      .to(water, { opacity: 1, duration: 0.34, ease: 'power2.out' }, 0.20)
      .to(peak,  { opacity: 0, duration: 0.30, ease: 'power2.in' }, 0.24);

    /* The trace goes under with it. It belongs on THIS timeline and not on a
       trigger of its own: the line, the water and the record are one event on
       one clock, and a separate trigger inside a pinned section would be
       measuring a scroll position the pin has already taken away (G3).

       It is WIPED, not stroke-drawn. DrawSVG measures the path, and a path
       cannot be measured while it carries non-scaling-stroke inside a box
       that is not proportionally scaled — the browser says so out loud and
       then refuses. Both conditions are load-bearing here: the viewBox is
       0–100 in both axes against an act of arbitrary height, and the stroke
       has to stay one weight. A descending line revealed top-down is the
       same event to the eye, and it needs no measurement at all.

       It draws across the first two thirds and then stops, because the last
       third belongs to the record resolving. Two things arriving at once is
       one of them not being read. */
    var deepSvg  = stage.querySelector('.trace--deep');
    var deepEnd  = stage.querySelector('.trace__end');
    if (deepSvg) {
      var wipe = { v: 100 };
      var paint = function () { deepSvg.style.clipPath = 'inset(0 0 ' + wipe.v + '% 0)'; };
      /* 14, not 0: the plumb line stops at the record at 86 units, and the
         last 14 of the box is the air under it. */
      paint();
      gsap.set(deepEnd, { opacity: 0 });
      tl.to(wipe, { v: 14, duration: 0.66, ease: 'none', onUpdate: paint }, 0.04)
        .to(deepEnd, { opacity: 1, duration: 0.06, ease: 'none' }, 0.70);
    }
    return function () { resolve(0); gsap.set([peak, water], { clearProps: 'all' }); };
  });

  /* ---- the trace, outside the pin -------------------------------------

     ScrollTrigger and not CSS, and this is the capability the lighter method
     does not have: the revealed length has to be the reader's scroll
     POSITION across two separate acts, reversible mid-flight, with each act
     supplying its own range. Nothing else on this page needed a library.

     Linear all the way (G4): the scroll is already the easing.

     The wipe runs on the SVG box, never on the path: see the note in the
     pinned act for why a stroke-length draw is not available here.

     The markup ships FULLY DRAWN and only a successful init clips it back,
     so with the script gone, or the plugin missing, the page shows a
     finished route rather than an empty one (G7). */
  (function trace() {
    if (!window.gsap || !window.ScrollTrigger) return;

    /* The wipe is measured against the LINE, not against the box. Each
       segment's path is placed inside a 0-100 viewBox at its own height —
       the peak route only starts 56 units down, where the summit is — so a
       wipe that begins at the top of the box spends half the act revealing
       empty air before the line appears. `from` is the top of the stroke.
       `to` is its foot, which for the water segment is not the bottom of
       the box either: it ends at the record. */
    var wipeOn = function (svg, from, to) {
      var st = { v: from, from: from, to: to };
      st.paint = function () { svg.style.clipPath = 'inset(0 0 ' + st.v + '% 0)'; };
      return st;
    };

    gsap.matchMedia().add({
      wide:   '(min-width: 62rem) and (prefers-reduced-motion: no-preference)',
      narrow: '(max-width: 61.999rem) and (prefers-reduced-motion: no-preference)',
      still:  '(prefers-reduced-motion: reduce)',
    }, function (c) {
      var arrival  = document.querySelector('.arrival');
      var evidence = document.querySelector('.evidence');
      var pkSvg = arrival && arrival.querySelector('.trace--peak');
      var ring  = arrival && arrival.querySelector('.anchor');
      var thSvg = evidence && evidence.querySelector('.trace--thread');

      /* the still: the whole route is there, exactly as it ends up (DNA43) */
      if (c.conditions.still) return;

      if (pkSvg) {
        /* where the wipe starts is where the stroke starts, and the phone
           draws a different line from a different summit (G5): 57.4 down
           there, 68 on a phone. Reading it off one constant put the whole
           first third of the act into revealing empty sky. */
        var top = c.conditions.narrow ? 68 : 57.4;
        var pk = wipeOn(pkSvg, 100 - top, 0); pk.paint();
        /* the ring lands first and the line leaves it — an event, not a scrub,
           so it takes a duration token rather than a scroll range (G4) */
        if (ring) {
          gsap.set(ring, { scale: 0.4, opacity: 0 });
          gsap.to(ring, { scale: 1, opacity: 1, duration: 0.5, ease: 'power2.out', delay: 0.45 });
        }
        gsap.to(pk, {
          v: pk.to, ease: 'none', onUpdate: pk.paint,
          scrollTrigger: {
            trigger: arrival, start: 'top top', end: 'bottom 45%',
            scrub: 0.6, invalidateOnRefresh: true,
          },
        });
      }

      if (thSvg) {
        var th = wipeOn(thSvg, 100, 0); th.paint();    /* enters and leaves the act */
        gsap.to(th, {
          v: th.to, ease: 'none', onUpdate: th.paint,
          scrollTrigger: {
            trigger: evidence, start: 'top 92%', end: 'bottom 55%',
            scrub: 0.6, invalidateOnRefresh: true,
          },
        });
      }

      /* teardown: the clip is a style this function put there, so this
         function takes it off again (G1) */
      return function () {
        [pkSvg, thSvg].forEach(function (el) { if (el) el.style.clipPath = ''; });
      };
    });
  })();
})();
