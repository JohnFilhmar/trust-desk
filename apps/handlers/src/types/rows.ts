import type { AccountStatus, EventType, OperationalModeName } from "@trust-desk/shared";
import type { z } from "zod";
import type {
  account_row_schema,
  staff_credentials_row_schema,
  staff_user_row_schema,
} from "#app/repositories/row_schemas.ts";

export type StaffUserRow = z.infer<typeof staff_user_row_schema>;
export type StaffCredentialsRow = z.infer<typeof staff_credentials_row_schema>;
export type AccountRow = z.infer<typeof account_row_schema>;

/**
 * The position of the last row of a page. The next page starts after it.
 * Accounts are ordered by `created_at`, events by `occurred_at`.
 */
export type KeysetCursor = {
  /** The ordering timestamp exactly as MySQL wrote it, microseconds included. */
  at: string;
  id: number;
};

export type AccountSearchArgs = {
  status: AccountStatus | null;
  /** Any part of the email. Matched with LIKE, which cannot use an index. */
  email: string | null;
  /** The whole signup IP. Uses the index on the generated column. */
  ip: string | null;
  /** The whole device fingerprint. Uses the index on the generated column. */
  fingerprint: string | null;
  cursor: KeysetCursor | null;
  /** How many rows to return at most. */
  limit: number;
};

export type AuditLogArgs = {
  account_id: number | null;
  limit: number;
};

export type EventListArgs = {
  account_id: number;
  event_type: EventType | null;
  cursor: KeysetCursor | null;
  limit: number;
};

/** An event as stored. Its payload holds raw PII. */
export type EventRow = {
  id: number;
  event_type: EventType;
  occurred_at: string;
  /** `occurred_at` exactly as MySQL wrote it, for the cursor. */
  occurred_at_raw: string;
  payload: Record<string, unknown>;
};

/** The newest row of `operational_modes`, with the name of who wrote it. */
export type CurrentModeRow = {
  mode: OperationalModeName;
  reason: string;
  staff_user_id: number;
  display_name: string;
  created_at: string;
};

/** What a list needs to score one account quickly. */
export type QuickRiskRow = {
  account_id: number;
  payments: number;
  failed_payments: number;
  failed_logins: number;
  cpu_spikes: number;
  abuse_reports: number;
  days: number;
  accounts_sharing_fingerprint: number;
  signups_from_same_ip: number;
};
