/* ============================================================
   RIO.DETAILS — interactions
   Goal: motion that feels expensive — smooth, restrained,
   never gimmicky. Everything degrades gracefully and
   respects prefers-reduced-motion.
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Footer year ---------- */
  var yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Nav: scroll state + mobile menu ---------- */
  var nav = document.querySelector('[data-nav]');
  var menuToggle = document.querySelector('[data-menu-toggle]');

  function onScrollNav() {
    if (!nav) return;
    nav.classList.toggle('is-stuck', window.scrollY > 24);
  }
  onScrollNav();

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    // Close the mobile menu after tapping a link
    nav.querySelectorAll('.nav__links a, .nav__cta').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Scroll progress bar ---------- */
  var bar = document.querySelector('[data-scroll-bar]');
  function updateProgress() {
    if (!bar) return;
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var pct = max > 0 ? (h.scrollTop || window.scrollY) / max * 100 : 0;
    bar.style.width = pct + '%';
  }

  /* ---------- Hero scroll transformation (grime -> gloss) ---------- */
  var hero = document.querySelector('[data-hero]');
  function updateHero() {
    if (!hero || reduceMotion) {
      if (hero) hero.style.setProperty('--clean', '1');
      return;
    }
    var rect = hero.getBoundingClientRect();
    // 0 at top of hero, 1 once scrolled ~70% through it
    var progress = Math.min(1, Math.max(0, -rect.top / (rect.height * 0.7)));
    hero.style.setProperty('--clean', progress.toFixed(3));
  }

  /* ---------- rAF-batched scroll handler ---------- */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      onScrollNav();
      updateProgress();
      updateHero();
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  updateProgress();
  updateHero();

  /* ---------- Reveal on scroll (IntersectionObserver) ---------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        // Stagger siblings for an elegant cascade
        var siblings = Array.prototype.slice.call(
          (el.parentElement || document).querySelectorAll(':scope > [data-reveal]')
        );
        var idx = siblings.indexOf(el);
        el.style.setProperty('--reveal-delay', (idx > 0 ? idx * 90 : 0) + 'ms');
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Before/After slider ---------- */
  var ba = document.querySelector('[data-ba]');
  if (ba) {
    var before = ba.querySelector('[data-ba-before]');
    var handle = ba.querySelector('[data-ba-handle]');
    var range = ba.querySelector('[data-ba-range]');

    function setSplit(pct) {
      pct = Math.min(100, Math.max(0, pct));
      if (before) before.style.width = pct + '%';
      if (handle) handle.style.left = pct + '%';
      if (range && Number(range.value) !== Math.round(pct)) range.value = String(Math.round(pct));
    }

    function pointerSplit(clientX) {
      var rect = ba.getBoundingClientRect();
      setSplit((clientX - rect.left) / rect.width * 100);
    }

    var dragging = false;
    ba.addEventListener('pointerdown', function (e) {
      // Let keyboard users tab to the range without hijacking
      dragging = true;
      ba.setPointerCapture && ba.setPointerCapture(e.pointerId);
      pointerSplit(e.clientX);
    });
    ba.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      pointerSplit(e.clientX);
    });
    function endDrag() { dragging = false; }
    ba.addEventListener('pointerup', endDrag);
    ba.addEventListener('pointercancel', endDrag);

    if (range) {
      range.addEventListener('input', function () { setSplit(Number(range.value)); });
    }

    setSplit(50);
  }

  /* Booking flow lives in js/booking.js */

  /* ---------- Referral: effortless share ---------- */
  var refCopy = document.querySelector('[data-ref-copy]');
  if (refCopy) {
    var refUrlEl = document.querySelector('[data-ref-url]');
    var refStatus = document.querySelector('[data-ref-status]');
    refCopy.addEventListener('click', function () {
      var url = (refUrlEl ? refUrlEl.textContent : '').trim();
      var done = function () {
        refCopy.textContent = 'Copied';
        if (refStatus) refStatus.textContent = 'Invite copied — send it to someone who gets it.';
        setTimeout(function () { refCopy.textContent = 'Copy Invite'; }, 2200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(done);
      } else {
        done();
      }
    });
  }
})();
