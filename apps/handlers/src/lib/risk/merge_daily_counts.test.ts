import { describe, expect, it } from "@jest/globals";
import {
  days_needing_fallback,
  merge_daily_counts,
} from "#app/lib/risk/merge_daily_counts.ts";
import type { DailyCounts, StatsDay } from "#app/lib/risk/merge_daily_counts.ts";

function counts(day: string, abuse_reports: number): DailyCounts {
  return {
    day,
    payments: 1,
    failed_payments: 0,
    failed_logins: 0,
    cpu_spikes: 0,
    abuse_reports,
  };
}

function stats(day: string, computed_at: string, abuse_reports = 0): StatsDay {
  return { ...counts(day, abuse_reports), computed_at };
}

describe("days_needing_fallback", () => {
  it("trusts a row computed after the day's newest event", () => {
    expect(
      days_needing_fallback(
        [stats("2026-09-28", "2026-09-29 00:05:00.000000")],
        [{ day: "2026-09-28", newest_event_at: "2026-09-28 23:59:59.999999" }],
      ),
    ).toEqual([]);
  });

  it("trusts a row computed at the very moment of the newest event", () => {
    expect(
      days_needing_fallback(
        [stats("2026-09-28", "2026-09-28 12:00:00.000000")],
        [{ day: "2026-09-28", newest_event_at: "2026-09-28 12:00:00.000000" }],
      ),
    ).toEqual([]);
  });

  it("names a day that has events and no row", () => {
    expect(
      days_needing_fallback(
        [stats("2026-09-27", "2026-09-28 00:05:00.000000")],
        [
          { day: "2026-09-27", newest_event_at: "2026-09-27 10:00:00.000000" },
          { day: "2026-09-29", newest_event_at: "2026-09-29 10:00:00.000000" },
        ],
      ),
    ).toEqual(["2026-09-29"]);
  });

  it("names a day whose row is older than its newest event, by one microsecond", () => {
    expect(
      days_needing_fallback(
        [stats("2026-09-28", "2026-09-28 12:00:00.000000")],
        [{ day: "2026-09-28", newest_event_at: "2026-09-28 12:00:00.000001" }],
      ),
    ).toEqual(["2026-09-28"]);
  });

  it("ignores a row for a day with no events", () => {
    expect(
      days_needing_fallback([stats("2026-09-28", "2026-09-29 00:05:00.000000")], []),
    ).toEqual([]);
  });
});

describe("merge_daily_counts", () => {
  it("adds up the rows of the pre-aggregated table", () => {
    const merged = merge_daily_counts(
      [
        stats("2026-09-27", "2026-09-28 00:05:00.000000", 1),
        stats("2026-09-28", "2026-09-29 00:05:00.000000", 2),
      ],
      [],
    );
    expect(merged.counts.abuse_reports).toBe(3);
    expect(merged.counts.payments).toBe(2);
    expect(merged.source).toEqual({ days_from_stats: 2, days_from_fallback: 0 });
  });

  it("replaces a stale row with the fallback, and never counts a day twice", () => {
    const merged = merge_daily_counts(
      [
        stats("2026-09-27", "2026-09-28 00:05:00.000000", 1),
        stats("2026-09-28", "2026-09-28 06:00:00.000000", 1),
      ],
      [counts("2026-09-28", 4)],
    );
    expect(merged.counts.abuse_reports).toBe(5);
    expect(merged.counts.payments).toBe(2);
    expect(merged.source).toEqual({ days_from_stats: 1, days_from_fallback: 1 });
  });

  it("adds a day the table does not have", () => {
    const merged = merge_daily_counts(
      [stats("2026-09-27", "2026-09-28 00:05:00.000000", 1)],
      [counts("2026-09-29", 2)],
    );
    expect(merged.counts.abuse_reports).toBe(3);
    expect(merged.source).toEqual({ days_from_stats: 1, days_from_fallback: 1 });
  });

  it("returns zeros for an account with no activity", () => {
    expect(merge_daily_counts([], [])).toEqual({
      counts: {
        payments: 0,
        failed_payments: 0,
        failed_logins: 0,
        cpu_spikes: 0,
        abuse_reports: 0,
      },
      source: { days_from_stats: 0, days_from_fallback: 0 },
    });
  });
});
