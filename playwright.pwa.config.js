import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e-pwa',
    fullyParallel: false,
    workers: 1,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: 'http://127.0.0.1:4174',
        trace: 'on-first-retry'
    },
    projects: [
        { name: 'chromium-pwa', use: { ...devices['Desktop Chrome'] } }
    ],
    webServer: {
        command: 'pnpm preview --host 127.0.0.1 --port 4174',
        url: 'http://127.0.0.1:4174/TidyScore/',
        reuseExistingServer: false
    }
});
