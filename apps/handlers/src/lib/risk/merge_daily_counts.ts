import type { RiskSource } from "@trust-desk/shared";
import type { RiskCounts } from "#app/lib/risk/compute_risk_score.ts";

/** One day of counts, from either source. */
export type DailyCounts = RiskCounts & {
  /** A UTC day, as `YYYY-MM-DD`. */
  day: string;
};

/** One row of the pre-aggregated table. */
export type StatsDay = DailyCounts & {
  /** When the row was computed, exactly as MySQL wrote it. */
  computed_at: string;
};

/** The newest event of one account on one day. */
export type EventDay = {
  day: string;
  /** Exactly as MySQL wrote it, so it compares as text with `computed_at`. */
  newest_event_at: string;
};

const zero: RiskCounts = {
  payments: 0,
  failed_payments: 0,
  failed_logins: 0,
  cpu_spikes: 0,
  abuse_reports: 0,
};

/**
 * Finds the days whose pre-aggregated row cannot be trusted.
 *
 * @param stats - The rows of the pre-aggregated table inside the window.
 * @param events - The newest event per day inside the window.
 * @returns The days that have events but no stats row, or whose stats row
 *   was computed before the day's newest event. Both timestamps are
 *   `YYYY-MM-DD HH:MM:SS.ffffff` in UTC, a format that sorts as text.
 */
export function days_needing_fallback(
  stats: readonly StatsDay[],
  events: readonly EventDay[],
): string[] {
  const computed_at = new Map(stats.map((row) => [row.day, row.computed_at]));
  return events
    .filter((event) => {
      const computed = computed_at.get(event.day);
      return computed === undefined || computed < event.newest_event_at;
    })
    .map((event) => event.day);
}

/**
 * Adds up the counts of a window from both sources.
 *
 * @param stats - The rows of the pre-aggregated table inside the window.
 * @param fallback - Counts taken from raw events, for the days that needed it.
 * @returns The totals, and how many days came from each source. A day in
 *   `fallback` replaces the stats row of the same day and is never added
 *   to it, so no event is counted twice.
 */
export function merge_daily_counts(
  stats: readonly StatsDay[],
  fallback: readonly DailyCounts[],
): { counts: RiskCounts; source: RiskSource } {
  const replaced = new Set(fallback.map((row) => row.day));
  const trusted = stats.filter((row) => !replaced.has(row.day));

  const counts = [...trusted, ...fallback].reduce<RiskCounts>(
    (total, row) => ({
      payments: total.payments + row.payments,
      failed_payments: total.failed_payments + row.failed_payments,
      failed_logins: total.failed_logins + row.failed_logins,
      cpu_spikes: total.cpu_spikes + row.cpu_spikes,
      abuse_reports: total.abuse_reports + row.abuse_reports,
    }),
    zero,
  );

  return {
    counts,
    source: { days_from_stats: trusted.length, days_from_fallback: fallback.length },
  };
}
