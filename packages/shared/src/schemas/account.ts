import { z } from "zod";
import { risk_summary_schema } from "./risk.ts";

export const account_status_schema = z.enum(["active", "suspended"]);
export type AccountStatus = z.infer<typeof account_status_schema>;

/** A moment in UTC, as ISO 8601 with a `Z`, such as `2026-09-30T01:02:03.456789Z`. */
export const timestamp_schema = z.iso.datetime({ offset: false, precision: 6 });

/**
 * One account as every list and page shows it. `email` holds the masked
 * form unless `pii_revealed` is true.
 */
export const account_schema = z.object({
  id: z.number().int().positive(),
  email: z.string().min(1),
  status: account_status_schema,
  plan: z.string().min(1),
  spam_marked_at: timestamp_schema.nullable(),
  created_at: timestamp_schema,
  signup_context: z.object({
    ip: z.string().min(1),
    country: z.string().min(1),
    user_agent: z.string().min(1),
    device_fingerprint: z.string().min(1),
    referral: z.string().nullable(),
  }),
  pii_revealed: z.boolean(),
});
export type Account = z.infer<typeof account_schema>;

/** The row shown in search results. */
export const account_summary_schema = account_schema
  .pick({
    id: true,
    email: true,
    status: true,
    plan: true,
    spam_marked_at: true,
    created_at: true,
  })
  .extend({ risk: risk_summary_schema });
export type AccountSummary = z.infer<typeof account_summary_schema>;

/** A value to search PII by. Two characters at least, so a search cannot list everyone. */
const pii_term_schema = z.string().trim().min(2).max(100);

/**
 * Query string of `GET /api/accounts`. Every value arrives as text.
 * `email`, `ip` and `fingerprint` need the permission `accounts.search_pii`.
 */
export const account_search_query_schema = z.object({
  status: account_status_schema.optional(),
  /** Any part of the email address. */
  email: pii_term_schema.optional(),
  /** The whole signup IP. */
  ip: pii_term_schema.optional(),
  /** The whole device fingerprint. */
  fingerprint: pii_term_schema.optional(),
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AccountSearchQuery = z.infer<typeof account_search_query_schema>;

/** Body of `GET /api/accounts`. `next_cursor` is null on the last page. */
export const account_search_response_schema = z.object({
  items: z.array(account_summary_schema),
  next_cursor: z.string().nullable(),
});
export type AccountSearchResponse = z.infer<typeof account_search_response_schema>;

/** Path parameter of every route under `/api/accounts/:account_id`. */
export const account_id_param_schema = z.coerce.number().int().positive();
