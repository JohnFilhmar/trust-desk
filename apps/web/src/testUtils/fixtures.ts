import { permissions_for } from "@trust-desk/shared";
import type { Account, SessionResponse, StaffGroup } from "@trust-desk/shared";
import { ApiError } from "@/lib/api/apiError";

export const correlationId = "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f";

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

export function buildApiError(status: number, code: string, message: string): ApiError {
  return new ApiError({ status, code, message, correlationId });
}
