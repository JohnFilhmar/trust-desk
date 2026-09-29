import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { group_permissions, has_permission, permissions_for } from "./permissions.ts";

const fixture: unknown = JSON.parse(
  readFileSync(join(__dirname, "../../fixtures/group_permissions.json"), "utf8"),
);

describe("group_permissions", () => {
  it("matches the fixture that the Rails tests also read", () => {
    expect(group_permissions).toEqual(fixture);
  });

  it("lets only an enforcer enforce", () => {
    expect(has_permission("viewer", "accounts.enforce")).toBe(false);
    expect(has_permission("analyst", "accounts.enforce")).toBe(false);
    expect(has_permission("enforcer", "accounts.enforce")).toBe(true);
  });

  it("never lets a viewer reveal or search by PII", () => {
    expect(has_permission("viewer", "pii.reveal")).toBe(false);
    expect(has_permission("viewer", "accounts.search_pii")).toBe(false);
  });

  it("returns a copy, so a caller cannot widen a group", () => {
    const copy = permissions_for("viewer");
    copy.push("accounts.enforce");
    expect(has_permission("viewer", "accounts.enforce")).toBe(false);
  });
});
