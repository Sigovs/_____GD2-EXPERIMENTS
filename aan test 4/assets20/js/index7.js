/* =========================================================================
   GD2 — index7

   The subject of this page is a database, not a journey. The vault's C1e is
   the reason there is so little here: motion as identity is accepted only
   where the subject is temporal, and the discriminator is the subject rather
   than the amount. index3 and index4 move because a camera is travelling;
   index5 and index6 move because a visit is descending. Nothing on this page
   is travelling, so nothing here is scrubbed, pinned or scrolled.

   What is left is two things, and both survive the removal test (MJ10): take
   them out and the page loses its manners, not its argument.

     reveals   IntersectionObserver and a CSS transition. An entrance.
     the bar   one attribute, so a dark bar over a cream ground is told which
               ground it is over.

   No GSAP. Nothing here needed a timeline, a scrub or interruption semantics,
   and the lightest sufficient method is the whole of the ladder's rule.

   The static page is complete without this file: every word is in the
   document, every figure is in the markup, and `onerror` clears the flag so
   the reveals un-hide rather than stranding content behind a stylesheet.
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
      Array.prototype.forEach.call(items, function (el) { el.setAttribute('data-in', ''); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.setAttribute('data-in', '');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    Array.prototype.forEach.call(items, function (el) { io.observe(el); });
  })();

  /* ---- the bar is told which ground it is over -------------------------
     A fixed dark bar crossing a cream part cuts a hard edge through live
     content, which is the failure U10 names. The bar is part of the
     composition, so it changes with the ground under it.

     Measured against the bar's own box rather than against a section top: the
     bar is 80px tall and sits at the top of the viewport, so the question is
     which part occupies the strip the bar covers, not which part the page has
     reached. */
  (function bar() {
    var mh = document.querySelector('.mh');
    var nav = document.querySelector('.mh__nav');
    var burger = document.querySelector('.burger');
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
      nav.addEventListener('click', function (e) {
        if (e.target.tagName === 'A') close();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
      });
    }

    var papers = document.querySelectorAll('.part--paper');
    var probe = function () {
      var r = mh.getBoundingClientRect();
      var mid = r.top + r.height * 0.6;
      var over = false;
      Array.prototype.forEach.call(papers, function (p) {
        var b = p.getBoundingClientRect();
        if (b.top <= mid && b.bottom >= mid) over = true;
      });
      if (over) mh.setAttribute('data-ground', 'paper');
      else mh.removeAttribute('data-ground');

      if (window.scrollY > 24) mh.setAttribute('data-compact', '');
      else mh.removeAttribute('data-compact');
    };

    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { probe(); ticking = false; });
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    probe();
  })();
})();
