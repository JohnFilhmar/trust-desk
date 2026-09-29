import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { demo_accounts, demo_password } from "@trust-desk/shared";
import bcrypt from "bcryptjs";
import type { Pool } from "mysql2/promise";
import { z } from "zod";
import { load_env } from "#app/config/env.ts";
import type { Database } from "#app/interfaces/deps.ts";
import { create_pool } from "#app/lib/db/pool.ts";
import { run_query } from "#app/lib/db/run_query.ts";
import { load_account_risk, window_start_day } from "#app/lib/risk/load_risk.ts";
import { create_database } from "#app/repositories/database.ts";
import { escape_like } from "#app/repositories/queries/accounts.ts";
import type {
  AccountRow,
  AccountSearchArgs,
  EventRow,
  KeysetCursor,
} from "#app/types/rows.ts";

// These tests run the real SQL against the seeded development database, as
// the handlers' own database user. A mocked database cannot prove that a
// query is valid, that it returns what the schema expects, or that it uses
// an index.
//
// The values below are what the seed writes on every run. It prints them in
// its summary.
const ring_fingerprint = "9f2c4e6a8b0d1f3e5a7c9e1b3d5f7a90";
const burst_ip = "203.0.113.77";

let pool: Pool;
let db: Database;
const now = new Date();

beforeAll(() => {
  pool = create_pool(load_env(process.env));
  db = create_database(pool);
});

afterAll(async () => {
  await pool.end();
});

const count_schema = z.object({ total: z.coerce.number().int() });
const plan_schema = z.object({
  key: z.string().nullable(),
  Extra: z.string().nullable(),
});

async function count(sql: string): Promise<number> {
  const rows = await run_query(pool, sql, [], count_schema);
  return rows[0]?.total ?? 0;
}

function search(overrides: Partial<AccountSearchArgs> = {}): AccountSearchArgs {
  return {
    status: null,
    email: null,
    ip: null,
    fingerprint: null,
    cursor: null,
    limit: 50,
    ...overrides,
  };
}

async function every_account(
  filters: Partial<AccountSearchArgs>,
  page_size: number,
): Promise<AccountRow[]> {
  const all: AccountRow[] = [];
  let cursor: KeysetCursor | null = null;
  for (let page = 0; page < 1000; page += 1) {
    const rows: AccountRow[] = await db.search_accounts(
      search({ ...filters, cursor, limit: page_size }),
    );
    all.push(...rows);
    const last = rows.at(-1);
    if (rows.length < page_size || last === undefined) return all;
    cursor = { at: last.created_at_raw, id: last.id };
  }
  throw new Error("Pagination did not end.");
}

async function account_by_email(email: string): Promise<AccountRow> {
  const [row] = await db.search_accounts(search({ email, limit: 1 }));
  if (row === undefined) throw new Error(`The seed has no account ${email}.`);
  return row;
}

