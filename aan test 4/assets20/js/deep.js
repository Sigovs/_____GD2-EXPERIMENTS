/* GD2 — scene 2, the water.

   THE SCROLL AND THE FOOTAGE ARE TWO DIFFERENT CLOCKS, and that is the whole
   design of this file:

     the scroll  owns the HANDOVER — where the mountain ends and the water
                 begins. That is spatial, it is scrubbed, and it lives in
                 main.js's phase C and in deep.css's mask.
     the footage owns ITSELF. Once the water is the scene it runs on its own
                 clock and loops. The wheel cannot advance it, reverse it,
                 pause it or restart it.

   It was scrubbed before — scroll position mapped onto currentTime — and that
   was wrong twice over. It made the wheel a transport control, so the water
   froze the moment the reader stopped, which is the opposite of a place. And
   it tied the life of the shot to how fast someone happened to be scrolling.

   Scroll decides WHEN it starts. Nothing decides how it runs.

   The poster under the video is the composition until playback begins, so
   every exit below is silent and leaves a complete scene on screen (DM1,
   DM2). The poster is the master's exact first frame, so the first painted
   frame of playback is the picture that was already there.

   PAYLOAD (DM3):
     poster   55 KB  jpg 1920, the first paint and the reduced-motion scene
     video  650 KB   vp9 1920x1080, with a 3.1 MB h264 fallback
     master  15.6 MB 3280x2544, in video/final ocean/, never shipped

   THE LOOP AND DM9, now that the copy has landed. Perpetual motion is not
   allowed behind, beside or within a block of body copy — that is an
   invariant, not a preference, and this breaches it. It is a decision Alex
   took deliberately, with the measurements in hand, and it is recorded here
   so nobody later "fixes" it without knowing it was chosen.

   What the placement does about it: the copy sits in the two regions the
   footage holds steadiest, measured across a full pass of the loop — the
   right column drifts 0.0008 and never leaves 20.6:1 for white, the foot
   drifts 0.04 and never leaves 10.5:1. So nothing is read over moving light;
   the movement is beside the copy, in the rift, which is the part of the
   breach that was accepted rather than the part that could have been. */
(function () {
  'use strict';

  var vid = document.querySelector('.deep__video');
  if (!vid || !('IntersectionObserver' in window)) return;

  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (still.matches) return;      /* no source, no playback — the poster is the scene */

  vid.loop = true;                /* stated here too: the markup is not the only owner */

  var attached = false;
  var wanted = false;             /* the scene has asked for playback */
  var running = false;            /* and we have actually started it */

  function attach() {
    if (attached) return;
    attached = true;
    [['webm', 'video/webm'], ['mp4', 'video/mp4']].forEach(function (pair) {
      var url = vid.getAttribute('data-src-' + pair[0]);
      if (!url) return;
      var s = document.createElement('source');
      s.src = url;
      s.type = pair[1];
      vid.appendChild(s);
    });
    /* preload has to be raised BEFORE load(). The element ships as
       preload="none" so the markup alone can never start the fetch, but
       calling load() while it is still "none" makes the browser open the
       request and then abort it — nothing is asking for the data yet, so it
       drops it (ERR_ABORTED) and the element sits there with no frames. */
    vid.preload = 'auto';
    vid.load();
  }

  /* fetched a screen and a half out, so the first frame is decoded long
     before the dissolve reaches it */
  var near = new IntersectionObserver(function (entries) {
    if (!entries[0].isIntersecting) return;
    attach();
    near.disconnect();
  }, { rootMargin: '150% 0px' });
  near.observe(vid);

  /* ---- start, once ------------------------------------------------------
     Guarded twice, because the thresholds below can fire more than once on a
     single pass and a second play() on a running element is a stutter:
     `running` blocks the repeat, and readyState defers the call rather than
     dropping it. There is no end state to protect any more — the element
     loops, so it simply keeps going once it is going. */
  function begin() {
    wanted = true;
    if (running) return;
    if (!attached) attach();
    if (vid.readyState < 2) return;         /* 'canplay' will come back for it */
    running = true;
    var p = vid.play();
    if (p && p.catch) p.catch(function () {
      /* declined: the frame that is already painted stays. Re-arm so a later
         threshold crossing can try again rather than leaving it dead. */
      running = false;
    });
  }

  vid.addEventListener('canplay', function () { if (wanted) begin(); });

  /* ---- rewind, only once the water is off screen ------------------------
     Not when the reader scrolls back a little — the shot would visibly jump
     to frame 0 while it is still half revealed. Only once the dissolve has
     fully closed and the mountain owns the frame again. */
  function rewind() {
    wanted = false;
    running = false;
    vid.pause();
    if (vid.readyState >= 1) vid.currentTime = 0;
  }

  /* ======================================================================
     THE TWO THRESHOLDS

     Both are plain boundaries. Neither is scrubbed and neither touches
     currentTime on scroll; they only say "the water is the scene now" and
     "the water is gone again".

       rewind    the handover has closed and the mountain owns the frame
                 again. Mask at 0, hero fully opaque — the last moment at
                 which the water is genuinely invisible.
       begin     38% of the way through the handover, where the water has
                 become the thing being looked at.

     THIS IS WHERE THE BUS EARNS ITS KEEP. These were two screen-height
     offsets — 32svh wide, 44svh narrow — measured down from the top of
     .deep, with a comment explaining that they landed "roughly 38% through
     the dissolve". Working out whether that was still true meant holding the
     pin length, the phase split, deep.css's overlap and the sticky lock in
     your head at once, and it stopped being true the moment anybody retuned
     PIN in main.js. Nothing would have told them.

     So the number that was always the INTENT is now the number in the code.
     One value, both breakpoints, no arithmetic: the bus resolves the hero's
     timeline into --transition, and this file asks to be told when it passes
     0.38. Retune the pin, change the split, add a fourth phase — the water
     still starts 38% into the dissolve, because that is what it was ever
     asked to do.

     One clock, and it is the right one: the bus is written from the timeline's
     own progress, which under a scrub trails the scroll. So playback starts
     when the water is 38% resolved ON SCREEN, not when the wheel has reached
     the position where it eventually will be.
     ================================================================== */
  var BUS = window.GD2;
  if (!BUS) return;                 /* the poster is the scene; nothing breaks */

  var PLAY_AT = 0.38;

  BUS.watch('transition', PLAY_AT, { enter: begin });

  /* A reload restores the reader's scroll position, so the page can open
     already inside the handover, past the crossing this would have fired on. */
  if (BUS.state.transition >= PLAY_AT) begin();

  /* Not when the reader scrolls back a little — the shot would visibly jump to
     frame 0 while it is still half revealed. Only at 0, where the dissolve has
     fully closed. `exit` on a threshold just above zero is that boundary
     stated directly, rather than an element edge that happens to sit on it. */
  BUS.watch('transition', 0.001, { exit: rewind });

  if (!window.gsap || !window.ScrollTrigger) return;

  /* ======================================================================
     THE ROUTE DRAWS

     The reader draws it, the same way they drew the hero's. This is the only
     thing in scene 2 that scroll animates: the water runs on its own clock,
     the line runs on theirs, and the two never touch each other.

     The range starts once the hero is gone — the stage locks 80svh before the
     pin ends, so 90svh past that is clear of the dissolve — and finishes a
     little short of the foot of the page, so the line completes and is then
     held rather than still creeping as the section runs out.

     THIS 0.9 STAYS LOCAL, and deliberately. It is not a handover number: it
     describes where scene 2's own storytelling begins inside scene 2's own
     scroll, and it is read and tuned in this file alone. The bus exists to
     kill numbers that two files derive independently, not to collect every
     number on the page into one basket — that would only move the coupling
     rather than remove it.

     Under reduced motion this file has already returned long before here, so
     the path keeps its CSS state: fully drawn and still. Same line, no
     drawing — which is the authored still, not the animation switched off.
     ================================================================== */
  var route = document.querySelector('.deep__route-p');
  if (route && window.DrawSVGPlugin) {
    gsap.set(route, { drawSVG: '0%' });
    gsap.to(route, {
      drawSVG: '100%',
      ease: 'none',
      scrollTrigger: {
        trigger: '.deep',
        start: function () { return 'top top-=' + Math.round(window.innerHeight * 0.9); },
        end: 'bottom bottom-=15%',
        scrub: 0.7,
        invalidateOnRefresh: true,
      },
    });
  }})();

