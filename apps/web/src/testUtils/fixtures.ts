import { permissions_for } from "@trust-desk/shared";
import type {
  Account,
  AccountEvent,
  AccountSummary,
  OperationalMode,
  RiskScore,
  SessionResponse,
  StaffGroup,
} from "@trust-desk/shared";
import { ApiError } from "@/lib/api/apiError";

export const correlationId = "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f";

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function buildSession(group: StaffGroup): SessionResponse {
  return {
    user: {
      id: 3,
      email: `${group}@example.com`,
      display_name: `Demo ${group}`,
      group_name: group,
      permissions: permissions_for(group),
    },
  };
}

export function buildAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 42,
    email: "m***@example.com",
    status: "active",
    plan: "pro",
    spam_marked_at: null,
    created_at: "2026-09-01T01:02:03.456789Z",
    signup_context: {
      ip: "192.0.2.***",
      country: "PH",
      user_agent: "Mozilla/5.0",
      device_fingerprint: "fp_***9a1",
      referral: null,
    },
    pii_revealed: false,
    ...overrides,
  };
}

/** The same account as `buildAccount`, with every PII field unmasked. */
export function buildRevealedAccount(): Account {
  return buildAccount({
    email: "mallory@example.com",
    signup_context: {
      ip: "192.0.2.44",
      country: "PH",
      user_agent: "Mozilla/5.0 (X11; Linux x86_64)",
      device_fingerprint: "fp_7c1d09a1",
      referral: null,
    },
    pii_revealed: true,
  });
}

export function buildAccountSummary(overrides: Partial<AccountSummary> = {}): AccountSummary {
  return {
    id: 1,
    email: "a***@example.com",
    status: "active",
    plan: "free",
    spam_marked_at: null,
    created_at: "2026-09-01T01:02:03.456789Z",
    risk: { score: 12, band: "low", flagged_for_review: false },
    ...overrides,
  };
}

export function buildRiskScore(overrides: Partial<RiskScore> = {}): RiskScore {
  return {
    score: 72,
    band: "high",
    flagged_for_review: true,
    review_threshold: 60,
    signals: [
      {
        key: "shared_fingerprint",
        label: "Shared device fingerprint",
        points: 30,
        max_points: 30,
        explanation: "12 other accounts signed up with the same device fingerprint.",
      },
      {
        key: "abuse_reports",
        label: "Abuse reports",
        points: 20,
        max_points: 30,
        explanation: "2 abuse reports in the last 30 days.",
      },
      {
        key: "disposable_email",
        label: "Disposable email domain",
        points: 0,
        max_points: 10,
        explanation: "The email domain is not on the disposable list.",
      },
    ],
    source: { days_from_stats: 30, days_from_fallback: 0 },
    ...overrides,
  };
}

export function buildOperationalMode(overrides: Partial<OperationalMode> = {}): OperationalMode {
  return {
    mode: "normal",
    reason: "Seeded at the start of the demo.",
    changed_by: { id: 3, display_name: "Demo Enforcer" },
    changed_at: "2026-09-30T01:02:03.456789Z",
    review_threshold: 60,
    unsuspend_allowed: true,
    ...overrides,
  };
}

export function buildEvent(overrides: Partial<AccountEvent> = {}): AccountEvent {
  return {
    id: 100,
    event_type: "login",
    occurred_at: "2026-09-29T01:02:03.456789Z",
    payload: { ip: "192.0.2.***", country: "PH" },
    ...overrides,
  };
}

export function buildApiError(
  status: number,
  code: string,
  message: string,
  retryAfterSeconds: number | null = null,
): ApiError {
  return new ApiError({ status, code, message, correlationId, retryAfterSeconds });
}
