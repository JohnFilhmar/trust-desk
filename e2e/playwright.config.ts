import { defineConfig } from "@playwright/test";

// BASE_URL points at the Compose stack locally and at the live site after a
// deploy, so the same smoke test covers both.
const base_url = process.env["BASE_URL"] ?? "http://web:5173";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  // One test at a time. The tests share one database, and one of them puts
  // the console in lockdown, which would break any test running beside it.
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: base_url,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    // Only for the edge rehearsal, whose certificate is self-signed. Never
    // set it against the live site, where the certificate must be valid.
    ignoreHTTPSErrors: process.env["IGNORE_HTTPS_ERRORS"] === "1",
  },
});
