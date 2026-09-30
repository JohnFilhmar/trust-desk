import { expect, test } from "@playwright/test";
import type { ConsoleMessage, Page } from "@playwright/test";

// Catches what only a real page shows: a script or a style that the
// Content-Security-Policy blocks, and any error nothing caught. The CSP is
// set by host nginx, so this test means most against the live site or the
// edge rehearsal in docker-compose.edge-test.yml.

function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (error) => {
    problems.push(`page error: ${error.message}`);
  });
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // The browser also logs every refused request, such as the 401 the
    // session check gets before sign-in. Those answers are checked by the
    // other tests, so they are not counted here.
    if (text.startsWith("Failed to load resource")) return;
    problems.push(`console error: ${text}`);
  });
  return problems;
}

test.beforeEach(async ({ page }) => {
  // Turns every CSP violation into a console error, which watch() collects.
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      console.error(`CSP violation: ${event.violatedDirective} blocked ${event.blockedURI}`);
    });
  });
});

test("the console runs with no script error and no CSP violation @smoke", async ({ page }) => {
  const problems = watch(page);

  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in as Demo Enforcer" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Accounts" })).toBeVisible();

  await page.getByRole("table", { name: "Accounts" }).getByRole("link").first().click();
  await expect(page.getByRole("list", { name: "Risk signals" })).toBeVisible();

  // Radix positions its dialogs with inline style attributes, which the CSP
  // has to allow. A dialog that opens and closes proves it does.
  await page.getByRole("button", { name: "Reveal PII" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Change mode" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Audit trail" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Audit trail" })).toBeVisible();

  expect(problems).toEqual([]);
});
