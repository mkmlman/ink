import { test, expect } from '@playwright/test';

const home = 'http://127.0.0.1:8080/';

test('mobile guide remains navigable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${home}about.html`);
  await expect(page.getByRole('heading', { name: 'How ink works' })).toBeVisible();
  const guide = page.locator('#flow-guide');
  await guide.scrollIntoViewIfNeeded();
  const pressure = page.getByRole('button', { name: '03 Pressure projection' });
  await pressure.click();
  await expect(guide).toHaveAttribute('data-stage', 'pressure');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('mobile preview controls can be opened and closed by touch-sized buttons', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${home}fluid-preview.html`);
  const toggle = page.locator('#preview-controls-toggle');
  const controls = page.locator('#preview-controls');
  await expect(toggle).toBeVisible();
  await expect(controls).toBeHidden();
  await toggle.click();
  await expect(controls).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(controls).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
