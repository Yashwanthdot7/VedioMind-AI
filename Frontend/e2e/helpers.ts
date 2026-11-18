import { Page, expect } from '@playwright/test';

/** Stand-in for YouTube's player script, so tests run offline */
const YT_STUB = `window.YT = { PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 }, Player: function (el, opts) {
  const node = typeof el === 'string' ? document.getElementById(el) : el;
  const box = document.createElement('div'); box.setAttribute('data-testid', 'fake-youtube'); box.textContent = 'video';
  node.replaceWith(box);
  const api = { getCurrentTime: () => 0, seekTo() {}, playVideo() {}, pauseVideo() {}, getIframe: () => box, destroy() {}, getPlayerState: () => 2 };
  setTimeout(() => opts && opts.events && opts.events.onReady && opts.events.onReady({ target: api }), 20);
  return api;
} }; setTimeout(() => window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(), 0);`;

export async function offlineYouTube(page: Page) {
  await page.route('**/iframe_api*', (r) => r.fulfill({ contentType: 'text/javascript', body: YT_STUB }));
  await page.route('**/www-widgetapi*', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 404, body: '' }));
}

export const API = 'http://localhost:3101/api';

/** Open the full-screen menu and pick a page */
export async function goTo(page: Page, label: string) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Menu' });
  await menu.getByRole('button', { name: label, exact: true }).click();
  await expect(menu).toBeHidden();
}

export async function openLessons(page: Page) {
  await page.goto('/');
  await goTo(page, 'Video lessons');
  await expect(page.getByRole('heading', { name: 'Create a video lesson' })).toBeVisible();
}
