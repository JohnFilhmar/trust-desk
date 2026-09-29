import type { EventType, RevealedField, RiskBand } from "@trust-desk/shared";

/** The text shown for each risk band. */
export const riskBandLabels: Readonly<Record<RiskBand, string>> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** The text shown for each type of event on a timeline. */
export const eventTypeLabels: Readonly<Record<EventType, string>> = {
  signup: "Signed up",
  login: "Signed in",
  login_failed: "Failed sign-in",
  payment: "Payment",
  payment_failed: "Failed payment",
  deploy: "Deploy",
  cpu_spike: "CPU spike",
  abuse_report: "Abuse report",
  api_burst: "API burst",
};

/** The text shown for each PII field a reveal can unmask. */
export const revealedFieldLabels: Readonly<Record<RevealedField, string>> = {
  email: "Email",
  signup_ip: "Signup IP address",
  device_fingerprint: "Device fingerprint",
  user_agent: "User agent",
};
