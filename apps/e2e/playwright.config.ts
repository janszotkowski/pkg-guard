import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

/**
 * The built backend and frontend, started as production runs them, over an in-memory database: no worker runs, so a
 * package that is looked up is queued and stays queued, which the pages must cope with. Run `pnpm build` first; the
 * frontend is built again here, for the API address of these tests. The ports differ from `pnpm dev` (3100/4100) and
 * from the smoke test (3150/4150), so all three can run at once.
 */
const BACKEND_PORT = 4160;
const FRONTEND_PORT = 3160;
const backend = `http://127.0.0.1:${BACKEND_PORT}`;
const frontend = `http://127.0.0.1:${FRONTEND_PORT}`;
const root = fileURLToPath(new URL('../..', import.meta.url));
const ci = process.env['CI'] !== undefined && process.env['CI'] !== '';
// Fixed tokens of the required length: the worker's (nothing claims jobs here) and the frontend's server rendering, so its requests are not rate limited.
const WORKER_TOKEN = 'e2e-worker-token-that-is-long-enough-1234567';
const INTERNAL_API_TOKEN = 'e2e-internal-token-that-is-long-enough-123456';
// Locally, the installed Google Chrome (kept up to date by itself) in its sandbox, not Playwright's own Chromium,
// which lags behind Chrome's security fixes and runs without a sandbox. CI keeps the downloaded Chromium.
const chrome = ci ? {} : { channel: 'chrome', launchOptions: { chromiumSandbox: true } };

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: ci,
    retries: ci ? 1 : 0,
    reporter: ci ? 'list' : [['list'], ['html', { open: 'never' }]],
    timeout: 20_000,
    expect: { timeout: 10_000 },
    use: { baseURL: frontend, trace: 'on-first-retry', locale: 'en-US', ...chrome },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
        { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
    ],
    webServer: [
        {
            command: 'node apps/backend/dist/main.api.mjs',
            cwd: root,
            url: `${backend}/v1/health`,
            reuseExistingServer: false,
            timeout: 60_000,
            env: {
                NODE_ENV: 'test',
                HOST: '127.0.0.1',
                PORT: String(BACKEND_PORT),
                LOG_LEVEL: 'silent',
                DATABASE_PATH: ':memory:',
                CORS_ORIGINS: frontend,
                RATE_LIMIT_PER_MINUTE: '100000',
                WORKER_TOKEN,
                INTERNAL_API_TOKEN,
            },
        },
        {
            command: 'pnpm --filter @pkg-guard/frontend build && node apps/frontend/.output/server/index.mjs',
            cwd: root,
            url: `${frontend}/about`,
            reuseExistingServer: false,
            timeout: 240_000,
            env: {
                VITE_API_URL: backend,
                VITE_SITE_URL: frontend,
                VITE_ALLOW_INDEXING: 'false',
                HOST: '127.0.0.1',
                PORT: String(FRONTEND_PORT),
                API_INTERNAL_URL: backend,
                INTERNAL_API_TOKEN,
            },
        },
    ],
});
