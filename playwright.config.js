// End-to-end tests: real browser + real API + real MongoDB (replica set, for transactions).
// Run locally:  docker run -d --name kidsla-mongo -p 27017:27017 mongo:7 --replSet rs0
//               docker exec kidsla-mongo mongosh --eval 'rs.initiate()'
//               npm test
// The tests DROP their database (kidsla_e2e). They refuse to run against MongoDB Atlas.
import { defineConfig, devices } from '@playwright/test'

export const TEST_ENV = {
  MONGODB_URI: process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true',
  MONGODB_DB: 'kidsla_e2e',
  ADMIN_PASSWORD: 'e2e-Test-Passw0rd-123',
  ADMIN_SESSION_SECRET: 'e2e'.repeat(22),
  RESEND_API_KEY: 're_test_key',
  ALERT_EMAIL_TO: 'owner@example.com',
  RESEND_API_URL: 'http://127.0.0.1:4999/emails', // mock Resend server started in tests/global-setup.js
  CRON_SECRET: 'e2e-cron-secret',
  PAYHERE_MERCHANT_ID: '1211149',
  PAYHERE_MERCHANT_SECRET: 'e2e-payhere-secret',
  PAYHERE_MODE: 'sandbox',
  CLOUDINARY_URL: 'cloudinary://123456789012345:e2e-cloudinary-secret@kidsla-test',
  VITE_SITE_URL: 'http://localhost:4173',
  VITE_SENTRY_DSN: '',
  VITE_META_PIXEL_ID: '',
}
if (/mongodb\.net/.test(TEST_ENV.MONGODB_URI)) throw new Error('Refusing to run tests against MongoDB Atlas: the tests delete data.')

export default defineConfig({
  testDir: 'tests',
  fullyParallel: false,
  workers: 1, // one shared test database
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './tests/global-setup.js',
  use: {
    baseURL: 'http://localhost:4173',
    trace: process.env.CI ? 'retain-on-failure' : 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/api/session',
    reuseExistingServer: false,
    timeout: 120_000,
    env: TEST_ENV,
  },
})
