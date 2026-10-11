import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function findLocalChromiumExecutable(): string | undefined {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return undefined;
  const candidate = path.join(
    localAppData,
    'ms-playwright',
    'chromium-1232',
    'chrome-win64',
    'chrome.exe'
  );
  return fs.existsSync(candidate) ? candidate : undefined;
}

const executablePath = findLocalChromiumExecutable();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
