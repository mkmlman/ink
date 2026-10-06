'use strict';
(function(){
  try {
    var BOX = document.getElementById('fluid-dialers');
    if (!BOX) return;

    // wait for fluid to be ready; retry briefly if dials.js loads first
    var ATTEMPTS = 0;
    function init() {
      var fluid = window.inkFluid;
      if (!fluid || !fluid.config) {
        if (ATTEMPTS++ < 40) return setTimeout(init, 100);
        BOX.dataset.state = 'error';
        var unavailableStatus = document.getElementById('dial-status');
        if (unavailableStatus) {
          unavailableStatus.textContent = 'Unavailable';
          unavailableStatus.dataset.state = 'error';
        }
        BOX.querySelectorAll('input, button').forEach(function(control){ control.disabled = true; });
        return;
      }
      var config = fluid.config;
      var STORAGE_KEY = 'ink:fluid-dials-v1';
      var statusEl = document.getElementById('dial-status');

      function setStatus(text, state) {
        if (!statusEl) return;
        statusEl.textContent = text;
        if (state) statusEl.dataset.state = state;
        else statusEl.removeAttribute('data-state');
      }

      if (fluid.available === false) {
        BOX.dataset.state = 'error';
        setStatus('Unavailable', 'error');
        BOX.querySelectorAll('input, button').forEach(function(control){ control.disabled = true; });
        return;
      }
      BOX.dataset.state = 'ready';

      var MAP = {
        radius:      { cfg:'SPLAT_RADIUS',          inputId:'dial-radius',       min:0.10, max:0.80,  step:0.05, def:0.40 },
        curl:        { cfg:'CURL',                  inputId:'dial-curl',         min:0,    max:8,     step:0.5,  def:4 },
        density:     { cfg:'DENSITY_SLIDER',        inputId:'dial-density',      min:0,    max:5,     step:0.25, def:4.5 },
        pressureDiss:{ cfg:'PRESSURE_DISSIPATION',  inputId:'dial-pressureDiss', min:0,    max:0.20,  step:0.01, def:0.08 },
        velocity:    { cfg:'VELOCITY_DISSIPATION',  inputId:'dial-velocity',     min:0,    max:1,     step:0.05, def:0 },
        iterations:  { cfg:'PRESSURE_ITERATIONS',   inputId:'dial-iterations',   min:4,    max:32,    step:1,    def:16 },
        splatForce:  { cfg:'SPLAT_FORCE',           inputId:'dial-splatForce',   min:2000, max:20000, step:500,  def:12000 },
        brightness:  { cfg:'BRIGHTNESS',            inputId:'dial-brightness',   min:0,    max:5,     step:0.25, def:3 },
        idle:        { cfg:'IDLE_INJECTION',        inputId:'dial-idle',         min:0,    max:2,     step:0.25, def:0.25 },
        bloom:       { cfg:'BLOOM_INTENSITY',       inputId:'dial-bloom',        min:0,    max:1.2,   step:0.05, def:0.30 }
      };
      var dials = {};
      var persistTimer = null;
      var HINTS = {
        radius: 'Sets the width of each paint stroke.',
        splatForce: 'Sets how strongly each stroke pushes the flow.',
        brightness: 'Sets the intensity of new color.',
        curl: 'Higher values create more whirlpools.',
        velocity: 'Higher values make motion settle sooner.',
        density: 'Higher values keep color visible for longer.',
        idle: 'Adds occasional ink while you are not painting.',
        pressureDiss: 'Controls how quickly pressure settles.',
        iterations: 'Higher values smooth the flow but can use more battery.',
        bloom: 'Adds glow around bright color.'
      };
      function clamp(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); }
      function snap(v, step, min){
        var n = Math.round((v - min) / step);
        return +(min + n * step).toFixed(4);
      }
      function loadStored(){
        try {
          var raw = localStorage.getItem(STORAGE_KEY);
          if (raw) return JSON.parse(raw) || {};
        } catch (e) {}
        return {};
      }
      function saveStored(successMessage){
        clearTimeout(persistTimer);
        setStatus('Saving…', 'saving');
        persistTimer = setTimeout(function(){
          var obj = {};
          Object.keys(dials).forEach(function(k){ obj[k] = dials[k].value; });
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
            setStatus(successMessage || 'Saved');
          } catch (e) {
            setStatus('Session only', 'error');
          }
        }, 120);
      }
      function pctFor(value, min, max){
        return ((value - min) / (max - min)) * 100;
      }
      function formatValue(value, step){
        if (step < 0.01) return value.toFixed(3);
        if (step < 1) return value.toFixed(2);
        return String(Math.round(value));
      }
      function setDial(key, value, opts){
        var meta = MAP[key];
        if (!meta || !dials[key]) return;
        value = clamp(snap(+value, meta.step, meta.min), meta.min, meta.max);
        if (isNaN(value)) value = meta.def;
        dials[key].value = value;
        try {
          fluid.setConfig(meta.cfg, value);
        } catch (e) {
          try { config[meta.cfg] = value; } catch (_e) {}
        }
        var pct = pctFor(value, meta.min, meta.max);
        var d = dials[key];
        if (d.knob) d.knob.style.setProperty('--dial-pct', pct + '%');
        if (d.valEl) d.valEl.textContent = formatValue(value, meta.step);
        if (d.wrap) {
          d.wrap.setAttribute('data-value', String(value));
          d.wrap.style.setProperty('--dial-pct', pct + '%');
        }
        if (d.range && String(d.range.value) !== String(value)) d.range.value = String(value);
        if (d.range) d.range.setAttribute('aria-valuetext', formatValue(value, meta.step));
        if (!opts || !opts.silent) saveStored();
      }

      var stored = loadStored();
      BOX.querySelectorAll('.dial[data-key]').forEach(function(wrap){
        var key = wrap.getAttribute('data-key');
        var meta = MAP[key];
        if (!meta) return;
        var range = document.getElementById(meta.inputId);
        var knob = wrap.querySelector('.dial-knob');
        var valEl = wrap.querySelector('.dial-value');
        var labelEl = wrap.querySelector('.dial-label');
        var labelText = labelEl ? labelEl.textContent.trim() : key;
        var initial = stored[key] != null ? stored[key] : (range ? parseFloat(range.value) : meta.def);
        if (isNaN(initial)) initial = meta.def;
        dials[key] = { wrap: wrap, knob: knob, valEl: valEl, range: range, value: initial };
        if (range) {
          // single accessible slider per dial — the knob is visual only
          range.setAttribute('aria-label', labelText);
          range.setAttribute('aria-description', HINTS[key] || 'Adjust this fluid setting.');
          range.setAttribute('title', labelText + ': ' + (HINTS[key] || 'Adjust this fluid setting.'));
          range.addEventListener('input', function(){ setDial(key, parseFloat(range.value)); });
        }
        if (knob) knob.setAttribute('aria-hidden', 'true');
        setDial(key, initial, { silent: true });
      });
      var resetBtn = document.getElementById('dial-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', function(){
          Object.keys(MAP).forEach(function(k){ if (dials[k]) setDial(k, MAP[k].def, { silent:true }); });
          saveStored('Controls reset');
        });
      }

      var PRESETS = {
        smoke: { radius: 0.55, splatForce: 6500, brightness: 2, curl: 2.5, velocity: 0.35, density: 4.75, idle: 0.25, pressureDiss: 0.10, iterations: 12, bloom: 0.15 },
        bloom: { radius: 0.60, splatForce: 9000, brightness: 3.75, curl: 3, velocity: 0.10, density: 5, idle: 0.75, pressureDiss: 0.08, iterations: 16, bloom: 0.75 },
        wild: { radius: 0.30, splatForce: 17500, brightness: 4, curl: 7, velocity: 0.05, density: 4.25, idle: 1, pressureDiss: 0.05, iterations: 20, bloom: 0.40 },
        still: { radius: 0.45, splatForce: 7000, brightness: 2.5, curl: 1, velocity: 0.75, density: 3.5, idle: 0, pressureDiss: 0.14, iterations: 12, bloom: 0.10 }
      };
      BOX.querySelectorAll('[data-preset]').forEach(function(button){
        button.addEventListener('click', function(){
          var preset = PRESETS[button.getAttribute('data-preset')];
          if (!preset) return;
          Object.keys(preset).forEach(function(key){ setDial(key, preset[key], { silent: true }); });
          BOX.querySelectorAll('[data-preset]').forEach(function(item){ item.setAttribute('aria-pressed', String(item === button)); });
          saveStored(button.textContent.trim() + ' preset applied');
        });
      });

      var lowPowerToggle = document.getElementById('low-power-toggle');
      var QUALITY_KEY = 'ink:fluid-low-power-v1';
      var standardQuality = {
        SIM_RESOLUTION: config.SIM_RESOLUTION,
        DYE_RESOLUTION: config.DYE_RESOLUTION,
        BLOOM: config.BLOOM,
        SUNRAYS: config.SUNRAYS
      };
      function setLowPower(enabled, announce) {
        if (!lowPowerToggle) return;
        if (enabled) fluid.setConfig({ SIM_RESOLUTION: 128, DYE_RESOLUTION: 384, BLOOM: false, SUNRAYS: false });
        else fluid.setConfig(standardQuality);
        lowPowerToggle.setAttribute('aria-pressed', String(enabled));
        lowPowerToggle.textContent = enabled ? 'Low power: on' : 'Low power';
        lowPowerToggle.title = enabled ? 'Restore full simulation quality' : 'Reduce simulation quality to save battery';
        try { localStorage.setItem(QUALITY_KEY, enabled ? '1' : '0'); } catch (e) {}
        if (announce) setStatus(enabled ? 'Low power enabled' : 'Full quality restored');
      }
      if (lowPowerToggle) {
        var savedLowPower = false;
        try { savedLowPower = localStorage.getItem(QUALITY_KEY) === '1'; } catch (e) {}
        if (savedLowPower) setLowPower(true, false);
        lowPowerToggle.addEventListener('click', function(){ setLowPower(lowPowerToggle.getAttribute('aria-pressed') !== 'true', true); });
        window.addEventListener('ink:performance', function(){
          if (lowPowerToggle.getAttribute('aria-pressed') !== 'true') setLowPower(true, true);
        }, { once: true });
      }

      // center-stage toggle — the roomy single-column mode for slingshots
      var expandBtn = document.getElementById('dial-expand');
      function syncExpand() {
        if (!expandBtn) return;
        var staged = BOX.classList.contains('is-expanded');
        expandBtn.setAttribute('aria-pressed', staged ? 'true' : 'false');
        var label = staged ? 'Dock controls to the side' : 'Expand controls to center stage';
        expandBtn.setAttribute('aria-label', label);
        expandBtn.setAttribute('title', label);
      }
      if (expandBtn) {
        // button state always reflects the actual class list
        expandBtn.addEventListener('click', function(){
          BOX.classList.toggle('is-expanded');
          syncExpand();
        });
      }
      syncExpand();

      // collapsible panel — optional #dialers-toggle in host page
      var toggle = document.getElementById('dialers-toggle');
      if (toggle) {
        var COLLAPSE_KEY = 'ink:fluid-dialers-collapsed';
        const syncToggle = () => {
          var collapsed = BOX.hasAttribute('hidden');
          toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
          toggle.setAttribute('aria-label', collapsed ? 'Show fluid controls' : 'Hide fluid controls');
        };
        try {
          var collapsedPreference = localStorage.getItem(COLLAPSE_KEY);
          if (collapsedPreference === '1') BOX.setAttribute('hidden', '');
          else if (collapsedPreference === '0') BOX.removeAttribute('hidden');
        } catch (e) {}
        syncToggle();
        toggle.addEventListener('click', function(){
          if (BOX.hasAttribute('hidden')) BOX.removeAttribute('hidden');
          else BOX.setAttribute('hidden', '');
          try { localStorage.setItem(COLLAPSE_KEY, BOX.hasAttribute('hidden') ? '1' : '0'); } catch (e) {}
          syncToggle();
        });
      }

      setStatus('Saved');

      var api = {
        set: setDial,
        get: function(k){ return dials[k] ? dials[k].value : null; },
        reset: function(){
          Object.keys(MAP).forEach(function(k){ if (dials[k]) setDial(k, MAP[k].def); });
        },
        box: BOX
      };
      window.inkDials = api;
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  } catch (err) {
    console.warn('ink dials init failed', err);
  }
})();
