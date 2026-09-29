import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import {
  error_envelope_schema,
  internal_mode_change_result_schema,
  operational_mode_schema,
} from "@trust-desk/shared";
import type {
  InternalModeChangeRequest,
  InternalModeChangeResult,
  StaffGroup,
} from "@trust-desk/shared";
import type { CoreApiResult } from "#app/interfaces/deps.ts";
import { dispatch } from "#app/router.ts";
import { console_request, fake_deps, staff_lookup } from "#app/test_utils/fake_deps.ts";
import type { CurrentModeRow } from "#app/types/rows.ts";

const rails_result = internal_mode_change_result_schema.parse(
  JSON.parse(
    readFileSync(
      join(
        __dirname,
        "../../../../packages/shared/fixtures/internal_mode_change_result.json",
      ),
      "utf8",
    ),
  ),
);

const reason = "Signup burst from one network in the last hour.";

function mode_row(mode: CurrentModeRow["mode"]): CurrentModeRow {
  return {
    mode,
    reason,
    staff_user_id: 3,
    display_name: "Demo Enforcer",
    created_at: "2026-09-30T01:02:03.456789Z",
  };
}

describe("GET /api/operational_mode", () => {
  it.each([
    ["normal", 60, true],
    ["elevated", 40, true],
    ["lockdown", 40, false],
  ] as const)(
    "in %s mode the threshold is %i and unsuspend allowed is %s",
    async (mode, review_threshold, unsuspend_allowed) => {
      const deps = fake_deps({
        ...staff_lookup(),
        find_current_mode: async () => mode_row(mode),
      });
      const res = await dispatch(
        console_request("GET", "/api/operational_mode", { as: "viewer" }),
        deps,
      );
      const body = operational_mode_schema.parse(await res.json());

      expect(res.status).toBe(200);
      expect(body).toMatchObject({
        mode,
        reason,
        review_threshold,
        unsuspend_allowed,
        changed_by: { id: 3, display_name: "Demo Enforcer" },
      });
    },
  );

  it("answers normal when no mode was ever set", async () => {
    const res = await dispatch(
      console_request("GET", "/api/operational_mode", { as: "viewer" }),
      fake_deps(staff_lookup()),
    );
    const body = operational_mode_schema.parse(await res.json());
    expect(body.mode).toBe("normal");
    expect(body.unsuspend_allowed).toBe(true);
  });
});

describe("POST /api/operational_mode", () => {
  function rails_answers(outcome: CoreApiResult<InternalModeChangeResult>) {
    const calls: InternalModeChangeRequest[] = [];
    const deps = fake_deps(
      { ...staff_lookup(), find_current_mode: async () => mode_row("elevated") },
      {
        change_mode: async (body) => {
          calls.push(body);
          return outcome;
        },
      },
    );
    return { deps, calls };
  }

  function change(as: StaffGroup, body: unknown): Request {
    return console_request("POST", "/api/operational_mode", { as, body });
  }

  it("asks Rails, then answers with the mode now in force", async () => {
    const { deps, calls } = rails_answers({ kind: "ok", result: rails_result });
    const res = await dispatch(
      change("enforcer", { mode: "elevated", reason, actor_staff_user_id: 1 }),
      deps,
    );
    const body = operational_mode_schema.parse(await res.json());

    expect(res.status).toBe(201);
    expect(calls).toEqual([{ mode: "elevated", reason, actor_staff_user_id: 3 }]);
    expect(body.mode).toBe("elevated");
    expect(body.review_threshold).toBe(40);
  });

  const may_not: StaffGroup[] = ["viewer", "analyst"];
  it.each(may_not)("refuses a %s before Rails is asked", async (group) => {
    const { deps, calls } = rails_answers({ kind: "ok", result: rails_result });
    const res = await dispatch(change(group, { mode: "lockdown", reason }), deps);

    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it.each([
    ["an unknown mode", { mode: "panic", reason }],
    ["no reason", { mode: "lockdown" }],
    ["a short reason", { mode: "lockdown", reason: "attack" }],
  ])("answers 422 for %s and asks Rails nothing", async (_name, body) => {
    const { deps, calls } = rails_answers({ kind: "ok", result: rails_result });
    const res = await dispatch(change("enforcer", body), deps);

    expect(res.status).toBe(422);
    expect(calls).toHaveLength(0);
  });

  it("passes on a 409 when the console is already in that mode", async () => {
    const { deps } = rails_answers({ kind: "rejected", status: 409, code: "mode_unchanged" });
    const res = await dispatch(change("enforcer", { mode: "elevated", reason }), deps);

    expect(res.status).toBe(409);
    expect(error_envelope_schema.parse(await res.json()).error.code).toBe("mode_unchanged");
  });

  it("answers 503 when Rails is down, and says the mode did not change", async () => {
    const { deps } = rails_answers({ kind: "unavailable", reason: "network: TimeoutError" });
    const res = await dispatch(change("enforcer", { mode: "lockdown", reason }), deps);
    const text = await res.text();

    expect(res.status).toBe(503);
    expect(text).toContain("did not change");
    expect(text).not.toContain("TimeoutError");
  });
});
