import { test, expect } from '@playwright/test';
import { offlineYouTube, openLessons } from './helpers';

test('the home sample lesson opens straight away, with no waiting', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Watch a 1-minute sample lesson/ }).click();
  await expect(page.getByText(/A sample lesson, ready to watch/)).toBeVisible({ timeout: 3_000 });
  await expect(page.getByRole('heading', { name: 'Photosynthesis' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play' }).first()).toBeVisible();
});

test('a guest sets a learning profile; the lesson form follows it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: /Learning profile/i }).click();
  const dialog = page.getByRole('dialog', { name: 'Learning profile' });
  await dialog.getByRole('radio', { name: /I'm a teacher/ }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await openLessons(page);
  await expect(page.getByRole('radio', { name: /^Teacher/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radiogroup', { name: 'What kind of teacher lesson' })).toBeVisible();
});

test('a teacher makes a class video and gets a printable lesson plan', async ({ page }) => {
  await openLessons(page);
  await page.getByLabel('Topic or text for the lesson').fill('How do volcanoes work?');
  await page.getByRole('radio', { name: /^Teacher/ }).click();
  await page.getByRole('radio', { name: /Video for my class/ }).click();
  await page.getByLabel("Your students' level").selectOption('beginner');
  await page.getByRole('radio', { name: /Simple slides/ }).click();
  await page.getByRole('button', { name: 'Create video lesson' }).click();

  await expect(page.getByRole('heading', { name: 'How Volcanoes Work' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/^Class video, beginner/)).toBeVisible();
  const plan = page.getByRole('region', { name: 'Teacher notes and lesson plan' });
  await expect(plan).toBeVisible({ timeout: 30_000 });
  // The plan may already be written with the lesson; if not, ask for it
  const make = plan.getByRole('button', { name: 'Make the lesson plan' });
  if (await make.isVisible()) await make.click();
  await expect(plan.getByText('Pause after the lava scene and ask how hot it is.')).toBeVisible();
  await expect(plan.getByText('Scene 2')).toBeVisible();
  await expect(plan.getByRole('button', { name: 'Print' })).toBeVisible();
});

test('the summary can be re-explained for a beginner', async ({ page }) => {
  await offlineYouTube(page);
  await page.goto('/');
  await page.getByLabel('YouTube link').fill('https://www.youtube.com/watch?v=abcdefghijk');
  await page.getByRole('button', { name: 'Summarize' }).click();
  await expect(page.getByText('Plants make glucose from sunlight.')).toBeVisible();
  await page.getByRole('radiogroup', { name: 'Explain the summary for' }).getByRole('radio', { name: 'Beginner' }).click();
  await expect(page.getByText('Plants are like tiny kitchens that cook food from sunlight.')).toBeVisible();
});
