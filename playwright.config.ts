import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  webServer: {
    command: 'PARTICLE_MESSAGE_PASSWORD=particle-test PARTICLE_MESSAGE_SESSION_SECRET=local-review-session npm start -- --hostname 127.0.0.1',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  timeout: 30000,
  use: { baseURL: 'http://localhost:3000', channel: 'chrome', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
});
