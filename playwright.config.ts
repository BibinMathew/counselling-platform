import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3000";
if (!/^\d{1,5}$/.test(port)) {
  throw new Error("PLAYWRIGHT_PORT must be a valid numeric port.");
}

const baseURL = `http://127.0.0.1:${port}`;
const serverCommand =
  process.env.PLAYWRIGHT_USE_PRODUCTION === "1"
    ? `pnpm start --hostname 127.0.0.1 --port ${port}`
    : `NEXT_DIST_DIR=.next-playwright-${port} pnpm dev --hostname 127.0.0.1 --port ${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
  },
  webServer: {
    command: serverCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
