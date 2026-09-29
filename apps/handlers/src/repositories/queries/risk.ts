import type { Pool } from "mysql2/promise";
import { z } from "zod";
import { run_query } from "#app/lib/db/run_query.ts";
import type { DailyCounts, EventDay, StatsDay } from "#app/lib/risk/merge_daily_counts.ts";
import type { QuickRiskRow } from "#app/types/rows.ts";

const day_schema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const raw_datetime_schema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/);

// SUM() returns DECIMAL, which the driver hands over as text. COUNT()
// returns a number. z.coerce.number() accepts both.
const count_schema = z.coerce.number().int().min(0);

const stats_row_schema = z.object({
  day: day_schema,
  payments: count_schema,
  failed_payments: count_schema,
  failed_logins: count_schema,
  cpu_spikes: count_schema,
  abuse_reports: count_schema,
  computed_at: raw_datetime_schema,
});

const event_day_schema = z.object({
  day: day_schema,
  newest_event_at: raw_datetime_schema,
});

const daily_counts_schema = stats_row_schema.omit({ computed_at: true });

const total_schema = z.object({ total: count_schema });

// The pre-aggregated read path. One row per day, no events touched.
const stats_sql = `
  SELECT
    DATE_FORMAT(day, '%Y-%m-%d') AS day,
    payments_count AS payments,
    failed_payments_count AS failed_payments,
    failed_logins_count AS failed_logins,
    cpu_spikes_count AS cpu_spikes,
    abuse_reports_count AS abuse_reports,
    CAST(computed_at AS CHAR) AS computed_at
  FROM account_daily_stats
  WHERE account_id = ? AND day >= ?
  ORDER BY day
`;

// The staleness probe. It reads the index on (account_id, occurred_at, id)
// and never the rows themselves, so it stays cheap however large a payload is.
const event_days_sql = `
  SELECT
    DATE_FORMAT(occurred_at, '%Y-%m-%d') AS day,
    CAST(MAX(occurred_at) AS CHAR) AS newest_event_at
  FROM events
  WHERE account_id = ? AND occurred_at >= ?
  GROUP BY DATE_FORMAT(occurred_at, '%Y-%m-%d')
  ORDER BY day
`;

// The log-platform fallback. It counts raw events, and only for the days
// the probe found missing or stale. Phase 6 replaces it with a LogQL query.
// In MySQL a comparison is 1 or 0, so SUM(event_type = 'x') counts matches.
const fallback_select = `
  SELECT
    DATE_FORMAT(occurred_at, '%Y-%m-%d') AS day,
    SUM(event_type = 'payment') AS payments,
    SUM(event_type = 'payment_failed') AS failed_payments,
    SUM(event_type = 'login_failed') AS failed_logins,
    SUM(event_type = 'cpu_spike') AS cpu_spikes,
    SUM(event_type = 'abuse_report') AS abuse_reports
  FROM events
  WHERE account_id = ? AND occurred_at >= ?
`;
const fallback_group = `
  GROUP BY DATE_FORMAT(occurred_at, '%Y-%m-%d')
  ORDER BY day
`;

// Uses the index on the generated column signup_fingerprint.
const shared_fingerprint_sql = `
  SELECT COUNT(*) AS total
  FROM accounts AS others
  INNER JOIN accounts AS subject ON subject.id = ?
  WHERE others.signup_fingerprint = subject.signup_fingerprint
    AND others.id <> subject.id
`;

// Uses the index on the generated column signup_ip.
const signup_velocity_sql = `
  SELECT COUNT(*) AS total
  FROM accounts AS others
  INNER JOIN accounts AS subject ON subject.id = ?
  WHERE others.signup_ip = subject.signup_ip
    AND others.created_at BETWEEN subject.created_at - INTERVAL ? MINUTE
                              AND subject.created_at + INTERVAL ? MINUTE
`;

const quick_risk_row_schema = z.object({
  account_id: z.number().int().positive(),
  payments: count_schema,
  failed_payments: count_schema,
  failed_logins: count_schema,
  cpu_spikes: count_schema,
  abuse_reports: count_schema,
  days: count_schema,
  accounts_sharing_fingerprint: count_schema,
  signups_from_same_ip: count_schema,
});

/**
 * Reads the pre-aggregated rows of one account.
 *
 * @param pool - The connection pool.
 * @param account_id - The account id.
 * @param since_day - The first UTC day of the window, as `YYYY-MM-DD`.
 * @returns One row per day that has one, oldest first.
 */
export async function list_stats_days(
  pool: Pool,
  account_id: number,
  since_day: string,
): Promise<StatsDay[]> {
  return run_query(pool, stats_sql, [account_id, since_day], stats_row_schema);
}

/**
 * Finds the newest event of each day, to tell whether a stats row is stale.
 *
 * @param pool - The connection pool.
 * @param account_id - The account id.
 * @param since_day - The first UTC day of the window, as `YYYY-MM-DD`.
 * @returns One row per day that has events, oldest first.
 */
