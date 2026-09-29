import { describe, expect, it } from "@jest/globals";
import { account_search_response_schema } from "@trust-desk/shared";
import { decode_cursor } from "#app/lib/accounts/cursor.ts";
import { dispatch } from "#app/router.ts";
import {
  account_row,
  console_request,
  fake_deps,
  staff_lookup,
} from "#app/test_utils/fake_deps.ts";
import type { AccountSearchArgs } from "#app/types/rows.ts";

function rows(count: number) {
  return Array.from({ length: count }, (_, index) =>
    account_row({
      id: 100 - index,
      email: `user${index}@example.com`,
      created_at_raw: `2026-09-29 01:02:03.${String(900000 - index).padStart(6, "0")}`,
    }),
  );
}

describe("GET /api/accounts", () => {
  it("masks every email, for every group", async () => {
    const deps = fake_deps({ ...staff_lookup(), search_accounts: async () => rows(3) });
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
    const deps = fake_deps({ ...staff_lookup(), search_accounts: async () => rows(1) });
    const res = await dispatch(console_request("GET", "/api/accounts", { as: "viewer" }), deps);
    const text = await res.text();
    expect(text).not.toContain("192.0.2");
    expect(text).not.toContain("fp_a1b");
    expect(text).not.toContain("Mozilla");
  });

  it("asks for one row more than the page and hides it", async () => {
    let asked: AccountSearchArgs | null = null;
    const deps = fake_deps({
      ...staff_lookup(),
      search_accounts: async (args) => {
        asked = args;
        return rows(3);
      },
    });
    const res = await dispatch(
      console_request("GET", "/api/accounts?limit=2&status=active", { as: "viewer" }),
      deps,
    );
    const body = account_search_response_schema.parse(await res.json());

    expect(asked).toEqual({ status: "active", cursor: null, limit: 3 });
    expect(body.items).toHaveLength(2);
    expect(body.next_cursor).not.toBeNull();
    expect(decode_cursor(body.next_cursor ?? "")).toEqual({
      created_at: "2026-09-29 01:02:03.899999",
      id: 99,
    });
  });

  it("returns no cursor on the last page", async () => {
    const deps = fake_deps({ ...staff_lookup(), search_accounts: async () => rows(2) });
    const res = await dispatch(
      console_request("GET", "/api/accounts?limit=2", { as: "viewer" }),
      deps,
    );
    const body = account_search_response_schema.parse(await res.json());
    expect(body.items).toHaveLength(2);
    expect(body.next_cursor).toBeNull();
  });

  it("passes a valid cursor on to the query", async () => {
    let asked: AccountSearchArgs | null = null;
    const deps = fake_deps({
      ...staff_lookup(),
      search_accounts: async (args) => {
        asked = args;
        return [];
      },
    });
    const first = await dispatch(
      console_request("GET", "/api/accounts?limit=1", { as: "viewer" }),
      fake_deps({ ...staff_lookup(), search_accounts: async () => rows(2) }),
    );
    const { next_cursor } = account_search_response_schema.parse(await first.json());

    await dispatch(
      console_request("GET", `/api/accounts?limit=1&cursor=${next_cursor}`, {
        as: "viewer",
      }),
      deps,
    );
    expect(asked).toEqual({
      status: null,
      cursor: { created_at: "2026-09-29 01:02:03.900000", id: 100 },
      limit: 2,
    });
  });

  it.each([
    "/api/accounts?status=banned",
    "/api/accounts?limit=0",
    "/api/accounts?limit=101",
    "/api/accounts?limit=abc",
    "/api/accounts?cursor=not-a-cursor",
    `/api/accounts?cursor=${Buffer.from('{"created_at":"x","id":1}').toString("base64url")}`,
  ])("answers 422 for %s and runs no query", async (path) => {
    let ran = false;
    const deps = fake_deps({
      ...staff_lookup(),
      search_accounts: async () => {
        ran = true;
        return [];
      },
    });
    const res = await dispatch(console_request("GET", path, { as: "viewer" }), deps);
    expect(res.status).toBe(422);
    expect(ran).toBe(false);
  });
});
