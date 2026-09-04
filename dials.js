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
        return;
      }
      var config = fluid.config;
      var STORAGE_KEY = 'ink:fluid-dials-v1';

      var MAP = {
        radius:      { cfg:'SPLAT_RADIUS',          inputId:'dial-radius',       min:0.10, max:0.80,  step:0.05, def:0.40 },
        curl:        { cfg:'CURL',                  inputId:'dial-curl',         min:0,    max:8,     step:0.5,  def:4 },
        density:     { cfg:'DENSITY_SLIDER',        inputId:'dial-density',      min:0,    max:5,     step:0.25, def:4 },
        pressureDiss:{ cfg:'PRESSURE_DISSIPATION',  inputId:'dial-pressureDiss', min:0,    max:0.20,  step:0.01, def:0.08 },
        velocity:    { cfg:'VELOCITY_DISSIPATION',  inputId:'dial-velocity',     min:0,    max:1,     step:0.05, def:0 },
        iterations:  { cfg:'PRESSURE_ITERATIONS',   inputId:'dial-iterations',   min:4,    max:32,    step:1,    def:16 },
        splatForce:  { cfg:'SPLAT_FORCE',           inputId:'dial-splatForce',   min:2000, max:20000, step:500,  def:12000 },
        brightness:  { cfg:'BRIGHTNESS',            inputId:'dial-brightness',   min:0,    max:5,     step:0.25, def:3 },
        idle:        { cfg:'IDLE_INJECTION',        inputId:'dial-idle',         min:0,    max:2,     step:0.25, def:0 },
        bloom:       { cfg:'BLOOM_INTENSITY',       inputId:'dial-bloom',        min:0,    max:1.2,   step:0.05, def:0.30 }
      };
      var dials = {};
      var persistTimer = null;
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
      function saveStored(){
        clearTimeout(persistTimer);
        persistTimer = setTimeout(function(){
          var obj = {};
          Object.keys(dials).forEach(function(k){ obj[k] = dials[k].value; });
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch (e) {}
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
          range.setAttribute('title', labelText);
          range.addEventListener('input', function(){ setDial(key, parseFloat(range.value)); });
        }
        if (knob) knob.setAttribute('aria-hidden', 'true');
        setDial(key, initial, { silent: true });
      });
      Object.keys(dials).forEach(function(k){ setDial(k, dials[k].value, { silent: true }); });

      var resetBtn = document.getElementById('dial-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', function(){
          Object.keys(MAP).forEach(function(k){ if (dials[k]) setDial(k, MAP[k].def); });
        });
      }

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
          if (localStorage.getItem(COLLAPSE_KEY) === '1') BOX.setAttribute('hidden', '');
        } catch (e) {}
        syncToggle();
        toggle.addEventListener('click', function(){
          if (BOX.hasAttribute('hidden')) BOX.removeAttribute('hidden');
          else BOX.setAttribute('hidden', '');
          try { localStorage.setItem(COLLAPSE_KEY, BOX.hasAttribute('hidden') ? '1' : '0'); } catch (e) {}
          syncToggle();
        });
      }

      var api = {
        set: setDial,
        get: function(k){ return dials[k] ? dials[k].value : null; },
        reset: function(){ Object.keys(MAP).forEach(function(k){ if (dials[k]) setDial(k, MAP[k].def); }); },
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
