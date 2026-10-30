import { defineConfig } from '@playwright/test'

// E2E contra el Appwrite real. Requiere `npm run build` previo y E2E_USERS=<ruta al JSON de usuarios de prueba>.
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  workers: 1,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173/fng-operadores/',
    viewport: { width: 1440, height: 900 },
    actionTimeout: 20_000,
    launchOptions: { executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' },
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined,
  },
  webServer: { command: 'npx vite preview --port 4173 --host 127.0.0.1', url: 'http://localhost:4173/fng-operadores/', reuseExistingServer: true },
})
