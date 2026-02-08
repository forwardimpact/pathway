import { defineConfig, devices } from "@playwright/test";

function parseProxy() {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (!proxyUrl) return undefined;

  try {
    const url = new URL(proxyUrl);
    return {
      server: `${url.protocol}//${url.hostname}:${url.port}`,
      bypass: "localhost,127.0.0.1",
      username: url.username || undefined,
      password: url.password || undefined,
    };
  } catch {
    return { server: proxyUrl, bypass: "localhost,127.0.0.1" };
  }
}

export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.js",
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000/",
    trace: "on-first-retry",
    proxy: parseProxy(),
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
          ],
        },
      },
    },
  ],
  webServer: {
    command: "npm start",
    url: "http://localhost:3000/",
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
