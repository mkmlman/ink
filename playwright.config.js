import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader']
        }
      }
    },
    {
      name: 'webkit-smoke',
      testMatch: '**/compat.spec.js',
      use: { browserName: 'webkit' }
    }
  ],
  webServer: {
    command: 'python3 -m http.server 8080 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000
  }
});