describe("search_accounts, against real MySQL", () => {
  it("walks every account exactly once, whatever the page size", async () => {
    const total = await count("SELECT COUNT(*) AS total FROM accounts");
    expect(total).toBeGreaterThan(100);

    for (const page_size of [7, 50]) {
      const rows = await every_account({}, page_size);
      expect(rows).toHaveLength(total);
      expect(new Set(rows.map((row) => row.id)).size).toBe(total);
    }
  });

  it("returns rows newest first, with the id breaking ties", async () => {
    const rows = await every_account({}, 50);
    const keys = rows.map(
      (row) => `${row.created_at_raw}|${String(row.id).padStart(12, "0")}`,
    );
    expect(keys).toEqual([...keys].sort().reverse());
  });

  it("keeps microseconds in the cursor, so no row is skipped or repeated", async () => {
    const rows = await db.search_accounts(search({ limit: 5 }));
    for (const row of rows) {
      expect(row.created_at_raw).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/);
      expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
    }
  });

  it("filters by status", async () => {
    const active = await every_account({ status: "active" }, 50);
    expect(active.length).toBeGreaterThan(0);
    expect(active.every((row) => row.status === "active")).toBe(true);
    expect(active).toHaveLength(
      await count("SELECT COUNT(*) AS total FROM accounts WHERE status = 'active'"),
    );
  });

  it("reads the JSON column as an object with the five signup fields", async () => {
    const [row] = await db.search_accounts(search({ limit: 1 }));
    expect(Object.keys(row?.signup_context ?? {}).sort()).toEqual(
      ["country", "device_fingerprint", "ip", "referral", "user_agent"].sort(),
    );
  });

  it("uses an index and does not sort, for a search by status", async () => {
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

describe("search by PII, against real MySQL", () => {
  it("finds the 12 accounts that share one device fingerprint", async () => {
    const rows = await every_account({ fingerprint: ring_fingerprint }, 5);
    expect(rows).toHaveLength(12);
    expect(
      rows.every((row) => row.signup_context.device_fingerprint === ring_fingerprint),
    ).toBe(true);
  });

  it("finds the 15 accounts of the signup burst by IP", async () => {
    const rows = await every_account({ ip: burst_ip }, 50);
    expect(rows).toHaveLength(15);
    expect(rows.every((row) => row.signup_context.ip === burst_ip)).toBe(true);
  });

  it("finds accounts by any part of the email, whatever the case", async () => {
    const rows = await every_account({ email: "RING-" }, 50);
    expect(rows).toHaveLength(12);
    expect(rows.every((row) => row.email.startsWith("ring-"))).toBe(true);
  });

  it("combines filters", async () => {
    const rows = await every_account(
      { fingerprint: ring_fingerprint, email: "ring-01" },
      50,
    );
    expect(rows.map((row) => row.email)).toEqual(["ring-01@example.com"]);
  });

  it("treats a percent sign as a character, not as a wildcard", async () => {
    expect(await every_account({ email: "%" }, 50)).toHaveLength(0);
    expect(await every_account({ email: "ring_01" }, 50)).toHaveLength(0);
    expect(escape_like("50%_off\\")).toBe("50\\%\\_off\\\\");
  });

  it("matches a fingerprint whole, never a part of one", async () => {
    expect(
      await every_account({ fingerprint: ring_fingerprint.slice(0, 10) }, 50),
    ).toHaveLength(0);
  });

  it("looks a fingerprint up through the index on the generated column", async () => {
    const [plan] = await run_query(
      pool,
      "EXPLAIN SELECT id FROM accounts WHERE signup_fingerprint = ?",
      [ring_fingerprint],
      plan_schema,
    );
    expect(plan?.key).toBe("index_accounts_on_signup_fingerprint");
  });

  it("looks an IP up through the index on the generated column", async () => {
    const [plan] = await run_query(
      pool,
      "EXPLAIN SELECT id FROM accounts WHERE signup_ip = ?",
      [burst_ip],
      plan_schema,
    );
    expect(plan?.key).toBe("index_accounts_on_signup_ip");
  });

  it("returns nothing for text that tries to change the query", async () => {
    const total = await count("SELECT COUNT(*) AS total FROM accounts");
    expect(await every_account({ email: "' OR '1'='1" }, 50)).toHaveLength(0);
    expect(await every_account({ fingerprint: "x' OR 1=1 -- " }, 50)).toHaveLength(0);
    expect(await count("SELECT COUNT(*) AS total FROM accounts")).toBe(total);
  });
});

describe("find_account_by_id, against real MySQL", () => {
  it("finds an account that a search returned", async () => {
    const [first] = await db.search_accounts(search({ limit: 1 }));
    expect(first).toBeDefined();
    expect(await db.find_account_by_id(first?.id ?? 0)).toEqual(first);
  });

  it("returns null for an id that does not exist", async () => {
    expect(await db.find_account_by_id(2_000_000_000)).toBeNull();
  });
});

describe("list_events, against real MySQL", () => {
  async function every_event(account_id: number, page_size: number): Promise<EventRow[]> {
    const all: EventRow[] = [];
    let cursor: KeysetCursor | null = null;
    for (let page = 0; page < 1000; page += 1) {
      const rows: EventRow[] = await db.list_events({
        account_id,
        event_type: null,
        cursor,
        limit: page_size,
      });
      all.push(...rows);
      const last = rows.at(-1);
      if (rows.length < page_size || last === undefined) return all;
      cursor = { at: last.occurred_at_raw, id: last.id };
    }
    throw new Error("Pagination did not end.");
  }

  it("walks every event of an account exactly once, newest first", async () => {
    const miner = await account_by_email("miner-01@example.com");
    const total = await count(
      `SELECT COUNT(*) AS total FROM events WHERE account_id = ${miner.id}`,
    );
    const events = await every_event(miner.id, 4);

    expect(total).toBeGreaterThan(10);
    expect(events).toHaveLength(total);
    expect(new Set(events.map((event) => event.id)).size).toBe(total);
    const times = events.map((event) => event.occurred_at_raw);
    expect(times).toEqual([...times].sort().reverse());
  });

  it("filters by event type", async () => {
    const miner = await account_by_email("miner-01@example.com");
    const spikes = await db.list_events({
      account_id: miner.id,
      event_type: "cpu_spike",
      cursor: null,
      limit: 100,
    });
    expect(spikes.length).toBeGreaterThan(3);
    expect(spikes.every((event) => event.event_type === "cpu_spike")).toBe(true);
  });

  it("reads every payload as an object", async () => {
    const miner = await account_by_email("miner-01@example.com");
    const events = await every_event(miner.id, 50);
    for (const event of events) {
      expect(typeof event.payload).toBe("object");
      expect(Array.isArray(event.payload)).toBe(false);
    }
  });

  it("uses the index on account and time, and does not sort", async () => {
    const [plan] = await run_query(
      pool,
      `EXPLAIN SELECT id FROM events WHERE account_id = ?
       ORDER BY occurred_at DESC, id DESC LIMIT ?`,
      [1, "25"],
      plan_schema,
    );
    expect(plan?.key).toBe("index_events_on_account_id_and_occurred_at_and_id");
    expect(plan?.Extra ?? "").not.toContain("filesort");
  });
});

describe("the risk read path, against real MySQL", () => {
  const since = window_start_day(now);

  it("counts the same from raw events as the pre-aggregated table holds", async () => {
    const clean = await account_by_email("ring-01@example.com");
    const stats = await db.list_stats_days(clean.id, since);
    expect(stats.length).toBeGreaterThan(0);

    const fallback = await db.count_events_for_days(
      clean.id,
      since,
      stats.map((row) => row.day),
    );
    const from_stats = stats.map(({ computed_at: _ignored, ...counts }) => counts);
    expect(fallback).toEqual(from_stats);
  });

  it("falls back to raw events for an account whose newest days are missing", async () => {
    const gap = await account_by_email("stats-gap-01@example.com");
    const risk = await load_account_risk(db, gap, "normal", now);

    expect(risk.source.days_from_fallback).toBeGreaterThanOrEqual(1);
    expect(risk.source.days_from_stats).toBeGreaterThan(0);
  });

  it("falls back for an account whose row is older than its newest event", async () => {
    const stale = await account_by_email("stats-stale-01@example.com");
    const risk = await load_account_risk(db, stale, "normal", now);
    expect(risk.source.days_from_fallback).toBeGreaterThanOrEqual(1);
  });

  it("uses the table alone for an account whose rows are complete", async () => {
    const ring = await account_by_email("ring-01@example.com");
    const risk = await load_account_risk(db, ring, "normal", now);
    expect(risk.source.days_from_fallback).toBe(0);
  });

  it("counts 11 other accounts for a member of the fingerprint ring", async () => {
    const ring = await account_by_email("ring-01@example.com");
    expect(await db.count_accounts_sharing_fingerprint(ring.id)).toBe(11);

    const risk = await load_account_risk(db, ring, "normal", now);
    const signal = risk.signals.find((item) => item.key === "shared_fingerprint");
    expect(signal?.points).toBe(30);
    expect(signal?.explanation).toContain("11 other accounts");
  });

  it("counts the whole signup burst for one of its members", async () => {
    const burst = await account_by_email("burst-01@example.org");
    expect(await db.count_signups_from_same_ip(burst.id, 60)).toBe(15);
  });

  it("scores each abuse cluster above a clean account", async () => {
    const clean = await load_account_risk(
      db,
      await account_by_email("stats-gap-01@example.com"),
      "normal",
      now,
    );
    for (const email of [
      "ring-01@example.com",
      "burst-01@example.org",
      "miner-01@example.com",
      "phish-01@example.org",
      "cardtest-01@example.com",
    ]) {
      const risk = await load_account_risk(db, await account_by_email(email), "normal", now);
      expect(risk.score).toBeGreaterThan(clean.score);
      expect(risk.score).toBeGreaterThanOrEqual(20);
    }
  });

  it("scores a page of accounts in one query, agreeing with the full path", async () => {
    const ring = await account_by_email("ring-01@example.com");
    const miner = await account_by_email("miner-01@example.com");
    const rows = await db.list_quick_risk([ring.id, miner.id], since, 60);

    expect(rows.map((row) => row.account_id).sort()).toEqual([ring.id, miner.id].sort());
    const ring_row = rows.find((row) => row.account_id === ring.id);
    expect(ring_row?.accounts_sharing_fingerprint).toBe(11);

    const full = await db.list_stats_days(miner.id, since);
    const miner_row = rows.find((row) => row.account_id === miner.id);
    expect(miner_row?.cpu_spikes).toBe(
      full.reduce((total, day) => total + day.cpu_spikes, 0),
    );
  });

  it("returns an empty list for an empty page without running a query", async () => {
    expect(await db.list_quick_risk([], since, 60)).toEqual([]);
    expect(await db.count_events_for_days(1, since, [])).toEqual([]);
  });
});

describe("the operational mode, against real MySQL", () => {
  it("reads the newest row with the name of who set it", async () => {
    const mode = await db.find_current_mode();
    expect(mode).not.toBeNull();
    expect(["normal", "elevated", "lockdown"]).toContain(mode?.mode);
    expect(mode?.display_name.length).toBeGreaterThan(0);
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
    "INSERT INTO operational_modes (mode, reason, staff_user_id, created_at) VALUES ('normal', 'x', 1, NOW(6))",
    "SELECT * FROM signed_request_nonces",
    "SELECT * FROM idempotency_keys",
    "DROP TABLE events",
    "TRUNCATE TABLE audit_logs",
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
