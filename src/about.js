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
  var stages = [
    { id: 'input', title: 'A stroke starts it', detail: 'Your pointer adds dye at the brush and pushes the velocity field in the direction you move.' },
    { id: 'vorticity', title: 'Swirls come alive', detail: 'The solver measures local curl, then feeds it back into velocity to keep small eddies from fading away.' },
    { id: 'pressure', title: 'Pressure evens the flow', detail: 'It measures where fluid is bunching up, solves pressure with Jacobi iterations, then corrects velocity to spread the flow out.' },
    { id: 'advection', title: 'The current carries color', detail: 'Velocity carries both itself and the dye forward. Motion fade and ink persistence set how quickly each field settles.' },
    { id: 'display', title: 'Light finishes the frame', detail: 'The updated dye is drawn to the canvas. Bloom, sunrays, and dithering add the final glow and texture.' }
  ];
  var guide = document.getElementById('flow-guide');
  var stageButtons = Array.from(document.querySelectorAll('.flow-step'));
  var currentStep = document.getElementById('flow-current-step');
  var title = document.getElementById('flow-title');
  var detail = document.getElementById('flow-detail');
  var previous = document.querySelector('[data-flow-prev]');
  var next = document.querySelector('[data-flow-next]');
  var nextLabel = next.querySelector('span');
  var reading = document.getElementById('pipeline-explanation');
  var activeIndex = 0;

  var selectStage = function (index, focus) {
    activeIndex = (index + stages.length) % stages.length;
    var stage = stages[activeIndex];
    guide.setAttribute('data-stage', stage.id);
    guide.style.setProperty('--step-progress', activeIndex / (stages.length - 1));
    stageButtons.forEach(function (button, buttonIndex) {
      if (buttonIndex === activeIndex) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    currentStep.textContent = 'STEP ' + String(activeIndex + 1).padStart(2, '0');
    title.textContent = stage.title;
    detail.textContent = stage.detail;
    previous.disabled = activeIndex === 0;
    nextLabel.textContent = activeIndex === stages.length - 1 ? 'Start again' : 'Next step';
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && reading.animate) {
      reading.getAnimations().forEach(function (animation) { animation.cancel(); });
      reading.animate(
        [{ opacity: 0.55, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 260, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)' }
      );
    }
    if (focus) stageButtons[activeIndex].focus();
  };

  stageButtons.forEach(function (button, index) {
    button.addEventListener('click', function () { selectStage(index, false); });
  });
  document.querySelector('.flow-steps').addEventListener('keydown', function (event) {
    var index = stageButtons.indexOf(document.activeElement);
    if (index < 0) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') selectStage(index + 1, true);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') selectStage(index - 1, true);
    else if (event.key === 'Home') selectStage(0, true);
    else if (event.key === 'End') selectStage(stages.length - 1, true);
    else return;
    event.preventDefault();
  });
  previous.addEventListener('click', function () { selectStage(activeIndex - 1, false); });
  next.addEventListener('click', function () { selectStage(activeIndex === stages.length - 1 ? 0 : activeIndex + 1, false); });
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
