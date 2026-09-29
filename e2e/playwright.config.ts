import { defineConfig } from "@playwright/test";

// BASE_URL points at the Compose stack locally and at the live site after a
// deploy, so the same smoke test covers both.
const base_url = process.env["BASE_URL"] ?? "http://web:5173";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: base_url,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
});
