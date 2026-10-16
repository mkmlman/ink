import { expect, test } from '@playwright/test';

const home = 'http://127.0.0.1:8080/';
const setRangeValue = (locator, value) => locator.evaluate((input, nextValue) => {
  input.value = String(nextValue);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}, value);

test('remaining touch keeps its pointer after another touch ends', async ({ page }) => {
  await page.addInitScript(() => {
    window.inkInputCount = 0;
    window.addEventListener('ink:input', () => window.inkInputCount++);
  });
  await page.goto(home);
  await page.waitForFunction(() => window.inkFluid?.available === true);

  await page.evaluate(() => {
    const makeTouch = (identifier, x, y) => new Touch({
      identifier,
      target: document.body,
      clientX: x,
      clientY: y,
      pageX: x,
      pageY: y,
      screenX: x,
      screenY: y
    });
    const dispatch = (type, touches, changedTouches) => {
      document.body.dispatchEvent(new TouchEvent(type, {
        touches,
        targetTouches: touches,
        changedTouches,
        bubbles: true,
        cancelable: true
      }));
    };
    const first = makeTouch(101, 80, 100);
    const second = makeTouch(202, 180, 100);
    dispatch('touchstart', [first], [first]);
    dispatch('touchstart', [first, second], [second]);
    dispatch('touchend', [second], [first]);
    const movedSecond = makeTouch(202, 220, 130);
    dispatch('touchmove', [movedSecond], [movedSecond]);
  });

  await expect.poll(() => page.evaluate(() => window.inkInputCount)).toBeGreaterThan(0);
});

test('shader compilation failures report an unavailable canvas', async ({ page }) => {
  await page.addInitScript(() => {
    for (const prototype of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype]) {
      if (!prototype) continue;
      const getShaderParameter = prototype.getShaderParameter;
      prototype.getShaderParameter = function (shader, parameter) {
        if (parameter === this.COMPILE_STATUS) return false;
        return getShaderParameter.call(this, shader, parameter);
      };
    }
  });
  await page.goto(home);

  await expect(page.locator('#runtime-status')).toContainText('shader compilation failed');
  await expect(page.locator('#burst-button')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.inkFluid?.available)).toBe(false);
});

test('program linking failures report an unavailable canvas', async ({ page }) => {
  await page.addInitScript(() => {
    for (const prototype of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype]) {
      if (!prototype) continue;
      const getProgramParameter = prototype.getProgramParameter;
      prototype.getProgramParameter = function (program, parameter) {
        if (parameter === this.LINK_STATUS) return false;
        return getProgramParameter.call(this, program, parameter);
      };
    }
  });
  await page.goto(home);

  await expect(page.locator('#runtime-status')).toContainText('program linking failed');
  await expect(page.locator('#burst-button')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.inkFluid?.available)).toBe(false);
});

test('help dialog closes when native dialog methods are unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.HTMLDialogElement) return;
    window.HTMLDialogElement.prototype.showModal = undefined;
    window.HTMLDialogElement.prototype.close = undefined;
  });
  await page.goto(home);
  const helpButton = page.locator('#help-toggle');
  const dialog = page.locator('#quick-help');

  await helpButton.click();
  await expect(dialog).toHaveAttribute('open', '');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('#quick-help-backdrop')).toBeVisible();
  await expect(helpButton).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(page.locator('#quick-help-close')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toHaveAttribute('open', '');
  await expect(page.locator('#quick-help-backdrop')).toBeHidden();
  await expect(helpButton).toHaveAttribute('aria-expanded', 'false');
  await expect(helpButton).toBeFocused();

  await helpButton.click();
  await page.locator('#quick-help-close').click();
  await expect(dialog).not.toHaveAttribute('open', '');
  await expect(helpButton).toBeFocused();
});

test('simulation walkthrough guides the reader through the five passes', async ({ page }) => {
  await page.goto(`${home}about.html`);
  const guide = page.locator('#flow-guide');
  const pressure = page.getByRole('button', { name: '03 Pressure projection' });
  await pressure.click();
  await expect(pressure).toHaveAttribute('aria-current', 'step');
  await expect(guide).toHaveAttribute('data-stage', 'pressure');
  await expect(page.locator('#flow-current-step')).toHaveText('STEP 03');
  await expect(page.locator('#flow-title')).toHaveText('Pressure evens the flow');
  await expect(page.locator('#flow-detail')).toContainText('Jacobi iterations');
  await expect(page.locator('.art-pressure')).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(guide).toHaveAttribute('data-stage', 'advection');
  await expect(page.locator('#flow-title')).toHaveText('The current carries color');
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(guide).toHaveAttribute('data-stage', 'pressure');
  await pressure.focus();
  await page.keyboard.press('ArrowRight');
  await expect(guide).toHaveAttribute('data-stage', 'advection');
});

