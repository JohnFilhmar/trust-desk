import { describe, expect, it } from "@jest/globals";
import { risk_score_schema } from "@trust-desk/shared";
import type { RiskSignalKey } from "@trust-desk/shared";
import { band_for, compute_risk_score } from "#app/lib/risk/compute_risk_score.ts";
import type { RiskInput } from "#app/lib/risk/compute_risk_score.ts";
import { risk_config } from "#app/lib/risk/risk_config.ts";

const clean: RiskInput = {
  counts: {
    payments: 3,
    failed_payments: 0,
    failed_logins: 1,
    cpu_spikes: 0,
    abuse_reports: 0,
  },
  accounts_sharing_fingerprint: 0,
  signups_from_same_ip: 1,
  email_domain: "example.com",
  mode: "normal",
  source: { days_from_stats: 30, days_from_fallback: 0 },
};

function points(input: RiskInput, key: RiskSignalKey): number {
  const signal = compute_risk_score(input).signals.find((item) => item.key === key);
  if (signal === undefined) throw new Error(`Signal ${key} is missing.`);
  return signal.points;
}

describe("compute_risk_score", () => {
  it("scores a clean account at zero and low", () => {
    const result = compute_risk_score(clean);
    expect(result.score).toBe(0);
    expect(result.band).toBe("low");
    expect(result.flagged_for_review).toBe(false);
  });

  it("fits the shared schema and always lists all seven signals", () => {
    const result = risk_score_schema.parse(compute_risk_score(clean));
    expect(result.signals.map((signal) => signal.key).sort()).toEqual(
      Object.keys(risk_config.max_points).sort(),
    );
  });

  it("gives the same score for the same input", () => {
    expect(compute_risk_score(clean)).toEqual(compute_risk_score(clean));
  });

  it("is the sum of its signals, so every point can be traced", () => {
    const result = compute_risk_score({
      ...clean,
      counts: { ...clean.counts, abuse_reports: 1, cpu_spikes: 6 },
      accounts_sharing_fingerprint: 2,
    });
    const sum = result.signals.reduce((total, signal) => total + signal.points, 0);
    expect(result.score).toBe(sum);
    expect(result.score).toBe(10 + 6 + 12);
  });

  it("never exceeds 100, even when every signal is at its maximum", () => {
    const result = compute_risk_score({
      counts: {
        payments: 0,
        failed_payments: 50,
        failed_logins: 500,
        cpu_spikes: 500,
        abuse_reports: 50,
      },
      accounts_sharing_fingerprint: 50,
      signups_from_same_ip: 50,
      email_domain: "mailinator.example.org",
      mode: "normal",
      source: clean.source,
    });
    expect(result.score).toBe(100);
    expect(result.band).toBe("high");
    for (const signal of result.signals) {
      expect(signal.points).toBeLessThanOrEqual(signal.max_points);
    }
  });

  it("lists the signal with the most points first", () => {
    const result = compute_risk_score({
      ...clean,
      counts: { ...clean.counts, abuse_reports: 3 },
      email_domain: "tempmail.example.org",
    });
    expect(result.signals[0]?.key).toBe("abuse_reports");
    expect(result.signals[1]?.key).toBe("disposable_email");
  });
});

