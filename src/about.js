'use strict';
/* ink about page: progress bar, reveal-on-scroll, glow demo, TOC scrollspy. */
try {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('svg.diagram').forEach(function (s) { s.pauseAnimations(); });
  }
} catch (e) {}
try {
  // Fresh loads and reloads (no anchor) start at the top.
  // Back/forward visits keep the browser's remembered position.
  if (!location.hash) {
    var navType = '';
    try { navType = performance.getEntriesByType('navigation')[0].type; } catch (e) {}
    if (navType === 'back_forward') {
      try { history.scrollRestoration = 'auto'; } catch (e) {}
    } else {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      var toTop = function () { window.scrollTo(0, 0); };
      toTop();
      document.addEventListener('DOMContentLoaded', toTop);
      addEventListener('load', toTop);
    }
  }
} catch (e) {}
try {
  var bar = document.querySelector('.read-progress');
  var tick = function () {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? h.scrollTop / max : 0) + ')';
  };
  addEventListener('scroll', tick, { passive: true });
  tick();
} catch (e) {}
try {
  // Gentle reveal-on-scroll; disabled automatically under reduced motion
  // via CSS (elements stay visible, observer just adds a no-op class).
  var els = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && els.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    els.forEach(function (el) { io.observe(el); });
  } else {
    els.forEach(function (el) { el.classList.add('is-in'); });
  }
} catch (e) {}
try {
  // Figure 4 playground: pointer/keys move the bloom, slider sets glow,
  // toggles peel shafts and grain off the light pass.
  var demo = document.getElementById('glow-demo');
  var glowInput = document.getElementById('glow-amount');
  var glowValue = document.getElementById('glow-value');
  var shaftsBtn = document.getElementById('glow-shafts');
  var grainBtn = document.getElementById('glow-grain-btn');
  if (demo) {
    var orbA = demo.querySelector('.glow-orb-a');
    var tx = 0.5, ty = 0.42, cx = 0.5, cy = 0.42, glow = 0.7;
    var live = false, rafId = 0, inView = true;
    var reduceMotion = false;
    try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (err) {}
    var goLive = function () {
      if (!live) { live = true; demo.classList.add('is-live'); }
    };
    var setTarget = function (nx, ny) {
      tx = Math.min(1, Math.max(0, nx));
      ty = Math.min(1, Math.max(0, ny));
      goLive();
    };
    var posFromEvent = function (e) {
      var r = demo.getBoundingClientRect();
      if (!r.width || !r.height) return;
      setTarget((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    // Compositor-only motion: lerp toward the target each frame and place
    // the orb with transform, so pointer input never triggers layout.
    var frame = function (now) {
      rafId = 0;
      if (!live && !reduceMotion) {
        var t = now / 1000;
        tx = 0.5 + 0.18 * Math.sin(t * 0.6);
        ty = 0.42 + 0.12 * Math.sin(t * 0.9 + 1.3);
      }
      cx += (tx - cx) * 0.16;
      cy += (ty - cy) * 0.16;
      var w = demo.clientWidth, h = demo.clientHeight;
      if (w > 0 && h > 0) {
        var s = 0.6 + glow * 0.7;
        orbA.style.transform = 'translate(' + (cx * w - 60).toFixed(1) + 'px,' + (cy * h - 60).toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
      }
      kick();
    };
    var kick = function () {
      if (!rafId && inView && !document.hidden && 'requestAnimationFrame' in window) {
        rafId = requestAnimationFrame(frame);
      }
    };
    try {
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          inView = entries[0].isIntersecting;
          if (inView) kick();
          else if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        }).observe(demo);
      }
    } catch (err) {}
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }
      else kick();
    });
    kick();
    var dragging = false;
    demo.addEventListener('pointerdown', function (e) {
      dragging = true;
      try { demo.setPointerCapture(e.pointerId); } catch (err) {}
      posFromEvent(e);
    });
    demo.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'mouse' || dragging) posFromEvent(e);
    });
    demo.addEventListener('pointerup', function () { dragging = false; });
    demo.addEventListener('pointercancel', function () { dragging = false; });
    demo.addEventListener('keydown', function (e) {
      var step = 0.04, handled = true;
      if (e.key === 'ArrowLeft') setTarget(tx - step, ty);
      else if (e.key === 'ArrowRight') setTarget(tx + step, ty);
      else if (e.key === 'ArrowUp') setTarget(tx, ty - step);
      else if (e.key === 'ArrowDown') setTarget(tx, ty + step);
      else handled = false;
      if (handled) e.preventDefault();
    });
    var setGlow = function () {
      var min = Number(glowInput.min || 0);
      var max = Number(glowInput.max || 100);
      var raw = Number(glowInput.value);
      var p = max > min ? (raw - min) / (max - min) : 0;
      var v = raw / 100;
      glow = v;
      demo.style.setProperty('--glow', v.toFixed(2));
      glowValue.textContent = v.toFixed(2);
      // Fill the track up to the knob center (half-thumb inset each end).
      var w = glowInput.clientWidth || 0;
      var px = (8 + p * Math.max(0, w - 16)).toFixed(1) + 'px';
      glowInput.style.setProperty('--fill', px);
    };
    glowInput.addEventListener('input', setGlow);
    try { addEventListener('resize', setGlow); } catch (err) {}
    setGlow();
    var wireToggle = function (btn, key) {
      btn.addEventListener('click', function () {
        var on = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', String(on));
        demo.setAttribute('data-' + key, on ? 'on' : 'off');
      });
    };
    wireToggle(shaftsBtn, 'shafts');
    wireToggle(grainBtn, 'grain');
  }
} catch (e) {}
try {
  // TOC scrollspy: highlight the section currently in view.
  var tocMap = {};
  document.querySelectorAll('.toc a[href^="#"]').forEach(function (a) {
    tocMap[a.getAttribute('href').slice(1)] = a;
  });
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var h = en.target.querySelector('h2[id]');
        if (!h || !tocMap[h.id]) return;
        Object.keys(tocMap).forEach(function (k) { tocMap[k].removeAttribute('aria-current'); });
        tocMap[h.id].setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    document.querySelectorAll('.about-main section').forEach(function (s) { spy.observe(s); });
  }
} catch (e) {}