test('live lab controls change the real simulation configuration', async ({ page }) => {
  await page.goto(`${home}about.html`);
  await page.locator('#fluid-preview-frame').scrollIntoViewIfNeeded();
  const lab = page.frameLocator('#fluid-preview-frame');
  await expect(lab.locator('#preview-status')).toContainText('Move inside the field');
  await setRangeValue(lab.locator('#preview-radius'), 0.65);
  await setRangeValue(lab.locator('#preview-force'), 15000);
  await expect.poll(() => lab.locator('body').evaluate(body => {
    const config = body.ownerDocument.defaultView.inkFluid.config;
    return [config.SPLAT_RADIUS, config.SPLAT_FORCE];
  })).toEqual([0.65, 15000]);
  await lab.getByRole('button', { name: 'Pause flow' }).click();
  await expect(lab.getByRole('button', { name: 'Resume flow' })).toBeVisible();
});

test('invalid configuration is rejected atomically', async ({ page }) => {
  await page.goto(home);
  await page.waitForFunction(() => window.inkFluid?.available === true);
  const result = await page.evaluate(() => {
    const before = window.inkFluid.config.CURL;
    const cases = [
      [{ CURL: 6, BRIGHTNESS: Number.NaN }, 'BRIGHTNESS'],
      [{ CURL: 6, UNKNOWN_OPTION: 1 }, 'UNKNOWN_OPTION'],
      [{ CURL: 6, BLOOM: 'yes' }, 'BLOOM'],
      [{ CURL: 6, DYE_RESOLUTION: 0 }, 'DYE_RESOLUTION']
    ];
    const errors = cases.map(([settings]) => {
      try {
        window.inkFluid.setConfig(settings);
        return '';
      } catch (error) {
        return error.message;
      }
    });
    const snapshot = window.inkFluid.config;
    return { before, after: snapshot.CURL, errors, frozen: Object.isFrozen(snapshot) };
  });
  expect(result.before).toBe(result.after);
  expect(result.errors).toHaveLength(4);
  expect(result.errors[0]).toContain('BRIGHTNESS');
  expect(result.errors[1]).toContain('UNKNOWN_OPTION');
  expect(result.errors[2]).toContain('BLOOM');
  expect(result.errors[3]).toContain('DYE_RESOLUTION');
  expect(result.frozen).toBe(true);
});

test('framebuffer resources are released when the canvas resizes', async ({ page }) => {
  await page.addInitScript(() => {
    const counters = { created: 0, deleted: 0 };
    window.__inkResources = counters;
    for (const Context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Context) continue;
      for (const [createName, deleteName] of [['createTexture', 'deleteTexture'], ['createFramebuffer', 'deleteFramebuffer']]) {
        const prototype = Context.prototype;
        if (!Object.hasOwn(prototype, createName) || !Object.hasOwn(prototype, deleteName)) continue;
        const create = prototype[createName];
        const remove = prototype[deleteName];
        prototype[createName] = function (...args) {
          const resource = create.apply(this, args);
          if (resource) counters.created++;
          return resource;
        };
        prototype[deleteName] = function (resource) {
          if (resource) counters.deleted++;
          return remove.call(this, resource);
        };
      }
    }
  });
  await page.goto(home);
  await page.waitForFunction(() => window.inkFluid?.available === true);
  const before = await page.evaluate(() => window.__inkResources.created - window.__inkResources.deleted);
  await page.setViewportSize({ width: 1024, height: 720 });
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.__inkResources.created - window.__inkResources.deleted);
  expect(after).toBe(before);
});

test('reduced motion does not run the about-page animation loop', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.__inkFrameRequests = 0;
    window.requestAnimationFrame = callback => {
      window.__inkFrameRequests++;
      return requestFrame(callback);
    };
  });
  await page.goto(`${home}about.html#about-glow`);
  await page.waitForTimeout(500);
  const result = await page.evaluate(() => ({
    frameRequests: window.__inkFrameRequests,
    loopingSvgAnimations: document.querySelectorAll('svg.diagram animate, svg.diagram animateMotion').length
  }));
  expect(result.frameRequests).toBe(0);
  expect(result.loopingSvgAnimations).toBe(0);
});

test('about page fits narrow viewports without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${home}about.html`);
  await expect(page.getByRole('heading', { name: 'How ink works' })).toBeVisible();
  await expect(page.locator('.flow-step').first()).toHaveCSS('display', 'grid');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
