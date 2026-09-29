import { expect, test } from "@playwright/test";

test("the console loads and the API answers through the same origin @smoke", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Trust Desk");

  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok", database: "up" });
});

test("a visitor who is not signed in is sent to the login page @smoke", async ({ page }) => {
  await page.goto("/accounts");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to Trust Desk");
});

test("the API refuses a request with no session @smoke", async ({ request }) => {
  const accounts = await request.get("/api/accounts");
  expect(accounts.status()).toBe(401);
  expect((await accounts.json()).error.code).toBe("unauthenticated");
});