describe("the signals", () => {
  it("ignores a failed payment rate built on fewer than 3 attempts", () => {
    const two_failed = {
      ...clean,
      counts: { ...clean.counts, payments: 0, failed_payments: 2 },
    };
    expect(points(two_failed, "failed_payment_rate")).toBe(0);
  });

  it("scores a failed payment rate in proportion", () => {
    const half = { ...clean, counts: { ...clean.counts, payments: 5, failed_payments: 5 } };
    const all = { ...clean, counts: { ...clean.counts, payments: 0, failed_payments: 8 } };
    expect(points(half, "failed_payment_rate")).toBe(12);
    expect(points(all, "failed_payment_rate")).toBe(25);
  });

  it("scores a shared fingerprint by how many other accounts share it", () => {
    expect(points({ ...clean, accounts_sharing_fingerprint: 1 }, "shared_fingerprint")).toBe(10);
    expect(points({ ...clean, accounts_sharing_fingerprint: 3 }, "shared_fingerprint")).toBe(14);
    expect(points({ ...clean, accounts_sharing_fingerprint: 11 }, "shared_fingerprint")).toBe(30);
  });

  it("scores signup velocity only from 3 signups on", () => {
    expect(points({ ...clean, signups_from_same_ip: 2 }, "signup_velocity")).toBe(0);
    expect(points({ ...clean, signups_from_same_ip: 3 }, "signup_velocity")).toBe(6);
    expect(points({ ...clean, signups_from_same_ip: 15 }, "signup_velocity")).toBe(20);
  });

  it("does not count the first 3 CPU spikes", () => {
    const with_spikes = (cpu_spikes: number) => ({
      ...clean,
      counts: { ...clean.counts, cpu_spikes },
    });
    expect(points(with_spikes(3), "cpu_spikes")).toBe(0);
    expect(points(with_spikes(4), "cpu_spikes")).toBe(2);
    expect(points(with_spikes(40), "cpu_spikes")).toBe(20);
  });

  it("scores 10 points per abuse report, up to 30", () => {
    const with_reports = (abuse_reports: number) => ({
      ...clean,
      counts: { ...clean.counts, abuse_reports },
    });
    expect(points(with_reports(1), "abuse_reports")).toBe(10);
    expect(points(with_reports(9), "abuse_reports")).toBe(30);
  });

  it("does not count the first 5 failed logins", () => {
    const with_failures = (failed_logins: number) => ({
      ...clean,
      counts: { ...clean.counts, failed_logins },
    });
    expect(points(with_failures(5), "failed_logins")).toBe(0);
    expect(points(with_failures(10), "failed_logins")).toBe(1);
    expect(points(with_failures(500), "failed_logins")).toBe(10);
  });

  it("scores a throwaway email domain and no other", () => {
    expect(points({ ...clean, email_domain: "mailinator.example.org" }, "disposable_email")).toBe(10);
    expect(points({ ...clean, email_domain: "example.org" }, "disposable_email")).toBe(0);
  });

  it("explains every signal with its numbers and no PII", () => {
    const result = compute_risk_score({
      ...clean,
      accounts_sharing_fingerprint: 11,
      signups_from_same_ip: 15,
    });
    const text = result.signals.map((signal) => signal.explanation).join(" ");
    expect(text).toContain("11 other accounts");
    expect(text).toContain("15 accounts signed up from the same IP");
    expect(text).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
    expect(text).not.toContain("fp_");
  });
});

describe("bands and the review threshold", () => {
  it.each([
    [0, "low"],
    [29, "low"],
    [30, "medium"],
    [59, "medium"],
    [60, "high"],
    [100, "high"],
  ])("puts a score of %i in the %s band", (score, band) => {
    expect(band_for(score)).toBe(band);
  });

  it("flags a score of 40 in elevated mode and not in normal mode", () => {
    const forty = {
      ...clean,
      counts: { ...clean.counts, abuse_reports: 3 },
      email_domain: "tempmail.example.org",
    };
    const normal = compute_risk_score({ ...forty, mode: "normal" });
    const elevated = compute_risk_score({ ...forty, mode: "elevated" });

    expect(normal.score).toBe(40);
    expect(elevated.score).toBe(40);
    expect(normal.flagged_for_review).toBe(false);
    expect(elevated.flagged_for_review).toBe(true);
    expect(elevated.review_threshold).toBe(40);
  });

  it("reports where the counts came from", () => {
    const source = { days_from_stats: 28, days_from_fallback: 2 };
    expect(compute_risk_score({ ...clean, source }).source).toEqual(source);
  });
});
