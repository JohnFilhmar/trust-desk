import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import {
  enforcement_result_schema,
  error_envelope_schema,
} from "@trust-desk/shared";
import type { InternalEnforcementRequest } from "@trust-desk/shared";
import type { CoreApiResult } from "#app/interfaces/deps.ts";
import { dispatch } from "#app/router.ts";
import {
  console_request,
  fake_deps,
  staff_lookup,
  test_correlation_id,
} from "#app/test_utils/fake_deps.ts";

const result = enforcement_result_schema.parse(
  JSON.parse(
    readFileSync(
      join(__dirname, "../../../../packages/shared/fixtures/enforcement_result.json"),
      "utf8",
    ),
  ),
);

const reason = "Twelve accounts share this fingerprint.";

function suspend(body: unknown, path = "/api/accounts/42/suspend"): Request {
  return console_request("POST", path, { as: "enforcer", body });
}

function rails_answers(outcome: CoreApiResult) {
  const calls: {
    account_id: number;
    body: InternalEnforcementRequest;
    correlation_id: string;
  }[] = [];
  const deps = fake_deps(staff_lookup(), {
    suspend_account: async (account_id, body, correlation_id) => {
      calls.push({ account_id, body, correlation_id });
      return outcome;
    },
  });
  return { deps, calls };
}

describe("POST /api/accounts/:account_id/suspend", () => {
  it("passes on what Rails recorded, with status 201", async () => {
    const { deps, calls } = rails_answers({ kind: "ok", result });
    const res = await dispatch(suspend({ reason }), deps);

    expect(res.status).toBe(201);
    expect(enforcement_result_schema.parse(await res.json())).toEqual(result);
    expect(calls).toHaveLength(1);
  });

  it("sends the signed-in user's id, never one from the request", async () => {
    const { deps, calls } = rails_answers({ kind: "ok", result });
    await dispatch(suspend({ reason, actor_staff_user_id: 1 }), deps);

    expect(calls[0]?.body).toEqual({ actor_staff_user_id: 3, reason });
    expect(calls[0]?.account_id).toBe(42);
    expect(calls[0]?.correlation_id).toBe(test_correlation_id);
  });

  it("trims the reason before sending it", async () => {
    const { deps, calls } = rails_answers({ kind: "ok", result });
    await dispatch(suspend({ reason: `   ${reason}   ` }), deps);
    expect(calls[0]?.body.reason).toBe(reason);
  });

  it.each([
    ["no reason", {}],
    ["a reason of 9 characters", { reason: "123456789" }],
    ["a reason of only spaces", { reason: " ".repeat(20) }],
    ["a reason of 501 characters", { reason: "x".repeat(501) }],
    ["a reason that is a number", { reason: 1234567890 }],
  ])("answers 422 for %s and never calls Rails", async (_name, body) => {
    const { deps, calls } = rails_answers({ kind: "ok", result });
    const res = await dispatch(suspend(body), deps);

    expect(res.status).toBe(422);
    expect(error_envelope_schema.parse(await res.json()).error.code).toBe(
      "invalid_request",
    );
    expect(calls).toHaveLength(0);
  });

  it("answers 404 for an id that is not a number and never calls Rails", async () => {
    const { deps, calls } = rails_answers({ kind: "ok", result });
    const res = await dispatch(suspend({ reason }, "/api/accounts/abc/suspend"), deps);
    expect(res.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it.each([
    [409, "already_suspended"],
    [404, "account_not_found"],
    [403, "forbidden"],
    [422, "invalid_request"],
  ])("passes on a %i %s from Rails with its own wording", async (status, code) => {
    const { deps } = rails_answers({ kind: "rejected", status, code });
    const res = await dispatch(suspend({ reason }), deps);
    const { error } = error_envelope_schema.parse(await res.json());

    expect(res.status).toBe(status);
    expect(error.code).toBe(code);
    expect(error.correlation_id).toBe(test_correlation_id);
  });

  it("answers 503 when Rails is down, and says nothing was changed", async () => {
    const { deps } = rails_answers({ kind: "unavailable", reason: "network: TimeoutError" });
    const res = await dispatch(suspend({ reason }), deps);
    const text = await res.text();

    expect(res.status).toBe(503);
    expect(error_envelope_schema.parse(JSON.parse(text)).error.code).toBe(
      "core_api_unavailable",
    );
    expect(text).not.toContain("TimeoutError");
    expect(deps.logger.error).toHaveBeenCalledTimes(1);
  });

  it("answers 503 for a code it does not know, not whatever Rails sent", async () => {
    const { deps } = rails_answers({
      kind: "rejected",
      status: 409,
      code: "something_new",
    });
    const res = await dispatch(suspend({ reason }), deps);
    expect(res.status).toBe(503);
  });
});
