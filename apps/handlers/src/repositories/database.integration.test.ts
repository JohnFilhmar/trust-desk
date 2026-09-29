import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { demo_accounts, demo_password } from "@trust-desk/shared";
import bcrypt from "bcryptjs";
import type { Pool } from "mysql2/promise";
import { z } from "zod";
import { load_env } from "#app/config/env.ts";
import type { Database } from "#app/interfaces/deps.ts";
import { create_pool } from "#app/lib/db/pool.ts";
import { run_query } from "#app/lib/db/run_query.ts";
import { create_database } from "#app/repositories/database.ts";
import type { AccountCursor, AccountRow } from "#app/types/rows.ts";

// These tests run the real SQL against the seeded development database, as
// the handlers' own database user. A mocked database cannot prove that a
// query is valid, that it returns what the schema expects, or that it uses
// an index.

let pool: Pool;
let db: Database;

beforeAll(() => {
  pool = create_pool(load_env(process.env));
  db = create_database(pool);
});

afterAll(async () => {
  await pool.end();
});

const count_schema = z.object({ total: z.number().int() });

async function count(sql: string): Promise<number> {
  const rows = await run_query(pool, sql, [], count_schema);
  return rows[0]?.total ?? 0;
}

async function every_page(
  status: "active" | "suspended" | null,
  page_size: number,
): Promise<AccountRow[]> {
  const all: AccountRow[] = [];
  let cursor: AccountCursor | null = null;
  for (let page = 0; page < 1000; page += 1) {
    const rows: AccountRow[] = await db.search_accounts({
      status,
      cursor,
      limit: page_size,
    });
    all.push(...rows);
    const last = rows.at(-1);
    if (rows.length < page_size || last === undefined) return all;
    cursor = { created_at: last.created_at_raw, id: last.id };
  }
  throw new Error("Pagination did not end.");
}

describe("the seeded database", () => {
  it("holds accounts to read", async () => {
    expect(await count("SELECT COUNT(*) AS total FROM accounts")).toBeGreaterThan(100);
  });
});

describe("search_accounts, against real MySQL", () => {
  it("walks every account exactly once, whatever the page size", async () => {
    const total = await count("SELECT COUNT(*) AS total FROM accounts");

    for (const page_size of [7, 50]) {
      const rows = await every_page(null, page_size);
      expect(rows).toHaveLength(total);
      expect(new Set(rows.map((row) => row.id)).size).toBe(total);
    }
  });

  it("returns rows newest first, with the id breaking ties", async () => {
    const rows = await every_page(null, 50);
    const keys = rows.map((row) => `${row.created_at_raw}|${String(row.id).padStart(12, "0")}`);
    expect(keys).toEqual([...keys].sort().reverse());
  });

  it("keeps microseconds in the cursor, so no row is skipped or repeated", async () => {
    const rows = await db.search_accounts({ status: null, cursor: null, limit: 5 });
    for (const row of rows) {
      expect(row.created_at_raw).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/);
      expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
    }
  });

  it("filters by status", async () => {
    const active = await every_page("active", 50);
    expect(active.length).toBeGreaterThan(0);
    expect(active.every((row) => row.status === "active")).toBe(true);
    expect(active).toHaveLength(
      await count("SELECT COUNT(*) AS total FROM accounts WHERE status = 'active'"),
    );
  });

  it("reads the JSON column as an object with the five signup fields", async () => {
    const [row] = await db.search_accounts({ status: null, cursor: null, limit: 1 });
    expect(Object.keys(row?.signup_context ?? {}).sort()).toEqual(
      ["country", "device_fingerprint", "ip", "referral", "user_agent"].sort(),
    );
  });

  it("uses an index and does not sort, for a search by status", async () => {
    const plan_schema = z.object({
      key: z.string().nullable(),
      Extra: z.string().nullable(),
    });
    const [plan] = await run_query(
      pool,
      `EXPLAIN SELECT id FROM accounts WHERE status = ?
       ORDER BY created_at DESC, id DESC LIMIT ?`,
      ["active", "25"],
      plan_schema,
    );
    expect(plan?.key).toBe("index_accounts_on_status_and_created_at_and_id");
    expect(plan?.Extra ?? "").not.toContain("filesort");
  });
});

describe("find_account_by_id, against real MySQL", () => {
  it("finds an account that a search returned", async () => {
    const [first] = await db.search_accounts({ status: null, cursor: null, limit: 1 });
    expect(first).toBeDefined();
    expect(await db.find_account_by_id(first?.id ?? 0)).toEqual(first);
  });

  it("returns null for an id that does not exist", async () => {
    expect(await db.find_account_by_id(2_000_000_000)).toBeNull();
  });
});

describe("staff users, against real MySQL", () => {
  it.each(demo_accounts)(
    "finds $email, and bcryptjs accepts the hash Rails wrote",
    async (account) => {
      const row = await db.find_staff_credentials_by_email(account.email);
      expect(row?.group_name).toBe(account.group_name);
      expect(await bcrypt.compare(demo_password, row?.password_digest ?? "")).toBe(true);
      expect(await bcrypt.compare("wrong", row?.password_digest ?? "")).toBe(false);
    },
  );

  it("never returns the hash when loading a user for a session", async () => {
    const credentials = await db.find_staff_credentials_by_email("viewer@example.com");
    const user = await db.find_staff_user_by_id(credentials?.id ?? 0);
    expect(user).not.toBeNull();
    expect(Object.keys(user ?? {})).not.toContain("password_digest");
  });
});

describe("what the handlers' database user cannot do", () => {
  it.each([
    "UPDATE accounts SET status = 'suspended' WHERE id = 1",
    "DELETE FROM accounts WHERE id = 1",
    "INSERT INTO audit_logs (staff_user_id, action, details, correlation_id, created_at) VALUES (1, 'account.suspend', '{}', 'x', NOW(6))",
    "UPDATE staff_users SET group_name = 'enforcer' WHERE id = 1",
    "SELECT * FROM signed_request_nonces",
    "DROP TABLE events",
  ])("is refused: %s", async (sql) => {
    await expect(pool.query(sql)).rejects.toThrow(/denied/);
  });
});

describe("list_audit_logs and list_enforcement_actions, against real MySQL", () => {
  it("run and return arrays in the shared shape", async () => {
    expect(Array.isArray(await db.list_audit_logs({ account_id: null, limit: 5 }))).toBe(true);
    expect(Array.isArray(await db.list_audit_logs({ account_id: 1, limit: 5 }))).toBe(true);
    expect(Array.isArray(await db.list_enforcement_actions(1))).toBe(true);
  });
});
