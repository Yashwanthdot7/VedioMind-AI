import { test, expect } from '@playwright/test';
import { openLessons } from './helpers';

test('phone: bottom tab bar works and pages never scroll sideways', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const noSideScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(await noSideScroll()).toBe(true);

  await openLessons(page);
  expect(await noSideScroll()).toBe(true);
  await page.getByRole('navigation', { name: 'Main' }).last().getByRole('button', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Your progress' })).toBeVisible();
  expect(await noSideScroll()).toBe(true);
});