/* ======================================================================
   THE THREE — one open at a time

   The markup ships with all three open, which is the state a reader gets if
   this never runs: three readable descriptions, no controls that do
   nothing. Everything below is the enhancement on top of that.

   The open/close transition is CSS. This only moves an attribute and keeps
   aria-expanded honest, so there is one source of truth for the state and
   no chance of the two drifting apart.

   THE ROW MUST NOT MOVE. It is anchored to the foot of a fixed frame, so
   any change in its height would push it up into the picture. Each
   description therefore sits in a slot reserved to the height of the
   TALLEST of the three, measured here rather than guessed: scrollHeight
   reports the full content even while the body is collapsed, so the three
   can be read without touching the DOM. Stacked at one column the reserve
   is dropped — there, a slot sized to the longest description would leave
   two holes down the page.
   ================================================================== */
(function feats() {
  var row = document.querySelector('.feats');
  if (!row) return;
  var items = [].slice.call(row.querySelectorAll('.feat'));
  if (!items.length) return;

  /* the breakpoint from tokens.css, through the bus — the last literal in any
     script on this page. The fallback is only for a page served without the
     bus, where the row simply keeps its measured reserve. */
  var BP = (window.GD2 && window.GD2.bp) || '62rem';
  var narrow = window.matchMedia('(max-width: ' + BP + ')');

  function open(item) {
    items.forEach(function (it) {
      var on = it === item;
      it.toggleAttribute('data-open', on);
      var btn = it.querySelector('.feat__btn');
      if (btn) btn.setAttribute('aria-expanded', String(on));
    });
  }

  /* Measure the PARAGRAPH, not the body that wraps it. The body is the grid
     whose row animates 0fr -> 1fr, and a collapsed grid reports only its own
     padding — reading it returned a reserve of 8px, which is the child's top
     margin and nothing else. The paragraph keeps its real scrollHeight
     whether the row around it is open or shut. */
  function reserve() {
    if (narrow.matches) { row.style.setProperty('--feat-reserve', 'auto'); return; }
    var tallest = 0;
    items.forEach(function (it) {
      var p = it.querySelector('.feat__body > *');
      if (!p) return;
      var gap = parseFloat(getComputedStyle(p).marginTop) || 0;
      tallest = Math.max(tallest, p.scrollHeight + gap);
    });
    if (tallest) row.style.setProperty('--feat-reserve', Math.ceil(tallest) + 'px');
  }

  items.forEach(function (it) {
    var btn = it.querySelector('.feat__btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      /* single-open, and it stays open: clicking the one that is already
         open would otherwise leave the row with nothing in it and a hole
         where the description was */
      if (it.hasAttribute('data-open')) return;
      open(it);
    });
  });

  /* measure before closing anything, while every body is still laid out */
  reserve();
  open(items[0]);

  var t;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(reserve, 150);
  }, { passive: true });
})();
