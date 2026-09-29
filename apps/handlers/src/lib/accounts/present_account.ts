import type { Account, AccountSummary, RiskSummary } from "@trust-desk/shared";
import {
  mask_email,
  mask_fingerprint,
  mask_ip,
  mask_user_agent,
} from "#app/lib/pii/mask.ts";
import type { AccountRow } from "#app/types/rows.ts";

/**
 * Turns a stored account into what the console may see, with every PII
 * field masked. Every read of an account goes through here. The one
 * exception is a reveal, which builds its response only after Rails has
 * written the audit row.
 *
 * @param row - The account as stored, with raw PII.
 * @returns The account with `pii_revealed` set to false.
 */
export function present_masked_account(row: AccountRow): Account {
  return {
    id: row.id,
    email: mask_email(row.email),
    status: row.status,
    plan: row.plan,
    spam_marked_at: row.spam_marked_at,
    created_at: row.created_at,
    signup_context: {
      ip: mask_ip(row.signup_context.ip),
      country: row.signup_context.country,
      user_agent: mask_user_agent(row.signup_context.user_agent),
      device_fingerprint: mask_fingerprint(row.signup_context.device_fingerprint),
      referral: row.signup_context.referral,
    },
    pii_revealed: false,
  };
}

/**
 * Turns a stored account into a search result row, with the email masked.
 *
 * @param row - The account as stored, with raw PII.
 * @param risk - The quick score of the account.
 * @returns The fields a results table shows.
 */
export function present_masked_summary(row: AccountRow, risk: RiskSummary): AccountSummary {
  return {
    id: row.id,
    email: mask_email(row.email),
    status: row.status,
    plan: row.plan,
    spam_marked_at: row.spam_marked_at,
    created_at: row.created_at,
    risk,
  };
}
