'use strict';
/* ink about page: progress bar, reveal-on-scroll, walkthrough, and TOC scrollspy. */
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
  var stages = {
    input: {
      label: '01 / Input',
      detail: 'Pointer movement adds dye at the brush and pushes the velocity field in the direction you move.'
    },
    vorticity: {
      label: '02 / Vorticity',
      detail: 'The solver measures local curl, then feeds it back into velocity to keep small swirls alive.'
    },
    pressure: {
      label: '03 / Pressure projection',
      detail: 'It computes divergence, runs Jacobi pressure iterations, then subtracts the pressure gradient to correct the velocity field.'
    },
    advection: {
      label: '04 / Advection',
      detail: 'Velocity carries both itself and the dye forward. Motion fade and ink persistence control how quickly each field settles.'
    },
    display: {
      label: '05 / Display',
      detail: 'The dye is drawn to the canvas. Bloom, sunrays, and dithering add the final light and texture.'
    }
  };
  var stageButtons = document.querySelectorAll('.pipeline-stage');
  var stageLabel = document.querySelector('.pipeline-eyebrow');
  var stageDetail = document.querySelector('#pipeline-explanation p:last-child');
  stageButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var stage = stages[button.getAttribute('data-stage')];
      if (!stage) return;
      stageButtons.forEach(function (item) {
        item.setAttribute('aria-pressed', String(item === button));
      });
      stageLabel.textContent = stage.label;
      stageDetail.textContent = stage.detail;
    });
  });
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
