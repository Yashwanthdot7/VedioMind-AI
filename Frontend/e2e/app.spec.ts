import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { API, offlineYouTube, openLessons } from './helpers';

test.beforeEach(async ({ page }) => { await offlineYouTube(page); });

test('summarize a video, read the insights and ask the tutor', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Learn anything');
  await page.getByLabel('YouTube link').fill('https://www.youtube.com/watch?v=abcdefghijk');
  await page.getByRole('button', { name: 'Summarize' }).click();

  await expect(page.getByText('How Photosynthesis Works').first()).toBeVisible();
  await expect(page.getByText('Plants make glucose from sunlight.')).toBeVisible();
  await expect(page.getByText('Chlorophyll absorbs red and blue light and reflects green light.')).toBeVisible();

  await page.getByPlaceholder('Ask anything about the video...').fill('What does chlorophyll do?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/reflects green\./)).toBeVisible();
  // The sidebar now offers the open video
  await expect(page.getByRole('navigation', { name: 'Main' }).first()).toContainText('How Photosynthesis Works');
});

test('make a video lesson from a topic, play it, and take the quick quiz', async ({ page }) => {
  await openLessons(page);
  await page.getByLabel('Topic or text for the lesson').fill('How do volcanoes work?');
  await page.getByRole('radio', { name: /Simple slides/ }).click();
  await page.getByRole('button', { name: 'Create video lesson' }).click();

  await expect(page.getByRole('heading', { name: 'How Volcanoes Work' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Play' }).first()).toBeVisible();
  await page.getByRole('button', { name: /Quick quiz/ }).click();
  await expect(page.getByText(/Question 1:/)).toBeVisible();
  await page.getByRole('radio', { name: /Lava/ }).click();
  await expect(page.getByText('Magma that erupts is called lava.')).toBeVisible();
});

test('make a three-module course; modules are listed and playable', async ({ page }) => {
  await openLessons(page);
  await page.getByLabel('Topic or text for the lesson').fill('Teach me volcanoes from magma to eruptions');
  await page.getByRole('radio', { name: /A course with modules/ }).click();
  await page.getByLabel('Modules').selectOption('3');
  await page.getByRole('radio', { name: /Simple slides/ }).click();
  await page.getByRole('button', { name: 'Create a 3-module course' }).click();

  await expect(page.getByRole('heading', { name: 'Volcanoes: from magma to eruption' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('3 of 3 modules.')).toBeVisible({ timeout: 45_000 });
  const modules = page.getByRole('list', { name: 'Modules' }).getByRole('button');
  await expect(modules).toHaveCount(3);
  await modules.nth(2).click();
  await expect(page.getByRole('button', { name: 'Play' }).first()).toBeVisible();
});

test('upload a PDF and a Word file; a scanned PDF gets a clear message', async ({ page }) => {
  await openLessons(page);
  await page.getByRole('tab', { name: /PDF or Word file/ }).click();
  const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

  await page.getByLabel('Choose a file').setInputFiles(path.join(fixtures, 'chapter.pdf'));
  await expect(page.getByText(/Pages 1–3 of 3/)).toBeVisible();
  await page.getByLabel('From page').fill('2');
  await page.getByRole('button', { name: 'Use these pages' }).click();
  await expect(page.getByText(/Pages 2–3 of 3/)).toBeVisible();

  await page.getByRole('button', { name: 'Remove file' }).click();
  await page.getByLabel('Choose a file').setInputFiles(path.join(fixtures, 'scanned.pdf'));
  await expect(page.getByRole('alert')).toContainText('No text was found');

  await page.getByLabel('Choose a file').setInputFiles(path.join(fixtures, 'notes.docx'));
  await expect(page.getByText('notes.docx')).toBeVisible();
  await page.getByRole('radio', { name: /Simple slides/ }).click();
  await page.getByRole('button', { name: 'Create video lesson' }).click();
  await expect(page.getByRole('button', { name: 'Play' }).first()).toBeVisible({ timeout: 30_000 });
});

test('a teacher shares a lesson; a student opens the link without an account; turning it off closes it', async ({ page, request, browser }) => {
  const auth = { Authorization: 'Bearer e2e-teacher' };
  const created = await (await request.post(`${API}/lessons`, { headers: auth, data: { text: 'How do stars shine? Explain fusion.', visuals: 'slides' } })).json();
  const id = created.data.id;
  await expect.poll(async () => (await (await request.get(`${API}/lessons/${id}`, { headers: auth })).json()).data.status, { timeout: 30_000 }).toBe('done');
  const shared = await (await request.post(`${API}/lessons/${id}/share`, { headers: auth, data: { public: true } })).json();
  const slug = shared.data.shareSlug;

  const student = await browser.newPage();
  await student.goto(`/?s=${slug}`);
  await expect(student.getByText('Shared with you by your teacher')).toBeVisible();
  await expect(student.getByRole('heading', { name: 'How Volcanoes Work' })).toBeVisible();
  await expect(student.getByRole('button', { name: /Share with class/ })).toHaveCount(0);

  await request.post(`${API}/lessons/${id}/share`, { headers: auth, data: { public: false } });
  await page.goto(`/?s=${slug}`);
  await expect(page.getByText('This link has been turned off or does not exist.')).toBeVisible();
});

test('review mistakes: retry them as a quiz, then flip cards', async ({ page }) => {
  const attempt = {
    id: 'local-1', source: 'study', kind: 'quiz', title: 'Volcanoes', language: 'en', durationSec: 30, total: 2, correct: 0, scorePct: 0, grade: 'D',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    answers: [
      { question: 'What is magma called on the surface?', chosen: 1, answer: 0, correct: false, difficulty: 'easy', options: ['Lava', 'Ash', 'Steam', 'Ice'], explanation: 'Magma that erupts is lava.' },
      { question: 'How hot can lava get?', chosen: 0, answer: 2, correct: false, difficulty: 'hard', options: ['100°C', '400°C', '1200°C', '5000°C'], explanation: 'About 1200°C.' },
    ],
  };
  await page.addInitScript((a) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('videomind.quizAttempts', JSON.stringify([a]));
      sessionStorage.setItem('seeded', '1');
    }
  }, attempt);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).first().getByRole('button', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Review your mistakes' })).toBeVisible();

  await page.getByRole('button', { name: /Retry 2 questions/ }).click();
  for (const answer of ['Lava', '1200°C']) {
    await page.getByRole('radio', { name: answer }).click();
    await page.getByRole('button', { name: /Next|See score/ }).click();
  }
  await expect(page.getByLabel('Grade A+', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByText(/2 since answered right/)).toBeVisible();

  await page.getByRole('button', { name: /Review cards/ }).click();
  await page.keyboard.press('Space');
  await expect(page.getByText('Knew it')).toBeVisible();
  await page.keyboard.press('2');
  await page.keyboard.press('Space');
  await page.keyboard.press('1');
  await expect(page.getByText('Review done')).toBeVisible();
});
