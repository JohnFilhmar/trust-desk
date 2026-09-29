import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

function suspend_button(page: Page): Locator {
  return page.getByRole("button", { name: "Suspend account", exact: true });
}

// The walking skeleton, end to end: browser, handlers, the signed call,
// Rails, MySQL, and back. Each run suspends a different account, so the
// test can run again without a reset.

test("an enforcer suspends an account and the audit trail records it @critical", async ({
  page,
}) => {
  const reason = `Smoke test ${Date.now()}: shared device fingerprint.`;

  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in as Demo Enforcer" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Accounts" })).toBeVisible();

  await page
    .getByRole("navigation", { name: "Filter by status" })
    .getByRole("link", { name: "Active" })
    .click();
  await expect(page).toHaveURL(/status=active/);

  const first_account = page.getByRole("table").getByRole("link").first();
  await expect(first_account).toBeVisible();
  // The list shows the email masked. It must never show a whole address.
  await expect(first_account).toContainText("***@");
  await first_account.click();
  await expect(page).toHaveURL(/\/accounts\/\d+$/);
  const account_url = page.url();

  await suspend_button(page).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const submit = dialog.getByRole("button", { name: "Confirm suspension" });
  await dialog.getByRole("textbox").fill("too short");
  await expect(submit).toBeDisabled();

  await dialog.getByRole("textbox").fill(reason);
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText(reason)).toBeVisible();
  // `exact`, because "Unsuspend account" contains "suspend account", and
  // that button appears the moment the suspension worked.
  await expect(suspend_button(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Unsuspend account", exact: true })).toBeVisible();

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Audit trail" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Audit trail" })).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: reason });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Demo Enforcer");

  // A reload proves the suspension is in the database, not only on the screen.
  await page.goto(account_url);
  await expect(page.getByText(reason)).toBeVisible();
  await expect(suspend_button(page)).toHaveCount(0);
});

test("a viewer sees accounts and is offered no way to suspend one @critical", async ({
  page,
  request,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in as Demo Viewer" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Accounts" })).toBeVisible();

  await page.getByRole("table").getByRole("link").first().click();
  await expect(page).toHaveURL(/\/accounts\/\d+$/);
  await expect(page.getByRole("list", { name: "Risk signals" })).toBeVisible();
  await expect(suspend_button(page)).toHaveCount(0);

  // The missing button is a courtesy. The server is what refuses.
  const account_id = page.url().split("/").at(-1);
  const response = await page.request.post(`/api/accounts/${account_id}/suspend`, {
    data: { reason: "A viewer must not be able to do this." },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe("forbidden");

  // `request` is a separate client with no cookies. It is refused earlier.
  const anonymous = await request.post(`/api/accounts/${account_id}/suspend`, {
    data: { reason: "Nobody is signed in on this client." },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(anonymous.status()).toBe(401);
});
