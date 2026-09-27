import { defineConfig, devices } from '@playwright/test';

/**
 * E2E против docker-compose.e2e.yml (мок Telegram + реальные API и Postgres):
 *   docker compose -f docker-compose.e2e.yml up -d --build
 *   pnpm --filter @hyzmat/web e2e
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8080',
    trace: 'retain-on-failure',
    locale: 'ru-RU',
  },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
});
