import { expect, test } from "@playwright/test";

test("the console loads and the API answers through the same origin @smoke", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trust Desk");

  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok", database: "up" });
});
