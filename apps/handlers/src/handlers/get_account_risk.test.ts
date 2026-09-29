import { describe, expect, it } from "@jest/globals";
import { risk_score_schema } from "@trust-desk/shared";
import type { StaffGroup } from "@trust-desk/shared";
import { dispatch } from "#app/router.ts";
import {
  account_row,
  console_request,
  fake_deps,
  staff_lookup,
} from "#app/test_utils/fake_deps.ts";

const stats_day = {
  day: "2026-09-28",
  payments: 1,
  failed_payments: 0,
  failed_logins: 0,
  cpu_spikes: 0,
  abuse_reports: 1,
  computed_at: "2026-09-29 00:05:00.000000",
};

function request(as: StaffGroup = "viewer", path = "/api/accounts/42/risk"): Request {
  return console_request("GET", path, { as });
}

describe("GET /api/accounts/:account_id/risk", () => {
  it("returns the score with all seven signals, to every group", async () => {
    const deps = fake_deps({
      ...staff_lookup(),
      find_account_by_id: async () => account_row(),
      list_stats_days: async () => [stats_day],
      count_accounts_sharing_fingerprint: async () => 11,
    });
    const res = await dispatch(request(), deps);
    const risk = risk_score_schema.parse(await res.json());

    expect(res.status).toBe(200);
    expect(risk.signals).toHaveLength(7);
    expect(risk.score).toBe(40);
    expect(risk.band).toBe("medium");
    expect(risk.source).toEqual({ days_from_stats: 1, days_from_fallback: 0 });
  });

  it("asks raw events only for the days that are missing or stale", async () => {
    const asked: string[][] = [];
    const deps = fake_deps({
      ...staff_lookup(),
      find_account_by_id: async () => account_row(),
      list_stats_days: async () => [stats_day],
      list_event_days: async () => [
        { day: "2026-09-28", newest_event_at: "2026-09-28 22:00:00.000000" },
        { day: "2026-09-29", newest_event_at: "2026-09-29 09:00:00.000000" },
      ],
      count_events_for_days: async (_account_id, _since, days) => {
        asked.push([...days]);
        return [
          {
            day: "2026-09-29",
            payments: 0,
            failed_payments: 0,
            failed_logins: 0,
            cpu_spikes: 0,
            abuse_reports: 2,
          },
        ];
      },
    });
    const risk = risk_score_schema.parse(await (await dispatch(request(), deps)).json());

    expect(asked).toEqual([["2026-09-29"]]);
    expect(risk.source).toEqual({ days_from_stats: 1, days_from_fallback: 1 });
    expect(risk.signals.find((signal) => signal.key === "abuse_reports")?.points).toBe(30);
  });

  it("looks back 30 days, today included", async () => {
    const since: string[] = [];
    const deps = fake_deps({
      ...staff_lookup(),
      find_account_by_id: async () => account_row(),
      list_stats_days: async (_account_id, since_day) => {
        since.push(since_day);
        return [];
      },
    });
    await dispatch(request(), deps);
    expect(since).toEqual(["2026-09-01"]);
  });

  it("flags the account at the lower threshold once the mode is elevated", async () => {
    const deps = fake_deps({
      ...staff_lookup(),
      find_account_by_id: async () => account_row(),
      list_stats_days: async () => [stats_day],
      count_accounts_sharing_fingerprint: async () => 11,
      find_current_mode: async () => ({
        mode: "elevated",
        reason: "Signup burst from one network.",
        staff_user_id: 3,
        display_name: "Demo Enforcer",
        created_at: "2026-09-30T00:00:00.000000Z",
      }),
    });
    const risk = risk_score_schema.parse(await (await dispatch(request(), deps)).json());

    expect(risk.score).toBe(40);
    expect(risk.review_threshold).toBe(40);
    expect(risk.flagged_for_review).toBe(true);
  });

  it("explains the score without any raw PII", async () => {
    const deps = fake_deps({
      ...staff_lookup(),
      find_account_by_id: async () =>
        account_row({ email: "drop@mailinator.example.org" }),
      count_accounts_sharing_fingerprint: async () => 3,
      count_signups_from_same_ip: async () => 9,
    });
    const text = await (await dispatch(request(), deps)).text();

    expect(text).not.toContain("drop@");
    expect(text).not.toContain("192.0.2.17");
    expect(text).not.toContain("fp_a1b2c3d4e5f6");
    expect(text).toContain("mailinator.example.org");
  });

  it.each(["/api/accounts/999/risk", "/api/accounts/abc/risk"])(
    "answers 404 for %s",
    async (path) => {
      const res = await dispatch(request("viewer", path), fake_deps(staff_lookup()));
      expect(res.status).toBe(404);
    },
  );
});
