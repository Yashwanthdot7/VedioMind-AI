import { defineConfig, devices } from '@playwright/test';

const API = 3101;
const WEB = 5199;

/**
 * End-to-end tests against the real frontend and the real API, with YouTube, Gemini,
 * voice, pictures and Supabase faked (e2e/fake-backend.cjs). No keys needed.
 *   npm run e2e                 (first time: npx playwright install chromium)
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 }, launchOptions: { executablePath: process.env.CHROME_PATH || undefined } },
      testIgnore: /mobile\.spec/,
    },
    {
      name: 'phone',
      use: { ...devices['Pixel 7'], launchOptions: { executablePath: process.env.CHROME_PATH || undefined } },
      testMatch: /mobile\.spec/,
    },
  ],
  webServer: [
    { command: 'node e2e/fake-backend.cjs', port: API, reuseExistingServer: !process.env.CI, env: { E2E_API_PORT: String(API) } },
    {
      command: `npx vite --port ${WEB} --strictPort`,
      port: WEB,
      reuseExistingServer: !process.env.CI,
      // Real environment variables win over Frontend/.env, so a developer's Supabase keys aren't used here
      env: { VITE_API_URL: `http://localhost:${API}/api`, VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_SUPABASE_ANON_KEY: '' },
    },
  ],
});
