import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// The demo script, step by step, in a real browser against the whole stack.
// A passing run means the demo works.
//
// The values below are what the seed writes on every run. Run the seed
// before this file: the tests suspend accounts and change the mode.
const ring_fingerprint = "9f2c4e6a8b0d1f3e5a7c9e1b3d5f7a90";

const fields = {
  email: "Email, any part of it",
  fingerprint: "Device fingerprint, the whole value",
};

async function sign_in(page: Page, who: "Viewer" | "Analyst" | "Enforcer"): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: `Sign in as Demo ${who}` }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Accounts" })).toBeVisible();
}

async function search(page: Page, label: string, value: string): Promise<void> {
  const form = page.getByRole("search", { name: "Search accounts" });
  await form.getByLabel(label).fill(value);
  await form.getByRole("button", { name: "Search" }).click();
}

function account_links(page: Page) {
  return page.getByRole("table", { name: "Accounts" }).getByRole("link");
}

async function change_mode(page: Page, mode: string, reason: string): Promise<void> {
  await page.getByRole("button", { name: "Change mode" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: new RegExp(`^${mode}`) }).check();
  await dialog.getByRole("textbox").fill(reason);
  await dialog.getByRole("button", { name: "Change mode" }).click();
  await expect(dialog).toBeHidden();
}

test.describe.configure({ mode: "serial" });

test("an analyst finds the fingerprint ring, reads why it is risky, and reveals PII @critical", async ({
  page,
}) => {
  const reason = `Demo run ${Date.now()}: checking the fingerprint ring.`;

  await sign_in(page, "Analyst");
  await search(page, fields.fingerprint, ring_fingerprint);

  await expect(page).toHaveURL(/fingerprint=9f2c4e6a/);
  await expect(account_links(page)).toHaveCount(12);
  // The analyst typed the whole fingerprint. The results still come back masked.
  await expect(page.getByRole("table", { name: "Accounts" })).not.toContainText("ring-01@");
  await expect(account_links(page).first()).toContainText("***@example.com");

  await account_links(page).first().click();
  await expect(page).toHaveURL(/\/accounts\/\d+$/);
  const account_url = page.url();

  const signals = page.getByRole("list", { name: "Risk signals" });
  await expect(signals).toContainText("11 other accounts signed up with the same device fingerprint");
  await expect(signals.getByRole("listitem")).toHaveCount(7);
  await expect(page.getByLabel("Risk score")).toBeVisible();

  await expect(page.getByText("ring-")).toHaveCount(0);
  await page.getByRole("button", { name: "Reveal PII" }).click();
  const dialog = page.getByRole("dialog");
  const submit = dialog.getByRole("button", { name: "Reveal", exact: true });
  await dialog.getByRole("textbox").fill("too short");
  await expect(submit).toBeDisabled();
  await dialog.getByRole("textbox").fill(reason);
  await submit.click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Revealed", { exact: true })).toBeVisible();
  await expect(page.getByText(/^ring-\d+@example\.com$/)).toBeVisible();
  await expect(page.getByText(ring_fingerprint)).toBeVisible();

  // Revealed values live in the page only. A reload shows the mask again.
  await page.goto(account_url);
  await expect(page.getByRole("list", { name: "Risk signals" })).toBeVisible();
  await expect(page.getByText(/^ring-\d+@example\.com$/)).toHaveCount(0);
  await expect(page.getByText(ring_fingerprint)).toHaveCount(0);

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Audit trail" })
    .click();
  const row = page.getByRole("row").filter({ hasText: reason });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Demo Analyst");
  // The audit row names the fields that were revealed, never their values.
  await expect(row).not.toContainText("ring-");
  await expect(row).not.toContainText(ring_fingerprint);
});

test("an analyst reads a timeline whose payloads are masked @critical", async ({ page }) => {
  await sign_in(page, "Analyst");
  await search(page, fields.email, "miner-01");
  await expect(account_links(page)).toHaveCount(1);
  await account_links(page).first().click();

  const timeline = page.getByRole("region", { name: "Timeline" });
  // The events only. The section also holds the filter, whose options name
  // every event type.
  const events = timeline.getByRole("list").first();
  await expect(events).toBeVisible();
  await expect(events).toContainText("CPU spike");
  // No whole IPv4 address anywhere in the events. A masked one ends in xxx.
  await expect(events).not.toContainText(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);

  await timeline.getByLabel("Event type").selectOption({ label: "CPU spike" });
  await expect(events).not.toContainText("Signed in");
  await expect(events).not.toContainText("Deploy");
  await expect(events).toContainText("CPU spike");
});

test("the risk panel says when days were counted from raw events @critical", async ({ page }) => {
  await sign_in(page, "Analyst");
  await search(page, fields.email, "stats-gap-01");
  await account_links(page).first().click();

  await expect(page.getByRole("list", { name: "Risk signals" })).toBeVisible();
  await expect(page.getByText(/raw events/i).first()).toBeVisible();
});

