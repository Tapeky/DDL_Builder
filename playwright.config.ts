import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @deadlock/api start',
      url: 'http://127.0.0.1:3001/v1/health',
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter @deadlock/web start',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: false,
    },
  ],
});
