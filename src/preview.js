'use strict';

(function () {
  const fluid = window.inkFluid;
  const controls = document.querySelector('.preview-controls');
  const status = document.getElementById('preview-status');
  if (!fluid || fluid.available === false) {
    if (status) status.textContent = fluid && fluid.config
      ? 'Live ink is unavailable on this device.'
      : 'The live simulation could not start.';
    if (controls) controls.disabled = true;
    return;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const syncMotionPreference = () => {
    controls.disabled = reducedMotion.matches;
    status.textContent = reducedMotion.matches
      ? 'Live motion is disabled by your reduced-motion setting.'
      : 'Move inside the field to release ink.';
  };
  syncMotionPreference();
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', syncMotionPreference);
  else if (reducedMotion.addListener) reducedMotion.addListener(syncMotionPreference);

  fluid.setConfig({ IDLE_INJECTION: 0 });
  const ranges = [
    { id: 'preview-radius', key: 'SPLAT_RADIUS', output: 'preview-radius-value', digits: 2 },
    { id: 'preview-force', key: 'SPLAT_FORCE', output: 'preview-force-value', digits: 0 },
    { id: 'preview-persistence', key: 'DENSITY_SLIDER', output: 'preview-persistence-value', digits: 2 },
    { id: 'preview-bloom', key: 'BLOOM_INTENSITY', output: 'preview-bloom-value', digits: 2 }
  ];

  ranges.forEach(({ id, key, output, digits }) => {
    const input = document.getElementById(id);
    const readout = document.getElementById(output);
    const set = () => {
      const value = Number(input.value);
      fluid.setConfig(key, value);
      readout.value = value.toFixed(digits);
      input.setAttribute('aria-valuetext', readout.value);
    };
    input.addEventListener('input', set);
    set();
  });

  document.querySelectorAll('[data-config]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.config;
      const enabled = button.getAttribute('aria-pressed') !== 'true';
      fluid.setConfig(key, enabled);
      button.setAttribute('aria-pressed', String(enabled));
    });
  });

  document.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.action === 'burst') fluid.burst(8);
      if (button.dataset.action === 'clear') fluid.clear();
      if (button.dataset.action === 'pause') fluid.paused ? fluid.resume() : fluid.pause();
    });
  });

  window.addEventListener('ink:pausechange', event => {
    const pauseButton = document.querySelector('[data-action="pause"]');
    const paused = Boolean(event.detail && event.detail.paused);
    pauseButton.textContent = paused ? 'Resume flow' : 'Pause flow';
    pauseButton.setAttribute('aria-label', paused ? 'Resume flow' : 'Pause flow');
    pauseButton.setAttribute('aria-pressed', String(paused));
  });

  window.addEventListener('ink:unavailable', event => {
    status.textContent = event.detail && event.detail.message || 'Live ink is unavailable on this device.';
    controls.disabled = true;
  });
})();