export async function list_event_days(
  pool: Pool,
  account_id: number,
  since_day: string,
): Promise<EventDay[]> {
  return run_query(pool, event_days_sql, [account_id, since_day], event_day_schema);
}

/**
 * Counts raw events for the given days. This is the fallback path.
 *
 * @param pool - The connection pool.
 * @param account_id - The account id.
 * @param since_day - The first UTC day of the window, as `YYYY-MM-DD`.
 * @param days - The days to count. An empty list returns an empty array
 *   without touching the database.
 * @returns One row per requested day that has events.
 */
export async function count_events_for_days(
  pool: Pool,
  account_id: number,
  since_day: string,
  days: readonly string[],
): Promise<DailyCounts[]> {
  if (days.length === 0) return [];
  // One placeholder per day. The days themselves are bound as parameters.
  const placeholders = days.map(() => "?").join(", ");
  const sql = `
    ${fallback_select}
      AND DATE_FORMAT(occurred_at, '%Y-%m-%d') IN (${placeholders})
    ${fallback_group}
  `;
  return run_query(pool, sql, [account_id, since_day, ...days], daily_counts_schema);
}

/**
 * Counts the other accounts that signed up with the same device fingerprint.
 *
 * @param pool - The connection pool.
 * @param account_id - The account id.
 * @returns How many accounts share it, this one not included.
 */
export async function count_accounts_sharing_fingerprint(
  pool: Pool,
  account_id: number,
): Promise<number> {
  const rows = await run_query(pool, shared_fingerprint_sql, [account_id], total_schema);
  return rows[0]?.total ?? 0;
}

/**
 * Counts the accounts that signed up from the same IP around the same time.
 *
 * @param pool - The connection pool.
 * @param account_id - The account id.
 * @param window_minutes - How far before and after this signup to look.
 * @returns How many accounts, this one included. Zero for an unknown account.
 */
export async function count_signups_from_same_ip(
  pool: Pool,
  account_id: number,
  window_minutes: number,
): Promise<number> {
  const rows = await run_query(
    pool,
    signup_velocity_sql,
    [account_id, window_minutes, window_minutes],
    total_schema,
  );
  return rows[0]?.total ?? 0;
}

/**
 * Reads what a list needs to score a page of accounts, in one query. It
 * uses the pre-aggregated table only and never touches raw events.
 *
 * @param pool - The connection pool.
 * @param account_ids - The accounts on the page. An empty list returns an
 *   empty array without touching the database.
 * @param since_day - The first UTC day of the window, as `YYYY-MM-DD`.
 * @param window_minutes - The signup velocity window.
 * @returns One row per account that exists. An account with no stats rows
 *   has zero counts and zero days.
 */
export async function list_quick_risk(
  pool: Pool,
  account_ids: readonly number[],
  since_day: string,
  window_minutes: number,
): Promise<QuickRiskRow[]> {
  if (account_ids.length === 0) return [];
  // One placeholder per account. The ids themselves are bound as parameters.
  const placeholders = account_ids.map(() => "?").join(", ");
  const sql = `
    SELECT
      subject.id AS account_id,
      COALESCE(totals.payments, 0) AS payments,
      COALESCE(totals.failed_payments, 0) AS failed_payments,
      COALESCE(totals.failed_logins, 0) AS failed_logins,
      COALESCE(totals.cpu_spikes, 0) AS cpu_spikes,
      COALESCE(totals.abuse_reports, 0) AS abuse_reports,
      COALESCE(totals.days, 0) AS days,
      (
        SELECT COUNT(*) FROM accounts AS others
        WHERE others.signup_fingerprint = subject.signup_fingerprint
          AND others.id <> subject.id
      ) AS accounts_sharing_fingerprint,
      (
        SELECT COUNT(*) FROM accounts AS others
        WHERE others.signup_ip = subject.signup_ip
          AND others.created_at BETWEEN subject.created_at - INTERVAL ? MINUTE
                                    AND subject.created_at + INTERVAL ? MINUTE
      ) AS signups_from_same_ip
    FROM accounts AS subject
    LEFT JOIN (
      SELECT
        account_id,
        SUM(payments_count) AS payments,
        SUM(failed_payments_count) AS failed_payments,
        SUM(failed_logins_count) AS failed_logins,
        SUM(cpu_spikes_count) AS cpu_spikes,
        SUM(abuse_reports_count) AS abuse_reports,
        COUNT(*) AS days
      FROM account_daily_stats
      WHERE day >= ? AND account_id IN (${placeholders})
      GROUP BY account_id
    ) AS totals ON totals.account_id = subject.id
    WHERE subject.id IN (${placeholders})
  `;
  return run_query(
    pool,
    sql,
    [window_minutes, window_minutes, since_day, ...account_ids, ...account_ids],
    quick_risk_row_schema,
  );
}
