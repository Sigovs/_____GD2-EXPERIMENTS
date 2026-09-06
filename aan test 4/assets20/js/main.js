/* GD2 — hero choreography, GSAP 3.15 vendored locally (no external requests).

   ONE primary temporal idea: the route draws. It is the only movement here
   that carries meaning — the line runs from the summit, which is the audience,
   down to what the reader gets. The copy leaving is transport and is ranked
   below it; the plate does not move at all, so there is exactly one spatial
   claim in the view (DM6).

   Everything has an authored still: with reduced motion the route is simply
   drawn, the copy is simply present, and nothing is pinned. */
(function () {
  'use strict';
  if (!window.gsap) return;                     /* the static page stands alone */

  /* THE BUS IS WHERE THIS FILE'S NUMBERS LIVE. The pin, the scrub, the phase
     split and the breakpoint are all read from it, and the timeline's progress
     is written back to it every frame. No bus, no choreography — the CSS
     defaults in tokens.css are the authored still and they stand alone. */
  var BUS = window.GD2;
  if (!BUS) return;

  gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin);
  var hasSplit = typeof SplitText !== 'undefined';

  /* ---- the sky answers the pointer ------------------------------------
     A small amount, and on the furthest plane only: distance is the whole
     point, so if the sky moved as much as the near ground the depth would
     invert. Mouse only — there is no pointer to parallax against on touch. */
  /* ---- the bar folds once the reader has left the top -----------------
     Nothing is removed: the menu moves behind a trigger on the right and
     the number and the action stay where they were. */
  (function compactBar() {
    var mh = document.querySelector('.mh');
    var nav = document.querySelector('.mh__nav');
    var burger = document.querySelector('.burger');
    if (!mh || !nav || !burger) return;

    function close() { nav.dataset.open = 'false'; burger.setAttribute('aria-expanded', 'false'); }

    burger.addEventListener('click', function () {
      var open = nav.dataset.open === 'true';
      nav.dataset.open = String(!open);
      burger.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', function (e) {
      if (!mh.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    var wasCompact = false;
    function onScroll() {
      var compact = window.scrollY > 80;
      if (compact === wasCompact) return;
      wasCompact = compact;
      if (compact) mh.setAttribute('data-compact', ''); else { mh.removeAttribute('data-compact'); close(); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

  (function cameraDepth() {
    var hero = document.querySelector('.hero');
    if (!hero) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    /* One environment, three depths. Each plane moves AGAINST the cursor, and
       the nearer it is the further it travels — that ratio is the whole
       effect. No rotation: this is a camera with depth, not a tilting card. */
    var planes = [
      { el: '.pl--sky',   x: 5,  y: 3,  scale: 1.04 },
      { el: '.pl--mtn',   x: 12, y: 7,  scale: 1.06 },
      { el: '.marks-in',  x: 12, y: 7,  scale: 1    },  /* rides with the mountain */
      /* the readout no longer needs its own entry: it sits inside .marks-in now,
         so it already carries the mountain's offset. Listing it here too would
         double the parallax and drift it off its leader. */
      /* the near ground keeps only a whisper: it is a frame, not the subject */
      { el: '.fg-in',     x: 12, y: 3,  scale: 1.02 },
    ];

    var setters = [];
    planes.forEach(function (p) {
      var el = document.querySelector(p.el);
      if (!el) return;
      if (p.scale !== 1) gsap.set(el, { scale: p.scale, transformOrigin: '50% 50%' });
      setters.push({
        x: gsap.quickTo(el, 'x', { duration: 1.0, ease: 'power3.out' }),
        y: gsap.quickTo(el, 'y', { duration: 1.0, ease: 'power3.out' }),
        ax: p.x, ay: p.y,
      });
    });
    if (!setters.length) return;

    /* While the reader is scrolling the effect steps back to 35%: two inputs
       competing at full strength read as noise rather than as one space. */
    var strength = 1, nx = 0, ny = 0, idle;
    function apply() {
      for (var i = 0; i < setters.length; i++) {
        var s = setters[i];
        s.x(-nx * s.ax * strength);
        s.y(-ny * s.ay * strength);
      }
    }
    window.addEventListener('scroll', function () {
      strength = 0.35;
      clearTimeout(idle);
      idle = setTimeout(function () {
        gsap.to({ v: 0.35 }, { v: 1, duration: .5, ease: 'power2.out',
          onUpdate: function () { strength = this.targets()[0].v; apply(); } });
      }, 140);
      apply();
    }, { passive: true });

    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = hero.getBoundingClientRect();
      nx = ((e.clientX - r.left) / r.width  - .5) * 2;   /* -1 .. 1 */
      ny = ((e.clientY - r.top)  / r.height - .5) * 2;
      apply();
    }, { passive: true });

    hero.addEventListener('pointerleave', function () {
      nx = 0; ny = 0; apply();                            /* eases back to centre */
    });
  })();

  gsap.matchMedia().add({
    motion: '(prefers-reduced-motion: no-preference)',
    still:  '(prefers-reduced-motion: reduce)',
    /* the breakpoint comes from tokens.css via the bus — this file no longer
       contains the number, so it cannot drift from the stylesheets */
    wide:   '(min-width: ' + BUS.bp + ')',
  }, function (ctx) {
    var m = ctx.conditions;

    /* the two halves of every reading: the cyan title with its mark, and the
       lines under it. Both unfold; the title leads, the rest follows it. */
    var PLANE = '.callout__in, .summit-note';
    var DESC  = '.callout__s, .summit-note span';
    /* edge-on but still PRESENT: at 75deg the perspective already does the
       foreshortening, so scaleX only reinforces it. Collapsing scaleX as well
       is what made the plane vanish instead of reading as a turning surface. */
    var EDGE  = { rotationY: 75, scaleX: .8, z: -55, x: -5, autoAlpha: 0,
                  filter: 'blur(1.5px)', transformPerspective: 1000,
                  transformOrigin: 'left center', '--srf': 1, '--sheen': '-60%' };
    /* the settled state IS the accepted composition — nothing of the cue left */
    var FLAT  = { rotationY: 0, scaleX: 1, z: 0, x: 0, autoAlpha: 1,
                  filter: 'blur(0px)', '--srf': 0, '--sheen': '160%' };
    /* the window each reading gets, as fractions of the timeline: the edge holds,
       then the long turn, then the surface burns off while the text stays */
    function unfold(tl, plane, desc, t) {
      tl.to(plane, { autoAlpha: .45, duration: .022, ease: 'none' }, t)
        .to(plane, { rotationY: 0, scaleX: 1, z: 0, x: 0, autoAlpha: 1,
                     filter: 'blur(0px)', duration: .095, ease: 'power3.out' }, t + .026)
        .to(desc,  { autoAlpha: 1, duration: .05, ease: 'power2.out' }, t + .062)
        .to(plane, { '--srf': 0, '--sheen': '160%', duration: .06, ease: 'power2.in' }, t + .055);
    }

    /* ---- the authored still ------------------------------------------ */
    if (m.still) {
      gsap.set(['.route__p', '.lead__l'], { drawSVG: '100%' });
      gsap.set(['.lead__a', '.callout__in', '.summit-note'], { autoAlpha: 1, scale: 1, x: 0, filter: 'none' });
      gsap.set([PLANE, DESC], FLAT);
      return;
    }

    /* ---- the pin exists, so scene 2 may assume it ---------------------
       deep.css keeps two geometries: a short overlap for a page with no pin,
       and the real one — most of two screens — which only makes sense while
       the hero is held still. This flag is the contract between them, and it
       is set HERE, from inside the branch that actually builds the pin, so
       the two can never disagree. No GSAP, no pin, no flag, sane page.

       It is set before the trigger is created so the trigger measures the
       document the flag produces, not the one it replaces.

       The bus owns the flag now, and raises `--hero-fade` alongside it, so
       deep.css stops re-deriving the handover's length from a pin length it
       cannot see. One call, one contract, both halves in step. */
    BUS.pin(true);

    /* ---- the route: drawn by the reader ------------------------------- */
    gsap.set('.route__p', { drawSVG: '0%' });

    /* ===================================================================
       PACE — the two knobs, and they are different things.

       PIN is how much scrolling the whole scene consumes. It is the only
       thing that makes the scene read SLOWER: more distance for the same
       story means each wheel notch advances it less. Turn this to retime
       the hero; everything inside is a fraction of it and follows.

       SCRUB is how far the timeline trails the scroll, in seconds. It does
       not change the pace, it changes the WEIGHT — the line keeps drawing
       for a beat after the wheel stops, which is what reads as smooth.

       Mobile gets a shorter pin on purpose. The route and both callouts are
       not composed for one column and are dropped there, so phase A has
       nothing to show — and a long pin over a still frame is not slowness,
       it is a page that appears stuck.

       Both knobs, and the phase split below, are now READ from the bus rather
       than declared here. They did not move because they were in the wrong
       file — they are the hero's numbers and this is the hero's file. They
       moved because scene 2 was deriving its own timings from them by hand,
       and a number two files compute independently is a number that will
       disagree with itself. The bus publishes; nobody re-derives.
       =================================================================== */
    var HERO  = BUS.hero();
    var PIN   = '+=' + HERO.pin + '%';
    var SCRUB = HERO.scrub;

    var draw = gsap.timeline({
      /* THE ONE WRITER. Every frame of the scrub, the timeline's own progress
         goes to the bus, which resolves it into --phase and --transition and
         hands those to every reader on the page. Under a scrub this progress
         LAGS the scroll, so scene 2 is timed against what is actually on
         screen rather than against where the wheel has got to. */
      onUpdate: function () { BUS.write(draw.progress()); },
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: PIN,
        pin: true,                /* an explicit range — sticky's is the parent's */
        pinSpacing: true,
        scrub: SCRUB,
        anticipatePin: 1,
      },
    });

    /* The marker arrives at the summit, then the route leaves it — segment by
       segment, in the order the walk would happen. Each one draws while the
       previous is finishing, so the pause where the terrain hides the path is
       felt as a pause rather than read as a stall. */
    /* The mountain recedes as the reader descends. It is held slightly forward
       to begin with and pulls back to its natural size, so the move reads
       without a single frame where the plate's edge could show.

       The route recedes WITH it, at the same rate about the same origin: the
       line is drawn on that mountain, so if it stayed pinned to the screen the
       view would make two contradicting claims about where things are (DM6).
       One camera, one space. */
    /* The camera holds still: the mountain does not move and neither does the
       route drawn on it. What moves is the near ground, and it moves because
       the reader is descending — close things climb the frame, distant things
       barely stir. That is one spatial claim, not two, and it is why the line
       disappearing behind the ridge is depth rather than decoration. */
    /* Three planes, one camera. The reader is descending into the valley, so
       the near ridge climbs the frame quickly while the distant mountain pulls
       back — different rates, one consistent movement, which is what makes it
       depth rather than two effects running at once (DM6).

       The route recedes WITH the mountain: it is drawn on it. The plate is
       held forward to begin with and returns to its natural size, so it never
       shrinks past its own edge. */
    /* Scroll writes to the WRAPPERS only. The inner elements are the pointer's,
       and neither ever touches the other's transform. */
    /* A slow push INTO the mountain, not the near ground being hauled up the
       screen. The mountain grows rather than shrinks — it was running
       1.16 → 1.0, which is a pull-out, and is why the summit kept getting
       smaller. Foreground travel is cut to a quarter of what it was
       (yPercent 14 → −26 became 5 → −8) so the rocks frame the peak instead
       of swallowing it. */
    /* REMOVED — these were what turned the near ground into a wall:
         gsap.set('.hero__fg',  { yPercent: 5, ... })
         draw.to('.hero__fg',   { yPercent: -8, scale: 1.16, ... }, 0)
       The foreground now has no scroll Y at all. Its base position is set
       once, in CSS, and the only thing GSAP touches on it is a scale of
       1 → 1.025 about its own foot, which cannot lift the upper rocks. */
    /* The mountain RECEDES: 1.00 → 0.82 about 50%/35%, so the summit stays
       where it is while the mass withdraws. The route group takes the same
       transform, not a copy of it in spirit — identical values, so the line
       and its anchors cannot come off the slope.

       Neither the sky nor the near ground grows to compensate: the foreground
       is approved and frozen, and enlarging the sky would read as the camera
       moving two ways at once. */
    /* ===================================================================
       THREE PHASES, one scrubbed timeline. The split is the second pace
       control, and it matters more than the pin length.

       A · 0 → .55    the route descends a stationary mountain, and each
                      marker lights only as the stroke reaches it. FOUR
                      discrete events live in here — the summit readout and
                      two callouts unfolding, then the line completing — so
                      this phase needs the room. It used to hold .40 of the
                      timeline and the last two events landed on top of each
                      other; measured at a relaxed scroll they were 0.37s
                      apart, which reads as a burst rather than a sequence.
       B · .55 → .80  the landscape moves: near rocks rise, mountain
                      withdraws. One continuous motion, no events — so it
                      needs distance, not time, and it gets a smaller share
                      of a longer pin rather than the same share.
       C · .80 → 1    the cover. The next section is lifted over the still
                      pinned hero.

       Narrow gets a different split, not just a shorter pin. Phase A is
       sized for four events that one column does not show, so giving it the
       same share there would only lengthen a stretch where nothing happens.
       =================================================================== */
    var A = HERO.A;   /* end of the route story  */
    var C = HERO.C;   /* end of the landscape, and the start of the handover.
                         The bus resolves everything past this point into
                         --transition, 0..1, so scene 2 can say "38% through
                         the dissolve" instead of "32 screen-heights past the
                         top of .deep, which we worked out lands there". */

    /* The copy says "the deeper you go", so the line descends. The path is
       authored summit-downward already (M196 10 … 26 598), so it is drawn
       forwards — the reverse-drawing that made it climb has been removed. */
    gsap.set('.route__p', { drawSVG: '0%' });
    gsap.set('.fg-scroll', { y: 0 });
    gsap.set(['.pw--mtn', '.hero__marks'], { scale: 1, x: 0, y: 0, yPercent: 0, transformOrigin: '50% 46%' });
    gsap.set('.pw--sky', { clearProps: 'y,yPercent' });   /* the sky is locked for the whole pin */

    /* --- phase A: the descent --- */
    draw.to('.route__p', { drawSVG: '100%', duration: A, ease: 'none' }, 0);

    /* Drawing runs forwards now, so an anchor at fraction f along the path is
       reached at progress f — summit first, then the two events in the order
       the descent meets them. */
    function at(f) { return A * f; }

    /* SIGNAL 001 now reads in the same order as the other two events: the marker
       lands on the route, the elbow draws outward from it, then the label it
       points at. Same durations and easings as the lower two leaders. */
    draw.to('.lead--0 .lead__a', { autoAlpha: 1, scale: 1, duration: .05, ease: 'power2.out' }, .01)
        .to('.lead--0 .lead__l', { drawSVG: '100%', duration: .07, ease: 'none' }, .03)
        ;
    unfold(draw, '.summit-note', '.summit-note span', .085);

    [{ n: '1', f: .30 }, { n: '2', f: .62 }].forEach(function (c) {
      var t = at(c.f);
      draw.to('.lead--' + c.n + ' .lead__a',
              { autoAlpha: 1, scale: 1, duration: .04, ease: 'power2.out' }, t)
          .to('.lead--' + c.n + ' .lead__l',
              { drawSVG: '100%', duration: .07, ease: 'none' }, t + .02)
              ;
      unfold(draw, '.callout--' + c.n + ' .callout__in',
                   '.callout--' + c.n + ' .callout__s', t + .085);
    });

    /* --- phase B: only the near ground moves ---------------------------
       The sky is locked: no y, no yPercent, no scale for the whole pin.
       The mountain shrinks about a fixed origin and is given no translation
       to compensate, so it withdraws in place instead of drifting up. The
       route group carries the identical transform, and the callouts are NOT
       compensated any more — their slight reduction is the depth. */
    draw.to('.fg-scroll', { y: -220, duration: C - A, ease: 'none' }, A)
        .to(['.pw--mtn', '.hero__marks'],
            { scale: .82, duration: C - A, ease: 'none' }, A);

    /* --- phase C: the dissolve ----------------------------------------
       The scene does not leave. It DISSOLVES, onto water that is already
       there: scene 2 sits behind the hero, running, since long before this
       phase (see deep.css for the overlap and why it is that large). So the
       job here is only to take the mountain away in the right order, and to
       let the water's own ramp retreat as it goes.

       This replaces the cover. The section used to be lifted to z-index 3 and
       slid over the pinned hero, which is a cut with a nice easing on it —
       there is a moment where the reader can point at the boundary. It is not
       lifted any more and it is not translated; it stays underneath at
       --z-fg, and the boundary stops existing rather than being softened.

       ORDER MATTERS, and it is the order the eye needs, not the order the
       DOM suggests:

         1  the water's mask retreats FIRST and finishes at 60% of the phase,
            so the water is solid everywhere before the mountain has gone. No
            frame exists where both are transparent.
         2  the hero's own ground lets go early. It is opaque navy, and it is
            ABOVE the water — leave it and the plates would fade to a flat
            navy field instead of to the sea.
         3  the plates, the weather, the annotations and THE NEAR ROCKS all
            dissolve together. The mountain becomes less readable while water
            light comes up through it; for most of this phase both scenes are
            on screen at once.

       The rocks used to be held back to leave last, as a bridge between the
       two environments. That was wrong and it is removed. They are mountain —
       the same plate, the same lighting, the same scene — and the ocean has
       rocks and a seabed of its own. Held back, they ended up as a rim of
       hero silhouette composited over an established underwater shot, which
       is two foregrounds in one frame and reads as a mistake.

       So they now finish BEFORE the mountain does, at .52 of the phase against
       the plates' .58. A hero layer may never be the last thing standing in
       the water, and the cheapest way to guarantee that is to make the rocks
       the first of the scene to go rather than the last.

       autoAlpha, not opacity: it writes visibility:hidden at zero, so nothing
       can stay visibly composited over the video, and it restores on reverse.

       4  AND THE NEAR GROUND CLIMBS OUT, the way it always did — the original
          -=1500 is back. It is the nearest plane in the scene, so it leaves
          through the top of the frame rather than dimming in place, and it
          drags the next scene in behind it.

       ---------------------------------------------------------------------
       THE ENTRANCE IS A REAL MOVE, NOT A REVEAL.

       Scene 2 starts a full viewport BELOW the fold and travels up into place.
       Before this phase begins its stage is off screen, so there are no
       underwater pixels anywhere on the page — not hidden behind the mountain,
       not held at zero opacity, not waiting behind a mask. There is nothing
       there to reveal, which is the only way the arrival can read as arrival.

       What moves is .deep__stage — the whole visible scene, one viewport of
       it. NOT .deep: that section carries the document's height and the sticky
       lock, and translating it is what left 600px of dead scroll at the foot
       of the page the last time. NOT .deep__media inside a stage that is
       already parked at the top: that only shuffles content around inside a
       scene which has already arrived, which is the same reveal wearing a
       different hat.

       SPEED IS THE THING THAT GLUES IT to the rocks. The rocks cover a fixed
       1500px across the phase; the stage covers exactly one viewport. Giving
       the stage a duration of (viewport / 1500) of the phase makes the two
       travel at the SAME screen speed at any window height — so the water is
       not following the rocks, it is attached to them. The clamp only guards
       viewports taller than 1500px, where the stage would otherwise need
       longer than the phase.

       The advancing top edge is feathered by two things that already exist and
       are not changed here: the dark gradient baked into the foot of the
       foreground plate, which is sitting directly on that edge and moving with
       it, and the mask's ramp, which now reads as a feather ON the moving edge
       rather than as a curtain over a stationary picture. Both resolve as the
       stage lands, so the settled scene carries no edge treatment at all. */
    var T = 1 - C;

    /* ---------------------------------------------------------------------
       THIS FILE NO LONGER NAMES A SINGLE ELEMENT IN SCENE 2, and that is the
       point of the change rather than a side effect of it.

       Three lines used to sit here: a yPercent tween on .deep__stage, a
       --mask-y tween on .deep__media, and the TRAVEL constant that timed both
       against this scene's foreground. So the hero's file animated the water's
       file's elements — which quietly broke the rule the whole project is
       organised around. Delete main.css and the hero goes; delete main.js and
       scene 2 used to lose its entrance and its feather with it.

       All three are the bus's now. It derives the stage's travel and the mask's
       ramp from --transition, at the SAME screen speed as the rocks below,
       because it holds both the lift distance and the viewport. The water is
       still attached to the rocks; it is attached through a published value
       instead of through a selector reaching across a boundary.

       What is left here is the near ground climbing out, which is a hero layer
       moving in a hero file. It is the only thing in the handover that this
       scene owns.

       A GROW-AND-DEFOCUS TREATMENT WAS TRIED HERE ON 2026-09-03 AND TAKEN OUT
       AGAIN. The idea came from the GD_LAB_TEST hero, where the near plate
       leaves by growing into blur rather than by travelling — and the idea is
       right, but this was the wrong place to graft it. Alex's verdict on the
       result was that the blur did not behave on scroll, and it is now index9
       instead: the lab page brought in whole, so the treatment can be judged
       as its author built it rather than as an approximation laid over a
       composition that was tuned for a different exit. */
    draw.to('.fg-scroll', { y: '-=' + BUS.lift, duration: T, ease: 'none' }, C);

    draw.to('.hero', { backgroundColor: 'rgba(11,15,30,0)',
                       duration: T * 0.30, ease: 'none' }, C + T * 0.04)
        .to(['.hero__plate', '.hero__sky'], { autoAlpha: 0,
                       duration: T * 0.50, ease: 'power1.inOut' }, C + T * 0.08)
        .to('.hero__marks', { autoAlpha: 0,
                       duration: T * 0.38, ease: 'none' }, C + T * 0.08)
        /* The copy is in this list because it has to be, not for symmetry.
           Its exit is staggered .05 a line over a .24 tween from A, so the
           LAST line does not finish until .94 — past the start of this phase.
           That never showed while the old cover slid an opaque section over
           the hero at .80; a dissolve has nothing to hide it behind, and the
           blurred orange of "know." was left hanging in the water. The line
           timings themselves are untouched: whatever is still leaving is
           taken by the dissolve along with the rest of the scene. */
        .to('.hero__say', { autoAlpha: 0,
                       duration: T * 0.22, ease: 'none' }, C)
        ;

    /* THE NEAR GROUND IS NEVER FADED. It has no opacity tween at all now, and
       that is the correction: the plate carries its own ending with it. Its
       artwork finishes on flat --bg and a long tail of the same ground is
       attached beneath it (main.css, .fg-in::after), so what lies over the
       water during the handover is the foreground's own darkness running out
       — not the foreground going see-through.

       Nothing removes it but travel. It stops covering the water when the
       whole composite, tail included, has gone past the top of the frame, and
       it comes back the same way on reverse with no state to restore. */

    /* nothing on the route exists until the climb reaches it */
    gsap.set('.lead__l', { drawSVG: '0%' });
    gsap.set('.lead__a', { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
    /* The containers only carry the perspective now — the reveal belongs to the
       lines inside them, each hinged on the edge its leader reaches. Edge-on and
       pushed back, so it opens toward the camera rather than sliding into place. */
    gsap.set(PLANE, EDGE);
    gsap.set(DESC, { autoAlpha: 0 });   /* rides the plane; only resolves later */

    /* ---- the callouts -------------------------------------------------
       Order is the whole point: the route passes the anchor, the anchor
       lights, the leader draws out, and only then does the reading arrive.
       The right one first, the left one further down. */
    /* The group now SHRINKS 1 → 0.82, so the type's compensation runs the
       other way: it grows to 1/0.82 exactly as fast, and the reading stays
       the same size on screen while its anchor recedes with the slope. */

    /* The pit stop is not there at the start: it arrives when the route
       reaches it. Only then does hover open the three lines. */
    var offer = document.querySelector('.offer');
    if (offer) {
      var items = offer.querySelectorAll('li');
      /* the marker that used to sit here was decoration and has gone; warm
         orange belongs to the second waypoint, not to a floating symbol */
      gsap.set(items, { autoAlpha: 0 });
      var open = gsap.timeline({ paused: true })
        .fromTo(items, { autoAlpha: 0, x: 26 },
          { autoAlpha: 1, x: 0, duration: .7, ease: 'power3.out', stagger: .12 }, 0);

      var show = function (yes) {
        offer.setAttribute('aria-expanded', String(yes));
        yes ? open.play() : open.reverse();
      };
      offer.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'mouse') show(true);
      });
      offer.addEventListener('pointerleave', function (e) {
        if (e.pointerType === 'mouse') show(false);
      });
      offer.addEventListener('focusin', function () { show(true); });
      offer.addEventListener('focusout', function () {
        if (!offer.contains(document.activeElement)) show(false);
      });
    }

    /* ---- the copy leaves, ranked below the route ---------------------- */
    var lines = null;
    if (hasSplit) {
      try { lines = new SplitText('.h-display', { type: 'lines', linesClass: 'ln' }).lines; }
      catch (e) { lines = null; }
    }
    var head = lines && lines.length ? lines : ['.h-display'];

    /* The copy stays completely sharp until the route has finished its story
       at 55%, then leaves between .55 and .68 — before the rising rocks reach
       where it stood. No blur: it was starting at .34, which put the headline
       in soft focus while the climb was still being read. */
    /* The copy drifts OUT TO THE RIGHT as it blurs, the way the cloud banks
       cross the sky — not upward. GSAP cannot interpolate from ilter: none,
       so an explicit blur(0px) start is set first or the blur never runs. */
    gsap.set(head, { filter: 'blur(0px)' });
    gsap.set(['.body', '.rule-o'], { filter: 'blur(0px)' });

    draw.to(head, {
      x: 120, autoAlpha: 0, filter: 'blur(26px)',
      duration: .24, ease: 'power1.in', stagger: .05,
    }, A)
    /* the paragraph leaves without blur: blur on a body measure is the most
       expensive frame on the page and buys nothing at that size */
        .to(['.body', '.rule-o'], { x: 96, autoAlpha: 0, filter: 'blur(20px)', duration: .24, ease: 'power1.in', stagger: .05 }, A + .05);

    return function () {
      if (lines) SplitText.revert && SplitText.revert('.h-display');
      /* the flag goes with the pin it described, or a torn-down context would
         leave scene 2 pulled two screens up over a hero that is no longer
         held still. The bus clears the derived channels with it — a stage
         parked one viewport low with nothing left to move it is the same bug
         wearing a different name. */
      BUS.pin(false);
    };
  });

  /* ---- measure once everything that changes the measurement has landed ---
     The pin's length and scene 2's overlap are both resolved against document
     height, and both are decided before the fonts have swapped and before the
     plates have decoded. Either can move the end of the pin by a screen, which
     would put the dissolve out of register with the water underneath it. */
  function remeasure() {
    /* the bus first: it resolves the viewport-dependent half of the handover,
       and a trigger refreshed against the old figure would measure a document
       the bus is about to contradict */
    BUS.remeasure();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  window.addEventListener('load', remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
})();
