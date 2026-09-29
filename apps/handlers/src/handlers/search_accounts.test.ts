import { describe, expect, it } from "@jest/globals";
import { account_search_response_schema, error_envelope_schema } from "@trust-desk/shared";
import type { StaffGroup } from "@trust-desk/shared";
import { decode_cursor } from "#app/lib/pagination/cursor.ts";
import { dispatch } from "#app/router.ts";
import {
  account_row,
  console_request,
  fake_deps,
  staff_lookup,
} from "#app/test_utils/fake_deps.ts";
import type { AccountSearchArgs, QuickRiskRow } from "#app/types/rows.ts";

function rows(count: number) {
  return Array.from({ length: count }, (_, index) =>
    account_row({
      id: 100 - index,
      email: `user${index}@example.com`,
      created_at_raw: `2026-09-29 01:02:03.${String(900000 - index).padStart(6, "0")}`,
    }),
  );
}

function recording(returned = rows(0)) {
  const asked: AccountSearchArgs[] = [];
  const deps = fake_deps({
    ...staff_lookup(),
    search_accounts: async (args) => {
      asked.push(args);
      return returned;
    },
  });
  return { deps, asked };
}

const no_filters = { status: null, email: null, ip: null, fingerprint: null };

describe("GET /api/accounts", () => {
  it("masks every email, for every group", async () => {
    const { deps } = recording(rows(3));
    const res = await dispatch(console_request("GET", "/api/accounts", { as: "enforcer" }), deps);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).not.toContain("user0@example.com");
    const body = account_search_response_schema.parse(JSON.parse(text));
    expect(body.items.map((item) => item.email)).toEqual([
      "u***@example.com",
      "u***@example.com",
      "u***@example.com",
    ]);
  });

  it("never sends the IP, the fingerprint or the user agent in a list", async () => {
    const { deps } = recording(rows(1));
    const res = await dispatch(console_request("GET", "/api/accounts", { as: "viewer" }), deps);
    const text = await res.text();
    expect(text).not.toContain("192.0.2");
    expect(text).not.toContain("fp_a1b");
    expect(text).not.toContain("Mozilla");
  });

  it("asks for one row more than the page and hides it", async () => {
    const { deps, asked } = recording(rows(3));
    const res = await dispatch(
      console_request("GET", "/api/accounts?limit=2&status=active", { as: "viewer" }),
      deps,
    );
    const body = account_search_response_schema.parse(await res.json());

    expect(asked).toEqual([{ ...no_filters, status: "active", cursor: null, limit: 3 }]);
    expect(body.items).toHaveLength(2);
    expect(decode_cursor(body.next_cursor ?? "")).toEqual({
      at: "2026-09-29 01:02:03.899999",
      id: 99,
    });
  });

  it("returns no cursor on the last page", async () => {
    const { deps } = recording(rows(2));
    const res = await dispatch(
      console_request("GET", "/api/accounts?limit=2", { as: "viewer" }),
      deps,
    );
    const body = account_search_response_schema.parse(await res.json());
    expect(body.items).toHaveLength(2);
    expect(body.next_cursor).toBeNull();
  });

  it("passes a valid cursor on to the query", async () => {
    const first = await dispatch(
      console_request("GET", "/api/accounts?limit=1", { as: "viewer" }),
      recording(rows(2)).deps,
    );
    const { next_cursor } = account_search_response_schema.parse(await first.json());

    const { deps, asked } = recording();
    await dispatch(
      console_request("GET", `/api/accounts?limit=1&cursor=${next_cursor}`, {
        as: "viewer",
      }),
      deps,
    );
    expect(asked).toEqual([
      { ...no_filters, cursor: { at: "2026-09-29 01:02:03.900000", id: 100 }, limit: 2 },
    ]);
  });

  it.each([
    "/api/accounts?status=banned",
    "/api/accounts?limit=0",
    "/api/accounts?limit=101",
    "/api/accounts?limit=abc",
    "/api/accounts?cursor=not-a-cursor",
    `/api/accounts?cursor=${Buffer.from('{"at":"x","id":1}').toString("base64url")}`,
    "/api/accounts?email=a",
    `/api/accounts?fingerprint=${"x".repeat(101)}`,
  ])("answers 422 for %s and runs no query", async (path) => {
    const { deps, asked } = recording();
    const res = await dispatch(console_request("GET", path, { as: "enforcer" }), deps);
    expect(res.status).toBe(422);
    expect(asked).toHaveLength(0);
  });
});

