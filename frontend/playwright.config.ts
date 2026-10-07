import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './test/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: 'npm --prefix ../backend start',
      // Playwright accepts HTTP 404 while the backend has no routes yet.
      url: 'http://127.0.0.1:3001',
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm start --hostname 127.0.0.1 --port 3000',
      url: 'http://127.0.0.1:3000',
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
