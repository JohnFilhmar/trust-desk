import { describe, expect, it } from "@jest/globals";
import { audit_log_response_schema } from "@trust-desk/shared";
import type { AuditLogEntry } from "@trust-desk/shared";
import { dispatch } from "#app/router.ts";
import { console_request, fake_deps, staff_lookup } from "#app/test_utils/fake_deps.ts";
import type { AuditLogArgs } from "#app/types/rows.ts";

const entry: AuditLogEntry = {
  id: 1,
  action: "account.suspend",
  actor: { id: 3, display_name: "Demo Enforcer" },
  account_id: 42,
  details: {
    enforcement_action_id: 1,
    previous_status: "active",
    new_status: "suspended",
    reason: "Twelve accounts share this fingerprint.",
  },
  correlation_id: "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f",
  created_at: "2026-09-30T01:02:03.456789Z",
};

function deps_recording(): { deps: ReturnType<typeof fake_deps>; asked: AuditLogArgs[] } {
  const asked: AuditLogArgs[] = [];
  const deps = fake_deps({
    ...staff_lookup(),
    list_audit_logs: async (args) => {
      asked.push(args);
      return [entry];
    },
  });
  return { deps, asked };
}

describe("GET /api/audit_logs", () => {
  it("returns the rows in the shared shape", async () => {
    const { deps } = deps_recording();
    const res = await dispatch(console_request("GET", "/api/audit_logs", { as: "viewer" }), deps);

    expect(res.status).toBe(200);
    expect(audit_log_response_schema.parse(await res.json()).items).toEqual([entry]);
  });

  it("asks for every row, 50 at most, when no account is named", async () => {
    const { deps, asked } = deps_recording();
    await dispatch(console_request("GET", "/api/audit_logs", { as: "viewer" }), deps);
    expect(asked).toEqual([{ account_id: null, limit: 50 }]);
  });

  it("filters by account", async () => {
    const { deps, asked } = deps_recording();
    await dispatch(
      console_request("GET", "/api/audit_logs?account_id=42&limit=10", { as: "analyst" }),
      deps,
    );
    expect(asked).toEqual([{ account_id: 42, limit: 10 }]);
  });

  it.each(["/api/audit_logs?account_id=abc", "/api/audit_logs?limit=1000"])(
    "answers 422 for %s",
    async (path) => {
      const { deps, asked } = deps_recording();
      const res = await dispatch(console_request("GET", path, { as: "viewer" }), deps);
      expect(res.status).toBe(422);
      expect(asked).toHaveLength(0);
    },
  );
});