test("a viewer cannot search by PII, in the console or through the API @critical", async ({
  page,
}) => {
  await sign_in(page, "Viewer");

  await expect(page.getByRole("search", { name: "Search accounts" })).toHaveCount(0);
  await expect(page.getByText(/can filter by status only/)).toBeVisible();
  await expect(account_links(page).first()).toBeVisible();

  const refused = await page.request.get("/api/accounts?email=ring-01");
  expect(refused.status()).toBe(403);
  expect((await refused.json()).error.code).toBe("forbidden");

  await account_links(page).first().click();
  await expect(page.getByRole("list", { name: "Risk signals" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reveal PII" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Suspend account" })).toHaveCount(0);

  const account_id = page.url().split("/").at(-1);
  const reveal = await page.request.post(`/api/accounts/${account_id}/reveal`, {
    data: { reason: "A viewer must not be able to do this." },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(reveal.status()).toBe(403);
  expect(JSON.stringify(await reveal.json())).not.toContain("@example");
});

test("an enforcer marks an account as spam, suspends it and lifts the suspension @critical", async ({
  page,
}) => {
  const stamp = Date.now();
  const reasons = {
    spam: `Demo run ${stamp}: reported for hosting a phishing page.`,
    suspend: `Demo run ${stamp}: suspended while the report is checked.`,
    unsuspend: `Demo run ${stamp}: the report was a false alarm.`,
  };

  await sign_in(page, "Enforcer");
  await page
    .getByRole("navigation", { name: "Filter by status" })
    .getByRole("link", { name: "Active" })
    .click();
  await expect(page).toHaveURL(/status=active/);
  // The newest accounts are clean ones, which nobody has marked or suspended.
  await account_links(page).first().click();
  await expect(page).toHaveURL(/\/accounts\/\d+$/);

  async function act(trigger: string, confirm: string, reason: string): Promise<void> {
    await page.getByRole("button", { name: trigger, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill(reason);
    await dialog.getByRole("button", { name: confirm, exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(reason)).toBeVisible();
  }

  await act("Mark as spam", "Confirm spam mark", reasons.spam);
  await expect(page.getByRole("button", { name: "Mark as spam", exact: true })).toHaveCount(0);

  await act("Suspend account", "Confirm suspension", reasons.suspend);
  await expect(page.getByRole("button", { name: "Suspend account", exact: true })).toHaveCount(0);

  await act("Unsuspend account", "Lift the suspension", reasons.unsuspend);
  await expect(page.getByRole("button", { name: "Suspend account", exact: true })).toBeVisible();

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Audit trail" })
    .click();
  for (const reason of Object.values(reasons)) {
    await expect(page.getByRole("row").filter({ hasText: reason })).toContainText(
      "Demo Enforcer",
    );
  }
});

test("lockdown switches unsuspend off, for the console and for the API @critical", async ({
  page,
}) => {
  const stamp = Date.now();
  await sign_in(page, "Enforcer");

  try {
    await change_mode(page, "Lockdown", `Demo run ${stamp}: simulated attack in progress.`);

    const banner = page.getByRole("status", { name: "Operational mode" });
    await expect(banner).toContainText("Lockdown");
    await expect(banner).toContainText(`Demo run ${stamp}`);

    await page
      .getByRole("navigation", { name: "Filter by status" })
      .getByRole("link", { name: "Suspended" })
      .click();
    await account_links(page).first().click();
    await expect(page).toHaveURL(/\/accounts\/\d+$/);

    await expect(page.getByRole("button", { name: "Unsuspend account" })).toHaveCount(0);
    await expect(page.getByText(/switched off during lockdown/i)).toBeVisible();

    // The missing button is a courtesy. Rails is what refuses.
    const account_id = page.url().split("/").at(-1);
    const refused = await page.request.post(`/api/accounts/${account_id}/unsuspend`, {
      data: { reason: "Trying to lift a suspension during lockdown." },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(refused.status()).toBe(409);
    expect((await refused.json()).error.code).toBe("blocked_by_lockdown");
  } finally {
    // Whatever happened above, the next test must not start in lockdown.
    await page.goto("/accounts");
    await change_mode(page, "Normal", `Demo run ${stamp}: the simulated attack is over.`);
    await expect(page.getByRole("status", { name: "Operational mode" })).toHaveCount(0);
  }
});

test("signing out leaves nothing behind @critical", async ({ page }) => {
  await sign_in(page, "Analyst");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/accounts");
  await expect(page).toHaveURL(/\/login$/);

  const accounts = await page.request.get("/api/accounts");
  expect(accounts.status()).toBe(401);
});
