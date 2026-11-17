import { defineConfig, devices } from '@playwright/test'

const isCI = process.env.CI !== undefined

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/results',

  forbidOnly: isCI,

  retries: isCI ? 2 : 0,

  globalTimeout: isCI ? 10 * 60_000 : 0,

  reporter: isCI ? [['list'], ['github']] : 'html',

  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'astro build && astro preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
})
