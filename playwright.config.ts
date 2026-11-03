import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: '*.pw.ts', timeout: 90000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:1432', browserName: 'chromium',
    channel: process.platform === 'win32' ? 'chrome' : undefined,
    viewport: { width: 1440, height: 1050 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 1432 --strictPort', url: 'http://127.0.0.1:1432', reuseExistingServer: false },
});
