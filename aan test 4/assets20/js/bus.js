/* GD2 — THE SCENE BUS.

   This file is not a scene. It is to the scroll what tokens.css is to the
   stylesheet: the one place a number is written down, and anything below it
   that introduces a raw number of its own is a bug.

   ----------------------------------------------------------------------
   WHY IT EXISTS.

   The page has two scenes and one handover between them, and until now the
   handover had no owner. It was split across three files that each kept a
   private copy of the same geometry:

     main.js   the pin length, the phase split, and — reaching across the
               boundary — the mask ramp and the travel of scene 2's stage.
     deep.js   two constants, 32svh and 44svh, hand-derived from main.js's
               pin and split, with a comment explaining the arithmetic.
     deep.css  a 180svh overlap and a 300svh length, hand-derived from the
               same numbers a third time.

   None of those copies could be checked. The comment in deep.js claimed its
   two offsets landed "roughly 38% through the dissolve"; that claim depends
   on the pin, the split, the overlap and the sticky lock at once, so nobody
   could verify it without redoing the whole geometry — and the moment anyone
   retuned PIN, the numbers were silently wrong while still looking authored.

   ONE WRITER, MANY READERS. That is the whole shape. The hero's scrubbed
   timeline is the only thing that writes progress. Everything else — scene 2,
   the mask, the stage, the stylesheets — reads. A reader never works out
   where it is from the scroll; it is told.

   ----------------------------------------------------------------------
   THE CHANNELS, published on :root as custom properties so CSS reads the
   same state JS does, with no class toggled at a breakpoint:

     --chapter      0 the mountain, 1 the water. The scene that owns the frame.
     --phase        0..1 through the hero's whole pinned timeline.
     --transition   0..1 through the handover alone. THIS is the channel that
                    matters: 0 while the water is genuinely invisible, 1 when
                    the mountain has gone — at every breakpoint and every pin
                    length, by construction rather than by arithmetic.

   Two more are written to the elements that consume them, because they are
   shaping rather than state — the curve, not the position:

     --mask-y       the feather on scene 2's leading edge
     --stage-y      scene 2's travel up into its locked position

   ----------------------------------------------------------------------
   THE PAGE STILL STANDS WITHOUT THIS FILE. Nothing here animates anything;
   it only publishes. With no JS at all the CSS defaults are the authored
   still, exactly as they were before. */
