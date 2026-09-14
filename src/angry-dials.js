'use strict';
/* ink — angry sliders: slingshot thumbs for the fluid dials.
 * Inspired by https://x.com/ggsimm/status/2099497518627184949 ("angry sliders").
 * Normal horizontal drag scrubs. Yank the thumb off-track and it detaches
 * into a slingshot: elastic tethers, dotted projectile preview, release to
 * fling the value onto the track. Hard landings shake the panel and (when
 * really angry) scatter the label letters for a beat.
 * Keyboard / screen-reader path (native <input type=range>) is untouched.
 */
(function () {
  var ATTEMPTS = 0;
  function init() {
    var api = window.inkDials;
    if (!api || !api.box) {
      if (ATTEMPTS++ < 60) return setTimeout(init, 100);
      return;
    }
    try { boot(api); } catch (err) { console.warn('ink angry dials failed', err); }
  }

  function boot(api) {
    var BOX = api.box;
    var reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (reduced) return; // keep calm controls for reduced motion
    if (!window.PointerEvent || !window.requestAnimationFrame) return;
    if (!BOX.querySelector('.dial[data-key]')) return; // e.g. about page

    document.body.classList.add('is-angry');

    var overlay = document.createElement('canvas');
    overlay.id = 'angry-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
    var octx = overlay.getContext('2d');
    var dpr = 1;
    function sizeOverlay() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      overlay.width = Math.round(window.innerWidth * dpr);
      overlay.height = Math.round(window.innerHeight * dpr);
      overlay.style.width = window.innerWidth + 'px';
      overlay.style.height = window.innerHeight + 'px';
    }
    sizeOverlay();
    window.addEventListener('resize', function () {
      sizeOverlay();
      refreshRect();
    }, { passive: true });
    // Keep the cached track rect honest if the page scrolls mid-gesture,
    // instead of paying for getBoundingClientRect() on every pointermove.
    window.addEventListener('scroll', refreshRect, { passive: true, capture: true });
    function refreshRect() {
      if (!active || active.flying) return;
      try {
        var rect = trackRect(active.wrap);
        if (rect && rect.width > 4) {
          active.rect = rect;
          if (!active.slinging) {
            active.anchorX = valueToX(active.startValue, active.meta, rect);
            active.anchorY = rect.top + rect.height / 2;
          }
        }
      } catch (e) {}
    }

    var SLING_K = 6.5;      // launch velocity per px of pull
    var GRAVITY = 1700;     // px/s^2
    var DETACH = 18;        // px vertical before detach
    var MAX_PULL = 160;     // px clamp on elastic
    var ANGRY_BLUE = '#6363ff';
    var panel = BOX;

    var active = null; // current drag state
    var raf = 0;

    function metaFor(wrap) {
      var range = wrap.querySelector('input[type="range"]');
      if (!range) return null;
      var min = parseFloat(range.min);
      var max = parseFloat(range.max);
      var step = parseFloat(range.step);
      if (isNaN(min)) min = parseFloat(wrap.getAttribute('data-min') || '0');
      if (isNaN(max)) max = parseFloat(wrap.getAttribute('data-max') || '100');
      if (isNaN(step) || step <= 0) step = (max - min) / 100;
      return { range: range, min: min, max: max, step: step };
    }
    function snap(v, step, min) {
      var n = Math.round((v - min) / step);
      return +(min + n * step).toFixed(4);
    }
    function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
    function formatValue(value, step) {
      if (step < 0.01) return value.toFixed(3);
      if (step < 1) return value.toFixed(2);
      return String(Math.round(value));
    }
    function trackRect(wrap) {
      var face = wrap.querySelector('.dial-knob-face');
      if (face) return face.getBoundingClientRect();
      var knob = wrap.querySelector('.dial-knob');
      if (knob) return knob.getBoundingClientRect();
      return wrap.getBoundingClientRect();
    }
    function valueToX(value, meta, rect) {
      var t = (value - meta.min) / (meta.max - meta.min);
      return rect.left + t * rect.width;
    }
    function xToValue(x, meta, rect) {
      var t = (x - rect.left) / rect.width;
      return snap(meta.min + t * (meta.max - meta.min), meta.step, meta.min);
    }

    function simulate(thumbX, thumbY, vx, vy, trackY) {
      var pts = [{ x: thumbX, y: thumbY }];
      var x = thumbX, y = thumbY;
      var dt = 1 / 60;
      var landIndex = -1, landX = 0, landVx = vx, landVy = vy;
      for (var i = 0; i < 110; i++) {
        vy += GRAVITY * dt;
        x += vx * dt;
        y += vy * dt;
        pts.push({ x: x, y: y });
        var prev = pts[pts.length - 2];
        // crossed the track plane?
        if ((prev.y - trackY) * (y - trackY) <= 0 && Math.abs(vy) > 1) {
          landIndex = pts.length - 1;
          landX = x;
          landVx = vx; landVy = vy;
          break;
        }
        if (y > window.innerHeight + 200 || y < -600 || x < -400 || x > window.innerWidth + 400) break;
      }
      return { pts: pts, landIndex: landIndex, landX: landX, landVx: landVx, landVy: landVy };
    }

    function draw() {
      // Pure render: no frame scheduling here. The tick loop drives aiming
      // frames; flight animations drive their own. Keeps one writer on the
      // canvas and pacing on requestAnimationFrame, not pointer-event rate.
      if (!active) {
        overlay.classList.remove('is-live');
        try { octx.clearRect(0, 0, overlay.width, overlay.height); } catch (e) {}
        return;
      }
      var a = active;
      if (!a.slinging && !a.flying) {
        // pure scrub: leave all rendering to the native dial, keep overlay clear
        overlay.classList.remove('is-live');
        try { octx.clearRect(0, 0, overlay.width, overlay.height); } catch (e) {}
        return;
      }
      overlay.classList.add('is-live');
      octx.save();
      octx.scale(dpr, dpr);
      octx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      var anchorX = a.anchorX, anchorY = a.anchorY;
      var thumbX = a.thumbX, thumbY = a.thumbY;

      // anchor fork dots
      octx.fillStyle = 'rgba(237,244,239,0.4)';
      octx.beginPath(); octx.arc(anchorX - 5, anchorY, 2.6, 0, Math.PI * 2); octx.fill();
      octx.beginPath(); octx.arc(anchorX + 5, anchorY, 2.6, 0, Math.PI * 2); octx.fill();

      if (a.slinging) {
        // elastic tethers
        octx.strokeStyle = ANGRY_BLUE;
        octx.lineWidth = 2;
        octx.lineCap = 'round';
        octx.globalAlpha = 0.95;
        octx.beginPath(); octx.moveTo(anchorX - 5, anchorY); octx.lineTo(thumbX, thumbY); octx.stroke();
        octx.beginPath(); octx.moveTo(anchorX + 5, anchorY); octx.lineTo(thumbX, thumbY); octx.stroke();
        octx.globalAlpha = 1;

        // dotted trajectory
        if (a.traj && a.traj.pts.length > 2) {
          octx.fillStyle = 'rgba(237,244,239,0.42)';
          for (var i = 2; i < a.traj.pts.length; i += 2) {
            var p = a.traj.pts[i];
            if (p.y < -50 || p.y > window.innerHeight + 50) continue;
            octx.beginPath(); octx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); octx.fill();
          }
        }
        // landing tick + ghost label
        if (a.landing != null) {
          octx.strokeStyle = ANGRY_BLUE;
          octx.lineWidth = 2.5;
          octx.beginPath();
          octx.moveTo(a.landingX, anchorY - 9);
          octx.lineTo(a.landingX, anchorY + 9);
          octx.stroke();
          octx.fillStyle = ANGRY_BLUE;
          octx.font = '12px "Departure Mono", ui-monospace, Menlo, monospace';
          octx.textAlign = 'center';
          var label = formatValue(a.landing, a.meta.step, a.meta.min);
          octx.fillText(label, clamp(a.landingX, 30, window.innerWidth - 30), anchorY - 16);
        }
      } else if (a.flying && a.flightPts) {
        // fading trail during flight
        octx.fillStyle = 'rgba(237,244,239,0.35)';
        var pts = a.flightPts;
        for (var j = 0; j < pts.length; j += 2) {
          var q = pts[j];
          octx.beginPath(); octx.arc(q.x, q.y, 2.2, 0, Math.PI * 2); octx.fill();
        }
      }

      // thumb (angry blue when slinging/flying). Halo is two flat fills —
      // deliberately no shadowBlur: it forces a slow path on full-viewport
      // canvases and was the main frame-rate killer.
      var R = a.slinging || a.flying ? 11 : 9;
      var hot = a.slinging || a.flying;
      octx.beginPath();
      octx.arc(thumbX, thumbY, R + 5, 0, Math.PI * 2);
      octx.fillStyle = hot ? 'rgba(99,99,255,0.16)' : 'rgba(241,243,240,0.10)';
      octx.fill();
      octx.beginPath();
      octx.arc(thumbX, thumbY, R, 0, Math.PI * 2);
      octx.fillStyle = hot ? '#5b5bf7' : '#f1f3f0';
      octx.fill();
      octx.restore();
    }

    // Shared aim step: clamp the pull, integrate the projectile, pick the
    // snapped landing. Used by the tick loop every frame and once more on
    // release, so even a sub-frame flick still launches instead of fizzling.
    function aim(a) {
      var px = a.px, py = a.py;
      var vx0 = px - a.anchorX, vy0 = py - a.anchorY;
      var len = Math.hypot(vx0, vy0);
      if (len > MAX_PULL) {
        px = a.anchorX + vx0 / len * MAX_PULL;
        py = a.anchorY + vy0 / len * MAX_PULL;
      }
      a.thumbX = px; a.thumbY = py;
      var lvx = (a.anchorX - px) * SLING_K;
      var lvy = (a.anchorY - py) * SLING_K;
      a.launchVx = lvx; a.launchVy = lvy;
      var sim = simulate(px, py, lvx, lvy, a.anchorY);
      a.traj = sim;
      if (sim.landIndex > 0) {
        var lx = clamp(sim.landX, a.rect.left, a.rect.left + a.rect.width);
        var val = clamp(xToValue(lx, a.meta, a.rect), a.meta.min, a.meta.max);
        a.landing = val;
        a.landingX = valueToX(val, a.meta, a.rect);
      } else {
        a.landing = null;
      }
      if (a.landing != null) setPreview(a.wrap, formatValue(a.landing, a.meta.step, a.meta.min));
    }

    // Single rAF loop for the aiming phase: reads the latest pointer once
    // per frame, so scrub commits and sling physics run at display rate
    // instead of irregular pointer-event rate.
    function tick() {
      raf = 0;
      if (!active || active.flying) return;
      var a = active;
      if (a.slinging) {
        aim(a);
        draw();
        raf = requestAnimationFrame(tick);
      } else {
        // scrub commit, frame-paced so DOM writes don't pile up per event
        var dx = a.px - a.startX;
        var W = a.rect.width || 1;
        var dv = dx / W * (a.meta.max - a.meta.min);
        var nv = clamp(snap(a.startValue + dv, a.meta.step, a.meta.min), a.meta.min, a.meta.max);
        try { api.set(a.key, nv); } catch (err) {}
      }
    }
    function ensureLoop() {
      if (!raf && active && !active.flying) raf = requestAnimationFrame(tick);
    }
    function stopLoop() {
      if (raf) { try { cancelAnimationFrame(raf); } catch (e) {} raf = 0; }
    }

    function setPreview(wrap, text) {
      var el = wrap.querySelector('.dial-value');
      if (el) {
        el.textContent = text;
        el.classList.add('is-preview');
      }
    }
    function clearPreview(wrap) {
      var el = wrap.querySelector('.dial-value');
      if (el) el.classList.remove('is-preview');
    }

    function shakePanel(strength) {
      try {
        panel.classList.remove('is-shaking', 'is-slamming');
        void panel.offsetWidth;
        if (strength > 1050) panel.classList.add('is-slamming');
        else if (strength > 650) panel.classList.add('is-shaking');
        setTimeout(function () {
          panel.classList.remove('is-shaking', 'is-slamming');
        }, 450);
      } catch (e) {}
    }

    function scatterLabel(wrap) {
      // "angrier" landing: burst the label letters apart, then regroup.
      try {
        var label = wrap.querySelector('.dial-label');
        if (!label || label.dataset.scattering) return;
        var text = label.textContent;
        if (!text || text.length < 2) return;
        label.dataset.scattering = '1';
        var chars = text.split('');
        label.textContent = '';
        var spans = chars.map(function (ch) {
          var s = document.createElement('span');
          s.className = 'angry-char';
          s.textContent = ch === ' ' ? '\u00a0' : ch;
          label.appendChild(s);
          return s;
        });
        var anims = spans.map(function (s, i) {
          var ang = (Math.random() * 2 - 1) * 1.1 + (i / spans.length - 0.5) * 1.4;
          var dist = 16 + Math.random() * 34;
          var dx = Math.sin(ang) * dist;
          var dy = -Math.abs(Math.cos(ang)) * dist - 6 - Math.random() * 14;
          var rot = (Math.random() * 2 - 1) * 90;
          return s.animate([
            { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
            { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)', opacity: 0.9, offset: 0.45 },
            { transform: 'translate(0,0) rotate(0deg)', opacity: 1 }
          ], { duration: 520 + Math.random() * 160, easing: 'cubic-bezier(.22,1,.36,1)' }).finished.catch(function () {});
        });
        Promise.all(anims).then(restore, restore);
        function restore() {
          try { label.textContent = text; } catch (e) {}
          try { delete label.dataset.scattering; } catch (e) {}
        }
        setTimeout(restore, 900);
      } catch (e) {}
    }

    function onDown(e, wrap) {
      if (active) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var meta = metaFor(wrap);
      if (!meta) return;
      var rect = trackRect(wrap);
      if (!rect || rect.width < 4) return;
      var key = wrap.getAttribute('data-key');
      var startValue = api.get(key);
      if (startValue == null || isNaN(startValue)) startValue = parseFloat(meta.range.value);
      var anchorX = valueToX(startValue, meta, rect);
      var anchorY = rect.top + rect.height / 2;
      try { meta.range.focus({ preventScroll: true }); } catch (err) { try { meta.range.focus(); } catch (_e) {} }
      active = {
        key: key, wrap: wrap, meta: meta, rect: rect,
        pointerId: e.pointerId,
        startValue: startValue,
        anchorX: anchorX, anchorY: anchorY,
        startX: e.clientX, startY: e.clientY,
        px: e.clientX, py: e.clientY,
        thumbX: anchorX, thumbY: anchorY,
        slinging: false, flying: false,
        traj: null, landing: null, landingX: 0, launchVx: 0, launchVy: 0,
        downTime: performance.now(), moved: false
      };
      wrap.classList.add('is-grabbing');
      sizeOverlay();
      draw();
      try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    }

    function onMove(e) {
      if (!active) return;
      if (e.pointerId !== undefined && active.pointerId !== undefined && e.pointerId !== active.pointerId) return;
      var a = active;
      // Take the freshest coalesced sample so fast flicks don't alias.
      var cx = e.clientX, cy = e.clientY;
      try {
        if (e.getCoalescedEvents) {
          var samples = e.getCoalescedEvents();
          if (samples && samples.length) {
            var last = samples[samples.length - 1];
            cx = last.clientX; cy = last.clientY;
          }
        }
      } catch (err) {}
      a.px = cx; a.py = cy;
      if (Math.abs(cx - a.startX) + Math.abs(cy - a.startY) > 3) a.moved = true;
      if (a.flying) return;
      var dx = cx - a.startX, dy = cy - a.startY;
      // Detach needs a deliberate off-track yank, not horizontal scrub wobble.
      if (!a.slinging && Math.abs(dy) > DETACH && Math.abs(dy) > Math.abs(dx) * 0.45) {
        a.slinging = true;
        a.wrap.classList.add('is-slinging');
      }
      if (a.slinging) {
        var pullLen = Math.hypot(cx - a.anchorX, cy - a.anchorY);
        if (pullLen < 12) {
          // dragged back onto the track: drop out of the slingshot, resume scrub
          a.slinging = false;
          a.wrap.classList.remove('is-slinging');
          a.traj = null; a.landing = null;
          try {
            var cur = api.get(a.key);
            if (cur != null) {
              a.startValue = cur;
              var valEl = a.wrap.querySelector('.dial-value');
              if (valEl) valEl.textContent = formatValue(cur, a.meta.step, a.meta.min);
            }
          } catch (err) {}
          try { clearPreview(a.wrap); } catch (err) {}
          a.startX = cx; a.startY = cy;
          a.thumbX = a.anchorX; a.thumbY = a.anchorY;
          draw();
          return;
        }
      }
      ensureLoop();
    }

    function cleanupActive() {
      if (!active) return;
      var a = active;
      active = null;
      stopLoop();
      try { a.wrap.classList.remove('is-grabbing', 'is-slinging'); } catch (e) {}
      try { clearPreview(a.wrap); } catch (e) {}
      // restore exact value text from source of truth
      try {
        var cur = api.get(a.key);
        var el = a.wrap.querySelector('.dial-value');
        if (el && cur != null) el.textContent = formatValue(cur, a.meta.step, a.meta.min);
      } catch (e) {}
      draw();
    }

    function flyAndLand(a) {
      stopLoop();
      if (!a.flying) aim(a); // freshen from the latest pointer: no fizzle on quick flicks
      a.flying = true;
      a.wrap.classList.remove('is-slinging');
      var sim = a.traj;
      if (!sim || !sim.pts || sim.landIndex < 0) { cleanupActive(); return; }
      var pts = sim.pts.slice(0, sim.landIndex + 1);
      // re-anchor landing to snapped tick for a satisfying snap
      if (a.landing != null) {
        var n = pts.length;
        for (var i = 0; i < n; i++) {
          var t = n <= 1 ? 1 : i / (n - 1);
          pts[i] = {
            x: pts[i].x + (a.landingX - pts[n - 1].x) * t,
            y: pts[i].y + (a.anchorY - pts[n - 1].y) * t
          };
        }
      }
      a.flightPts = pts;
      var strength = Math.hypot(a.launchVx, a.launchVy);
      var dur = clamp(280 + pts.length * 6, 300, 640);
      var t0 = performance.now();
      function frame(now) {
        if (!active || active !== a) return;
        var t = clamp((now - t0) / dur, 0, 1);
        var idx = Math.min(pts.length - 1, Math.floor(t * (pts.length - 1)));
        var p = pts[idx];
        a.thumbX = p.x; a.thumbY = p.y;
        draw();
        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          var val = a.landing;
          var key = a.key;
          var wrap = a.wrap;
          var meta = a.meta;
          active = null;
          try { wrap.classList.remove('is-grabbing'); } catch (e) {}
          try { clearPreview(wrap); } catch (e) {}
          overlay.classList.remove('is-live');
          try { octx.clearRect(0, 0, overlay.width, overlay.height); } catch (e) {}
          if (val != null) {
            try { api.set(key, val); } catch (err) {}
            try {
              if (navigator.vibrate && strength > 800) navigator.vibrate(8);
            } catch (e) {}
            // pop + shake
            try {
              wrap.classList.remove('is-impact');
              void wrap.offsetWidth;
              wrap.classList.add('is-impact');
              setTimeout(function () { wrap.classList.remove('is-impact'); }, 380);
            } catch (e) {}
            shakePanel(strength);
            if (strength > 1050) scatterLabel(wrap);
          } else {
            // restore text
            try {
              var cur = api.get(key);
              var el = wrap.querySelector('.dial-value');
              if (el && cur != null) el.textContent = formatValue(cur, meta.step, meta.min);
            } catch (e) {}
          }
        }
      }
      requestAnimationFrame(frame);
    }

    function springBack(a) {
      stopLoop();
      var sx = a.thumbX, sy = a.thumbY;
      var ex = a.anchorX, ey = a.anchorY;
      var t0 = performance.now(), dur = 230;
      a.flying = true; // reuse thumb rendering, no trail
      a.slinging = true; // keep the elastic visible on the way home
      a.flightPts = [];
      a.traj = { pts: [] };
      function frame(now) {
        if (!active || active !== a) return;
        var t = clamp((now - t0) / dur, 0, 1);
        // easeOutBack
        var c = 1.70158;
        var u = t - 1;
        var k = 1 + (c + 1) * u * u * u + c * u * u;
        a.thumbX = sx + (ex - sx) * k;
        a.thumbY = sy + (ey - sy) * k;
        draw();
        if (t < 1) requestAnimationFrame(frame);
        else { cleanupActive(); }
      }
      requestAnimationFrame(frame);
    }

    function onUp(e) {
      if (!active) return;
      if (e.pointerId !== undefined && active.pointerId !== undefined && e.pointerId !== active.pointerId) return;
      var a = active;
      try { a.wrap.releasePointerCapture(e.pointerId); } catch (err) {}
      if (a.flying) return;
      if (a.slinging) {
        var pull = Math.hypot(a.thumbX - a.anchorX, a.thumbY - a.anchorY);
        a.slinging = false;
        if (a.landing != null && pull > 26) {
          a.slinging = false;
          flyAndLand(a);
        } else {
          springBack(a);
        }
        return;
      }
      // tap (no drag) on track: absolute jump, for parity with native range taps
      var dt = performance.now() - a.downTime;
      if (!a.moved || (dt < 220 && Math.abs(e.clientX - a.startX) < 5 && Math.abs(e.clientY - a.startY) < 5)) {
        var rect = a.rect;
        if (e.clientX >= rect.left - 12 && e.clientX <= rect.left + rect.width + 12 &&
            Math.abs(e.clientY - (rect.top + rect.height / 2)) < 26) {
          var nv = clamp(xToValue(e.clientX, a.meta, rect), a.meta.min, a.meta.max);
          try { api.set(a.key, nv); } catch (err) {}
        }
      }
      cleanupActive();
    }

    function onCancel() {
      if (!active) return;
      if (active.flying) { return; }
      cleanupActive();
    }

    BOX.querySelectorAll('.dial[data-key]').forEach(function (wrap) {
      wrap.addEventListener('pointerdown', function (e) { onDown(e, wrap); });
      // prevent native range drag from double-handling (input is pointer-transparent
      // under .is-angry, but stop the compat mouse path just in case)
      var range = wrap.querySelector('input[type="range"]');
      if (range) {
        range.addEventListener('pointerdown', function (e) { e.stopPropagation(); }, true);
        try {
          var hint = range.getAttribute('aria-label') || wrap.getAttribute('data-key') || 'setting';
          range.title = hint + ' — drag to tune, yank off-track and release to fling';
        } catch (e) {}
      }
    });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onCancel, { passive: true });
    window.addEventListener('blur', onCancel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
