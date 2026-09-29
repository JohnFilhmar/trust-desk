import type { OperationalModeName, RiskScore, RiskSummary } from "@trust-desk/shared";
import type { Database } from "#app/interfaces/deps.ts";
import { compute_risk_score } from "#app/lib/risk/compute_risk_score.ts";
import {
  days_needing_fallback,
  merge_daily_counts,
} from "#app/lib/risk/merge_daily_counts.ts";
import { risk_config } from "#app/lib/risk/risk_config.ts";
import type { AccountRow, QuickRiskRow } from "#app/types/rows.ts";

/**
 * Names the first day of the scoring window.
 *
 * @param now - The current moment.
 * @returns The UTC day 29 days before today, as `YYYY-MM-DD`, so that the
 *   window holds 30 days with today included.
 */
export function window_start_day(now: Date): string {
  const start = new Date(now.getTime());
  start.setUTCDate(start.getUTCDate() - (risk_config.window_days - 1));
  return start.toISOString().slice(0, 10);
}

/**
 * Reads the part of an email after the `@`.
 *
 * @param email - The raw address.
 * @returns The domain in lowercase, or an empty string when there is no `@`.
 */
export function email_domain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).toLowerCase();
}

/**
 * Computes the full risk score of one account.
 *
 * This is the read path the job description describes: the pre-aggregated
 * table first, with a fallback to raw events. Only the days whose
 * pre-aggregated row is missing or stale are counted from events.
 *
 * @param db - The read-side queries.
 * @param account - The account, with raw PII. Only its id and the domain
 *   of its email are used.
 * @param mode - The operational mode in force.
 * @param now - The current moment.
 * @returns The score with its seven signals, and how many days came from
 *   each source.
 */
export async function load_account_risk(
  db: Database,
  account: AccountRow,
  mode: OperationalModeName,
  now: Date,
): Promise<RiskScore> {
  const since = window_start_day(now);

  const [stats, event_days, accounts_sharing_fingerprint, signups_from_same_ip] =
    await Promise.all([
      db.list_stats_days(account.id, since),
      db.list_event_days(account.id, since),
      db.count_accounts_sharing_fingerprint(account.id),
      db.count_signups_from_same_ip(
        account.id,
        risk_config.signup_velocity.window_minutes,
      ),
    ]);

  const fallback = await db.count_events_for_days(
    account.id,
    since,
    days_needing_fallback(stats, event_days),
  );
  const { counts, source } = merge_daily_counts(stats, fallback);

  return compute_risk_score({
    counts,
    accounts_sharing_fingerprint,
    signups_from_same_ip,
    email_domain: email_domain(account.email),
    mode,
    source,
  });
}

/**
 * Scores one row of a list from the pre-aggregated table alone.
 *
 * @param row - The counts of one account, or `undefined` when the batch
 *   query returned none for it, which scores as no activity.
 * @param account - The account, with raw PII.
 * @param mode - The operational mode in force.
 * @returns The score, its band and whether it crosses the review threshold.
 */
export function quick_risk(
  row: QuickRiskRow | undefined,
  account: AccountRow,
  mode: OperationalModeName,
): RiskSummary {
  const { score, band, flagged_for_review } = compute_risk_score({
    counts: {
      payments: row?.payments ?? 0,
      failed_payments: row?.failed_payments ?? 0,
      failed_logins: row?.failed_logins ?? 0,
      cpu_spikes: row?.cpu_spikes ?? 0,
      abuse_reports: row?.abuse_reports ?? 0,
    },
    accounts_sharing_fingerprint: row?.accounts_sharing_fingerprint ?? 0,
    signups_from_same_ip: row?.signups_from_same_ip ?? 1,
    email_domain: email_domain(account.email),
    mode,
    source: { days_from_stats: row?.days ?? 0, days_from_fallback: 0 },
  });
  return { score, band, flagged_for_review };
}