window.GD2 = (function () {
  'use strict';

  var root = document.documentElement;
  var css  = getComputedStyle(root);

  /* ---- the breakpoint ------------------------------------------------
     One value, declared in tokens.css, so JS and CSS cannot disagree about
     where the composition changes. Media queries cannot read a custom
     property, so the literal still appears in main.css and deep.css — but it
     appears in no SCRIPT any more, and the probe below catches the day
     somebody edits one of them and not the token. */
  var BP = (css.getPropertyValue('--bp-wide') || '62rem').trim();
  var wideMQ = window.matchMedia('(min-width: ' + BP + ')');

  /* The stylesheets raise --bp-wide-active inside their own @media block. If
     that flag and this media query ever disagree, a literal has drifted from
     the token — the one failure this arrangement cannot prevent, so it is
     made loud instead of silent. */
  function probe() {
    var flag = getComputedStyle(root).getPropertyValue('--bp-wide-active').trim() === '1';
    if (flag !== wideMQ.matches && window.console) {
      console.warn('[GD2 bus] --bp-wide (' + BP + ') disagrees with the ' +
                   'media-query literals in main.css / deep.css.');
    }
  }

  /* ---- the hero's geometry, and nothing else's -----------------------
     PIN is in percent of the viewport, which is what ScrollTrigger resolves
     a "+=" end against. A and C are the phase boundaries as fractions of the
     timeline. Retune here and every reader follows; that is the point. */
  var HERO = {
    wide:   { pin: 380, scrub: 0.9, A: 0.55, C: 0.80 },
    narrow: { pin: 170, scrub: 0.6, A: 0.34, C: 0.66 }
  };

  /* The near ground's travel through the handover, in px. Scene 2's stage
     covers exactly one viewport in the same time, so the two move at the same
     screen speed and the water reads as attached to the rocks rather than as
     following them. Both halves of that live here because it is ONE fact. */
  var LIFT = 1500;

  /* The mask holds fully extended for most of the entrance and is slid off
     only once the leading edge is nearly at the top of the frame. Retract it
     in step with the travel instead and the edge stops being feathered while
     it is still crossing the middle of the screen — measured, a step of +16
     luminance at the boundary. Written once, as the shape it actually is. */
  var MASK_HOLD = 0.82;   /* of the stage's travel, before the ramp moves */
  var MASK_RUN  = 0.30;   /* and how much of it the ramp takes to leave   */

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* the geometry that is true right now */
  function geom() {
    var g = wideMQ.matches ? HERO.wide : HERO.narrow;
    /* the stage's share of the handover: one viewport at the rocks' own screen
       speed, clamped for windows taller than the lift itself */
    var travel = Math.min(0.85, window.innerHeight / LIFT);
    return {
      pin: g.pin, scrub: g.scrub, A: g.A, C: g.C, travel: travel,
      /* the handover's length on screen, which deep.css needs in svh and
         which nobody should ever have to type out again */
      fadeSvh: Math.round((1 - g.C) * g.pin)
    };
  }

  var state = { chapter: 0, phase: 0, transition: 0, pinned: false };
  var watchers = [];
  var media = null, stage = null;

  function els() {
    if (!media) media = document.querySelector('.deep__media');
    if (!stage) stage = document.querySelector('.deep__stage');
  }

  /* ---- publish -------------------------------------------------------
     Called every frame of the scrub, so it does the least it can: three
     custom properties on :root and two on the elements that shape from them.
     No layout is read here — geom() is resolved by remeasure, never per frame. */
  function publish(g) {
    root.style.setProperty('--chapter',    String(state.chapter));
    root.style.setProperty('--phase',      state.phase.toFixed(4));
    root.style.setProperty('--transition', state.transition.toFixed(4));

    if (!state.pinned) return;
    els();

    var t = state.transition;
    /* scene 2 arrives: parked one viewport low, travelling up into the lock */
    if (stage) {
      stage.style.setProperty('--stage-y',
        (100 * (1 - clamp01(t / g.travel))).toFixed(3));
    }
    /* and the feather on its leading edge resolves as it lands */
    if (media) {
      media.style.setProperty('--mask-y',
        (clamp01((t / g.travel - MASK_HOLD) / MASK_RUN) * 100).toFixed(2) + '%');
    }
  }

  /* ---- watch ---------------------------------------------------------
     A reader says WHERE IN THE HANDOVER it wants to act, not how many screen
     heights past some element happens to land there. Edge-triggered both
     ways, so a scrub dragged back and forth across a threshold fires once in
     each direction rather than every frame. */
  function watch(channel, at, on) {
    watchers.push({ ch: channel, at: at, on: on, was: state[channel] >= at });
  }

  function fire() {
    for (var i = 0; i < watchers.length; i++) {
      var w = watchers[i];
      var now = state[w.ch] >= w.at;
      if (now === w.was) continue;
      w.was = now;
      var fn = now ? w.on.enter : w.on.exit;
      if (fn) fn(state[w.ch]);
    }
  }

  /* ---- the writer ----------------------------------------------------
     The hero's timeline calls this and nothing else does. `p` is that
     timeline's own progress, which under a scrub LAGS the scroll — so every
     reader is timed against what is actually on screen rather than against
     where the wheel has got to. That is the correct clock, and it is free. */
  var g = geom();

  /* Re-resolve the geometry and republish anything derived from it.
     `g` is cached because write() runs every frame and geom() reads
     innerHeight; this is the only thing allowed to refresh that cache, and
     everything that could invalidate it goes through here.

     IT IS NOT ONLY THE RESIZE PATH. gsap.matchMedia rebuilds main.js's whole
     context on a breakpoint change, and it does that from a matchMedia change
     event while this file listens for resize — two events with no guaranteed
     order between them. So the hero must not be able to read a geometry from
     the breakpoint it just left: hero() resolves rather than returns, and the
     cache is correct at the moment of the call rather than shortly after. */
  function resolve() {
    g = geom();
    if (state.pinned) root.style.setProperty('--hero-fade', g.fadeSvh + 'svh');
    return g;
  }

  function write(p) {
    state.phase = clamp01(p);
    state.transition = state.phase <= g.C ? 0
                     : clamp01((state.phase - g.C) / (1 - g.C));
    state.chapter = state.transition >= 0.5 ? 1 : 0;
    publish(g);
    fire();
  }

  /* ---- the pin flag --------------------------------------------------
     deep.css keeps two geometries: a short overlap for a page with no pin,
     and the real one, which only makes sense while the hero is held still.
     One owner for that contract, raised from inside the branch that actually
     builds the pin. The svh figure travels with it, so the stylesheet stops
     re-deriving the handover's length from the pin by hand. */
  function pin(on) {
    state.pinned = !!on;
    if (on) {
      resolve();                    /* the flag and the figure, same instant */
      root.setAttribute('data-hero-pinned', '');
      write(0);
    } else {
      root.removeAttribute('data-hero-pinned');
      root.style.removeProperty('--hero-fade');
      if (stage) stage.style.removeProperty('--stage-y');
      if (media) media.style.removeProperty('--mask-y');
    }
  }

  /* A resize changes the breakpoint, the stage's share of the handover and
     the handover's length at once. Re-resolve all three together — a partial
     update is how two of them end up describing different pages. */
  function remeasure() {
    resolve();
    publish(g);
    probe();
  }
  window.addEventListener('resize', remeasure, { passive: true });

  probe();
  publish(g);

  return {
    get wide()  { return wideMQ.matches; },
    get state() { return { chapter: state.chapter, phase: state.phase,
                           transition: state.transition }; },
    hero:      resolve,
    lift:      LIFT,
    bp:        BP,
    write:     write,
    pin:       pin,
    watch:     watch,
    remeasure: remeasure
  };
})();
