import type { OperationalModeName, RiskSignalKey } from "@trust-desk/shared";

/**
 * Every weight and threshold of the risk score, in one place. Changing a
 * number here changes the score and nothing else does.
 *
 * The maximum points of all signals add up to more than 100 on purpose. An
 * account rarely trips every signal, and the total is capped at 100.
 */
export const risk_config = {
  /** How many days of activity the score looks at. */
  window_days: 30,

  max_points: {
    failed_payment_rate: 25,
    shared_fingerprint: 30,
    signup_velocity: 20,
    cpu_spikes: 20,
    abuse_reports: 30,
    failed_logins: 10,
    disposable_email: 10,
  } satisfies Record<RiskSignalKey, number>,

  failed_payment_rate: {
    /** Below this many payment attempts, a rate means nothing. */
    min_attempts: 3,
  },
  shared_fingerprint: {
    /** Points for the first other account sharing the fingerprint. */
    base_points: 10,
    /** Points for each further account. */
    points_per_extra_account: 2,
  },
  signup_velocity: {
    /** Signups from one IP within this many minutes count together. */
    window_minutes: 60,
    /** Below this many signups, including this one, nothing is scored. */
    min_signups: 3,
    points_per_signup: 2,
  },
  cpu_spikes: {
    /** A few spikes are normal for a busy app. */
    free_spikes: 3,
    points_per_spike: 2,
  },
  abuse_reports: {
    points_per_report: 10,
  },
  failed_logins: {
    /** Anyone mistypes a password now and then. */
    free_failures: 5,
    failures_per_point: 5,
  },

  bands: {
    /** A score at or above this is medium. */
    medium_from: 30,
    /** A score at or above this is high. */
    high_from: 60,
  },

  /** The score at which an account is flagged for review, per operational mode. */
  review_threshold: {
    normal: 60,
    elevated: 40,
    lockdown: 40,
  } satisfies Record<OperationalModeName, number>,

  /**
   * Domains that hand out throwaway mailboxes. The seed uses subdomains of
   * example.org, since every email in this demo must be on a reserved domain.
   */
  disposable_domains: [
    "mailinator.example.org",
    "tempmail.example.org",
    "throwaway.example.org",
    "guerrillamail.example.org",
  ],
} as const;
