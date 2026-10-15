import { expect, test } from '@playwright/test';

const home = 'http://127.0.0.1:8080/';

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
