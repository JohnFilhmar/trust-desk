import { describe, expect, it } from "@jest/globals";
import { error_envelope_schema, reveal_response_schema } from "@trust-desk/shared";
import type { InternalRevealRequest, InternalRevealResult } from "@trust-desk/shared";
import type { CoreApiResult } from "#app/interfaces/deps.ts";
import { dispatch } from "#app/router.ts";
import {
  account_row,
  console_request,
  fake_deps,
  staff_lookup,
  test_correlation_id,
} from "#app/test_utils/fake_deps.ts";

const reason = "Checking a reported phishing page.";
const raw_values = ["jordan.lee", "192.0.2.17", "fp_a1b2c3d4e5f6", "Windows NT"];

function rails_answers(outcome: CoreApiResult<InternalRevealResult>) {
  const calls: { body: InternalRevealRequest; correlation_id: string }[] = [];
  const deps = fake_deps(
    { ...staff_lookup(), find_account_by_id: async () => account_row() },
    {
      record_reveal: async (body, correlation_id) => {
        calls.push({ body, correlation_id });
        return outcome;
      },
    },
  );
  return { deps, calls };
}

function reveal(as: "viewer" | "analyst" | "enforcer", body: unknown = { reason }): Request {
  return console_request("POST", "/api/accounts/42/reveal", { as, body });
}

function expect_nothing_revealed(text: string): void {
  for (const value of raw_values) expect(text).not.toContain(value);
}

describe("POST /api/accounts/:account_id/reveal", () => {
  it("unmasks the account once Rails has written the audit row", async () => {
    const { deps } = rails_answers({ kind: "ok", result: { audit_log_id: 7 } });
    const res = await dispatch(reveal("analyst"), deps);
    const body = reveal_response_schema.parse(await res.json());

    expect(res.status).toBe(200);
    expect(body.audit_log_id).toBe(7);
    expect(body.account.pii_revealed).toBe(true);
    expect(body.account.email).toBe("jordan.lee@example.com");
    expect(body.account.signup_context.ip).toBe("192.0.2.17");
    expect(body.account.signup_context.device_fingerprint).toBe("fp_a1b2c3d4e5f6");
  });

  it("tells Rails who, which account, why and which fields, and no value", async () => {
    const { deps, calls } = rails_answers({ kind: "ok", result: { audit_log_id: 7 } });
    await dispatch(reveal("analyst", { reason, actor_staff_user_id: 3 }), deps);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.body).toEqual({
      actor_staff_user_id: 2,
      account_id: 42,
      reason,
      fields: ["email", "signup_ip", "device_fingerprint", "user_agent"],
    });
    expect(calls[0]?.correlation_id).toBe(test_correlation_id);
    expect_nothing_revealed(JSON.stringify(calls));
  });

  it("refuses a viewer before Rails is asked", async () => {
    const { deps, calls } = rails_answers({ kind: "ok", result: { audit_log_id: 7 } });
    const res = await dispatch(reveal("viewer"), deps);
    const text = await res.text();

    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
    expect_nothing_revealed(text);
  });

  it.each([
    ["Rails is down", { kind: "unavailable", reason: "network: TimeoutError" }],
    ["Rails answers with something unexpected", { kind: "unavailable", reason: "status 500" }],
    ["Rails refuses with a code this service does not know", { kind: "rejected", status: 409, code: "new" }],
  ] satisfies [string, CoreApiResult<InternalRevealResult>][])(
    "reveals nothing when %s",
    async (_name, outcome) => {
      const { deps } = rails_answers(outcome);
      const res = await dispatch(reveal("analyst"), deps);
      const text = await res.text();

      expect(res.status).toBe(503);
      expect(error_envelope_schema.parse(JSON.parse(text)).error.code).toBe(
        "core_api_unavailable",
      );
      expect_nothing_revealed(text);
    },
  );

  it("reveals nothing when Rails says the user may not", async () => {
    const { deps } = rails_answers({ kind: "rejected", status: 403, code: "forbidden" });
    const res = await dispatch(reveal("analyst"), deps);
    const text = await res.text();

    expect(res.status).toBe(403);
    expect_nothing_revealed(text);
  });

  it.each([
    ["no reason", {}],
    ["a reason of 9 characters", { reason: "123456789" }],
    ["a reason of only spaces", { reason: " ".repeat(30) }],
  ])("answers 422 for %s, asks Rails nothing and reveals nothing", async (_name, body) => {
    const { deps, calls } = rails_answers({ kind: "ok", result: { audit_log_id: 7 } });
    const res = await dispatch(reveal("analyst", body), deps);
    const text = await res.text();

    expect(res.status).toBe(422);
    expect(calls).toHaveLength(0);
    expect_nothing_revealed(text);
  });

  it("answers 404 for an unknown account and asks Rails nothing", async () => {
    const { deps, calls } = rails_answers({ kind: "ok", result: { audit_log_id: 7 } });
    deps.db.find_account_by_id = async () => null;
    const res = await dispatch(reveal("analyst"), deps);

    expect(res.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it("logs the ids and never a revealed value or the reason", async () => {
    const { deps } = rails_answers({ kind: "ok", result: { audit_log_id: 7 } });
    await dispatch(reveal("analyst"), deps);

    const logged = JSON.stringify(deps.logger);
    expect_nothing_revealed(logged);
    expect(logged).not.toContain("phishing");
  });

  it("forbids caching of the response", async () => {
    const { deps } = rails_answers({ kind: "ok", result: { audit_log_id: 7 } });
    const res = await dispatch(reveal("analyst"), deps);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
