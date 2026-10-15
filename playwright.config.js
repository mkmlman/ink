import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  use: {
    browserName: 'chromium',
    launchOptions: {
      args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader']
    }
  },
  webServer: {
    command: 'python3 -m http.server 8080 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000
  }
});
