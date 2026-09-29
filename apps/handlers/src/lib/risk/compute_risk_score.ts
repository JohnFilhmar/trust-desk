import type {
  OperationalModeName,
  RiskBand,
  RiskScore,
  RiskSignal,
  RiskSource,
} from "@trust-desk/shared";
import { risk_config } from "#app/lib/risk/risk_config.ts";

/** The activity of one account over the scoring window, already added up. */
export type RiskCounts = {
  payments: number;
  failed_payments: number;
  failed_logins: number;
  cpu_spikes: number;
  abuse_reports: number;
};

/** Everything the score is computed from. No database and no clock: the same input always gives the same score. */
export type RiskInput = {
  counts: RiskCounts;
  /** How many OTHER accounts signed up with the same device fingerprint. */
  accounts_sharing_fingerprint: number;
  /** How many accounts, this one included, signed up from the same IP within the velocity window. */
  signups_from_same_ip: number;
  /** The part of the email after the `@`, lowercase. */
  email_domain: string;
  mode: OperationalModeName;
  source: RiskSource;
};

const max = risk_config.max_points;

function capped(points: number, limit: number): number {
  return Math.max(0, Math.min(limit, Math.floor(points)));
}

function failed_payment_rate(counts: RiskCounts): RiskSignal {
  const attempts = counts.payments + counts.failed_payments;
  const enough = attempts >= risk_config.failed_payment_rate.min_attempts;
  const rate = attempts === 0 ? 0 : counts.failed_payments / attempts;
  return {
    key: "failed_payment_rate",
    label: "Failed payment rate",
    points: enough ? capped(rate * max.failed_payment_rate, max.failed_payment_rate) : 0,
    max_points: max.failed_payment_rate,
    explanation: enough
      ? `${counts.failed_payments} of ${attempts} payment attempts failed (${Math.round(rate * 100)}%).`
      : `${attempts} payment attempts, too few to judge a rate. At least ${risk_config.failed_payment_rate.min_attempts} are needed.`,
  };
}

function shared_fingerprint(others: number): RiskSignal {
  const rule = risk_config.shared_fingerprint;
  const points =
    others === 0 ? 0 : rule.base_points + (others - 1) * rule.points_per_extra_account;
  return {
    key: "shared_fingerprint",
    label: "Device fingerprint shared across accounts",
    points: capped(points, max.shared_fingerprint),
    max_points: max.shared_fingerprint,
    explanation:
      others === 0
        ? "No other account signed up with this device fingerprint."
        : `${others} other ${others === 1 ? "account" : "accounts"} signed up with the same device fingerprint.`,
  };
}

function signup_velocity(signups: number): RiskSignal {
  const rule = risk_config.signup_velocity;
  const scored = signups >= rule.min_signups;
  return {
    key: "signup_velocity",
    label: "Signup velocity from one IP",
    points: scored ? capped(signups * rule.points_per_signup, max.signup_velocity) : 0,
    max_points: max.signup_velocity,
    explanation: scored
      ? `${signups} accounts signed up from the same IP within ${rule.window_minutes} minutes.`
      : `${signups} ${signups === 1 ? "signup" : "signups"} from this IP within ${rule.window_minutes} minutes, below the ${rule.min_signups} that count as a burst.`,
  };
}

function cpu_spikes(spikes: number): RiskSignal {
  const rule = risk_config.cpu_spikes;
  const over = Math.max(0, spikes - rule.free_spikes);
  return {
    key: "cpu_spikes",
    label: "CPU spikes",
    points: capped(over * rule.points_per_spike, max.cpu_spikes),
    max_points: max.cpu_spikes,
    explanation: `${spikes} CPU ${spikes === 1 ? "spike" : "spikes"} in ${risk_config.window_days} days. The first ${rule.free_spikes} are not counted.`,
  };
}

function abuse_reports(reports: number): RiskSignal {
  return {
    key: "abuse_reports",
    label: "Abuse reports",
    points: capped(reports * risk_config.abuse_reports.points_per_report, max.abuse_reports),
    max_points: max.abuse_reports,
    explanation: `${reports} abuse ${reports === 1 ? "report" : "reports"} in ${risk_config.window_days} days.`,
  };
}

function failed_logins(failures: number): RiskSignal {
  const rule = risk_config.failed_logins;
  const over = Math.max(0, failures - rule.free_failures);
  return {
    key: "failed_logins",
    label: "Failed logins",
    points: capped(over / rule.failures_per_point, max.failed_logins),
    max_points: max.failed_logins,
    explanation: `${failures} failed ${failures === 1 ? "login" : "logins"} in ${risk_config.window_days} days. The first ${rule.free_failures} are not counted.`,
  };
}

function disposable_email(domain: string): RiskSignal {
  const disposable = risk_config.disposable_domains.some((known) => known === domain);
  return {
    key: "disposable_email",
    label: "Disposable email domain",
    points: disposable ? max.disposable_email : 0,
    max_points: max.disposable_email,
    explanation: disposable
      ? `The email domain ${domain} hands out throwaway mailboxes.`
      : "The email domain is not on the list of throwaway providers.",
  };
}

/**
 * Names the band a score falls in.
 *
 * @param score - A score from 0 to 100.
 * @returns `high` from 60, `medium` from 30, otherwise `low`.
 */
export function band_for(score: number): RiskBand {
  if (score >= risk_config.bands.high_from) return "high";
  if (score >= risk_config.bands.medium_from) return "medium";
  return "low";
}

/**
 * Computes the risk score of one account. This is the only implementation
 * of the score in the project. Rails never computes one.
 *
 * It is a plain sum of rule-based signals, so every point can be traced to
 * a number an analyst can check. There is no model and nothing is learned.
 *
 * @param input - Counts over the window, the two signals that span
 *   accounts, the email domain, and the operational mode.
 * @returns The score capped at 100, its band, whether it crosses the review
 *   threshold of the current mode, and all seven signals with their
 *   explanations, highest points first. A signal with zero points is
 *   included, so the analyst sees what was checked.
 */
export function compute_risk_score(input: RiskInput): RiskScore {
  const signals = [
    failed_payment_rate(input.counts),
    shared_fingerprint(input.accounts_sharing_fingerprint),
    signup_velocity(input.signups_from_same_ip),
    cpu_spikes(input.counts.cpu_spikes),
    abuse_reports(input.counts.abuse_reports),
    failed_logins(input.counts.failed_logins),
    disposable_email(input.email_domain),
  ].sort((a, b) => b.points - a.points);

  const total = signals.reduce((sum, signal) => sum + signal.points, 0);
  const score = capped(total, 100);
  const review_threshold = risk_config.review_threshold[input.mode];

  return {
    score,
    band: band_for(score),
    flagged_for_review: score >= review_threshold,
    review_threshold,
    signals,
    source: input.source,
  };
}