describe("search by PII", () => {
  it.each(["email=jordan", "ip=192.0.2.17", "fingerprint=fp_a1b2c3d4e5f6"])(
    "refuses a viewer who searches by %s, and runs no query",
    async (term) => {
      const { deps, asked } = recording(rows(1));
      const res = await dispatch(
        console_request("GET", `/api/accounts?${term}`, { as: "viewer" }),
        deps,
      );

      expect(res.status).toBe(403);
      expect(error_envelope_schema.parse(await res.json()).error.code).toBe("forbidden");
      expect(asked).toHaveLength(0);
    },
  );

  it("gives a viewer a 403 and not an empty list, so a refusal is not read as no match", async () => {
    const { deps } = recording([]);
    const res = await dispatch(
      console_request("GET", "/api/accounts?email=nobody", { as: "viewer" }),
      deps,
    );
    expect(res.status).toBe(403);
  });

  const may_search: StaffGroup[] = ["analyst", "enforcer"];
  it.each(may_search)("passes every term on for a %s", async (group) => {
    const { deps, asked } = recording(rows(1));
    const res = await dispatch(
      console_request(
        "GET",
        "/api/accounts?email=%20jordan%20&ip=192.0.2.17&fingerprint=fp_a1b2c3d4e5f6",
        { as: group },
      ),
      deps,
    );

    expect(res.status).toBe(200);
    expect(asked).toEqual([
      {
        status: null,
        email: "jordan",
        ip: "192.0.2.17",
        fingerprint: "fp_a1b2c3d4e5f6",
        cursor: null,
        limit: 26,
      },
    ]);
  });

  it("returns the match masked, even to the user who typed the full value", async () => {
    const { deps } = recording([account_row()]);
    const res = await dispatch(
      console_request("GET", "/api/accounts?email=jordan.lee@example.com", {
        as: "analyst",
      }),
      deps,
    );
    const text = await res.text();
    expect(text).toContain("j***@example.com");
    expect(text).not.toContain("jordan.lee");
  });

  it("does not log the search term", async () => {
    const { deps } = recording(rows(1));
    await dispatch(
      console_request("GET", "/api/accounts?email=jordan.lee", { as: "viewer" }),
      deps,
    );
    expect(JSON.stringify(deps.logger)).not.toContain("jordan");
  });
});

describe("the quick risk score of a list", () => {
  const quick: QuickRiskRow = {
    account_id: 100,
    payments: 0,
    failed_payments: 0,
    failed_logins: 0,
    cpu_spikes: 0,
    abuse_reports: 3,
    days: 12,
    accounts_sharing_fingerprint: 11,
    signups_from_same_ip: 1,
  };

  it("scores every row of the page in one query", async () => {
    const asked_ids: number[][] = [];
    const deps = fake_deps({
      ...staff_lookup(),
      search_accounts: async () => rows(3),
      list_quick_risk: async (account_ids) => {
        asked_ids.push([...account_ids]);
        return [quick];
      },
    });
    const res = await dispatch(
      console_request("GET", "/api/accounts?limit=2", { as: "viewer" }),
      deps,
    );
    const body = account_search_response_schema.parse(await res.json());

    expect(asked_ids).toEqual([[100, 99]]);
    expect(body.items[0]?.risk).toEqual({ score: 60, band: "high", flagged_for_review: true });
    expect(body.items[1]?.risk).toEqual({ score: 0, band: "low", flagged_for_review: false });
  });

  it("flags a score of 40 only once the mode is elevated", async () => {
    const forty: QuickRiskRow = { ...quick, accounts_sharing_fingerprint: 1 };
    const in_mode = async (mode: "normal" | "elevated") => {
      const deps = fake_deps({
        ...staff_lookup(),
        search_accounts: async () => rows(1),
        list_quick_risk: async () => [forty],
        find_current_mode: async () => ({
          mode,
          reason: "Signup burst from one network.",
          staff_user_id: 3,
          display_name: "Demo Enforcer",
          created_at: "2026-09-30T00:00:00.000000Z",
        }),
      });
      const res = await dispatch(console_request("GET", "/api/accounts", { as: "viewer" }), deps);
      return account_search_response_schema.parse(await res.json()).items[0]?.risk;
    };

    expect(await in_mode("normal")).toEqual({ score: 40, band: "medium", flagged_for_review: false });
    expect(await in_mode("elevated")).toEqual({ score: 40, band: "medium", flagged_for_review: true });
  });
});
