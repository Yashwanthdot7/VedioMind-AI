import { test, expect } from '@playwright/test';
import { goTo, openLessons } from './helpers';

test('phone: the menu works and pages never scroll sideways', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
  const noSideScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(await noSideScroll()).toBe(true);

  await openLessons(page);
  expect(await noSideScroll()).toBe(true);
  await goTo(page, 'Progress');
  await expect(page.getByRole('heading', { name: 'Your progress' })).toBeVisible();
  expect(await noSideScroll()).toBe(true);
});
