import { describe, expect, it } from "@jest/globals";
import { event_list_response_schema } from "@trust-desk/shared";
import type { StaffGroup } from "@trust-desk/shared";
import { decode_cursor } from "#app/lib/pagination/cursor.ts";
import { dispatch } from "#app/router.ts";
import {
  account_row,
  console_request,
  event_row,
  fake_deps,
  staff_lookup,
} from "#app/test_utils/fake_deps.ts";
import type { EventListArgs, EventRow } from "#app/types/rows.ts";

function recording(returned: EventRow[]) {
  const asked: EventListArgs[] = [];
  const deps = fake_deps({
    ...staff_lookup(),
    find_account_by_id: async () => account_row(),
    list_events: async (args) => {
      asked.push(args);
      return returned;
    },
  });
  return { deps, asked };
}

function events(count: number): EventRow[] {
  return Array.from({ length: count }, (_, index) =>
    event_row({
      id: 900 - index,
      occurred_at_raw: `2026-09-29 02:00:00.${String(500000 - index).padStart(6, "0")}`,
    }),
  );
}

const groups: StaffGroup[] = ["viewer", "analyst", "enforcer"];

describe("GET /api/accounts/:account_id/events", () => {
  it.each(groups)("masks every payload for a %s", async (group) => {
    const { deps } = recording([
      event_row(),
      event_row({
        id: 899,
        event_type: "abuse_report",
        payload: {
          report: "Phishing page reported by dana@example.com at 203.0.113.80.",
          reporter: { email: "dana@example.com", ip: "203.0.113.80" },
        },
      }),
    ]);
    const res = await dispatch(
      console_request("GET", "/api/accounts/42/events", { as: group }),
      deps,
    );
    const text = await res.text();

    expect(res.status).toBe(200);
    for (const raw of ["192.0.2.17", "dana@", "203.0.113.80", "Linux x86_64"]) {
      expect(text).not.toContain(raw);
    }
    const body = event_list_response_schema.parse(JSON.parse(text));
    expect(body.items[0]?.payload).toEqual({
      ip: "192.0.2.xxx",
      user_agent: "Mozilla/5.0 ***",
      success: true,
    });
  });

  it("asks for one row more than the page and builds the next cursor", async () => {
    const { deps, asked } = recording(events(3));
    const res = await dispatch(
      console_request("GET", "/api/accounts/42/events?limit=2&event_type=login", {
        as: "viewer",
      }),
      deps,
    );
    const body = event_list_response_schema.parse(await res.json());

    expect(asked).toEqual([
      { account_id: 42, event_type: "login", cursor: null, limit: 3 },
    ]);
    expect(body.items).toHaveLength(2);
    expect(decode_cursor(body.next_cursor ?? "")).toEqual({
      at: "2026-09-29 02:00:00.499999",
      id: 899,
    });
  });

  it("returns no cursor on the last page", async () => {
    const { deps } = recording(events(2));
    const res = await dispatch(
      console_request("GET", "/api/accounts/42/events?limit=2", { as: "viewer" }),
      deps,
    );
    expect(event_list_response_schema.parse(await res.json()).next_cursor).toBeNull();
  });

  it.each([
    "/api/accounts/42/events?event_type=teleport",
    "/api/accounts/42/events?limit=500",
    "/api/accounts/42/events?cursor=nope",
  ])("answers 422 for %s and runs no query", async (path) => {
    const { deps, asked } = recording(events(1));
    const res = await dispatch(console_request("GET", path, { as: "viewer" }), deps);
    expect(res.status).toBe(422);
    expect(asked).toHaveLength(0);
  });

  it("answers 404 for an unknown account and runs no event query", async () => {
    const { deps, asked } = recording(events(1));
    deps.db.find_account_by_id = async () => null;
    const res = await dispatch(
      console_request("GET", "/api/accounts/42/events", { as: "viewer" }),
      deps,
    );
    expect(res.status).toBe(404);
    expect(asked).toHaveLength(0);
  });
});
