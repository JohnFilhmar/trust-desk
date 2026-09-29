import { describe, expect, it } from "@jest/globals";
import { account_detail_response_schema, error_envelope_schema } from "@trust-desk/shared";
import type { StaffGroup } from "@trust-desk/shared";
import { dispatch } from "#app/router.ts";
import {
  account_row,
  console_request,
  fake_deps,
  staff_lookup,
} from "#app/test_utils/fake_deps.ts";

const groups: StaffGroup[] = ["viewer", "analyst", "enforcer"];

describe("GET /api/accounts/:account_id", () => {
  it.each(groups)("masks every PII field for a %s", async (group) => {
    const deps = fake_deps({
      ...staff_lookup(),
      find_account_by_id: async () => account_row(),
    });
    const res = await dispatch(console_request("GET", "/api/accounts/42", { as: group }), deps);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).not.toContain("jordan.lee");
    expect(text).not.toContain("192.0.2.17");
    expect(text).not.toContain("fp_a1b2c3d4e5f6");
    expect(text).not.toContain("Windows NT");

    const { account } = account_detail_response_schema.parse(JSON.parse(text));
    expect(account.pii_revealed).toBe(false);
    expect(account.email).toBe("j***@example.com");
    expect(account.signup_context).toEqual({
      ip: "192.0.2.xxx",
      country: "PH",
      user_agent: "Mozilla/5.0 ***",
      device_fingerprint: "fp_a1b***",
      referral: null,
    });
  });

  it("lists the enforcement actions of that account", async () => {
    const action = {
      id: 7,
      account_id: 42,
      staff_user_id: 3,
      action_type: "suspend" as const,
      reason: "Shared fingerprint cluster.",
      correlation_id: "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f",
      created_at: "2026-09-30T01:02:03.456789Z",
    };
    let asked_for: number | null = null;
    const deps = fake_deps({
      ...staff_lookup(),
      find_account_by_id: async () => account_row({ status: "suspended" }),
      list_enforcement_actions: async (account_id) => {
        asked_for = account_id;
        return [action];
      },
    });
    const res = await dispatch(console_request("GET", "/api/accounts/42", { as: "viewer" }), deps);
    const body = account_detail_response_schema.parse(await res.json());

    expect(asked_for).toBe(42);
    expect(body.enforcement_actions).toEqual([action]);
  });

  it.each(["/api/accounts/999", "/api/accounts/abc", "/api/accounts/-1", "/api/accounts/1.5"])(
    "answers the same 404 for %s, so the response does not reveal which ids exist",
    async (path) => {
      const deps = fake_deps(staff_lookup());
      const res = await dispatch(console_request("GET", path, { as: "viewer" }), deps);
      expect(res.status).toBe(404);
      expect(error_envelope_schema.parse(await res.json()).error.code).toBe(
        "account_not_found",
      );
    },
  );
});
