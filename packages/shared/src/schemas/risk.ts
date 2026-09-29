import { z } from "zod";

export const risk_band_schema = z.enum(["low", "medium", "high"]);
export type RiskBand = z.infer<typeof risk_band_schema>;

export const risk_signal_key_schema = z.enum([
  "failed_payment_rate",
  "shared_fingerprint",
  "signup_velocity",
  "cpu_spikes",
  "abuse_reports",
  "failed_logins",
  "disposable_email",
]);
export type RiskSignalKey = z.infer<typeof risk_signal_key_schema>;

/** One reason behind a score. A signal with zero points is still listed, so an analyst sees what was checked. */
export const risk_signal_schema = z.object({
  key: risk_signal_key_schema,
  label: z.string().min(1),
  points: z.number().int().min(0),
  max_points: z.number().int().positive(),
  /** A sentence with the numbers behind the points. It never holds raw PII. */
  explanation: z.string().min(1),
});
export type RiskSignal = z.infer<typeof risk_signal_schema>;

/** Where the daily counts came from. */
export const risk_source_schema = z.object({
  /** Days read from the pre-aggregated table. */
  days_from_stats: z.number().int().min(0),
  /** Days counted from raw events, because the stats row was missing or stale. */
  days_from_fallback: z.number().int().min(0),
});
export type RiskSource = z.infer<typeof risk_source_schema>;

/** A score and everything needed to explain it. */
export const risk_score_schema = z.object({
  score: z.number().int().min(0).max(100),
  band: risk_band_schema,
  /** True when the score is at or above the review threshold of the current mode. */
  flagged_for_review: z.boolean(),
  review_threshold: z.number().int().min(0).max(100),
  signals: z.array(risk_signal_schema),
  source: risk_source_schema,
});
export type RiskScore = z.infer<typeof risk_score_schema>;

/**
 * The risk of an account as a list shows it. It is computed from the
 * pre-aggregated table only, so a list stays fast. The account page
 * computes the full score, fallback included.
 */
export const risk_summary_schema = risk_score_schema.pick({
  score: true,
  band: true,
  flagged_for_review: true,
});
export type RiskSummary = z.infer<typeof risk_summary_schema>;
