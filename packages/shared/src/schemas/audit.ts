import { z } from "zod";
import { timestamp_schema } from "./account.ts";

/** What an audit row records. */
export const audit_action_schema = z.enum([
  "account.suspend",
  "account.unsuspend",
  "account.mark_spam",
  "pii.reveal",
  "mode.change",
]);
export type AuditAction = z.infer<typeof audit_action_schema>;

/** One row of the audit trail. `details` never holds raw PII. */
export const audit_log_entry_schema = z.object({
  id: z.number().int().positive(),
  action: audit_action_schema,
  actor: z.object({
    id: z.number().int().positive(),
    display_name: z.string().min(1),
  }),
  account_id: z.number().int().positive().nullable(),
  details: z.record(z.string(), z.unknown()),
  correlation_id: z.uuid(),
  created_at: timestamp_schema,
});
export type AuditLogEntry = z.infer<typeof audit_log_entry_schema>;

/** Query string of `GET /api/audit_logs`. */
export const audit_log_query_schema = z.object({
  account_id: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AuditLogQuery = z.infer<typeof audit_log_query_schema>;

/** Body of `GET /api/audit_logs`, newest first. */
export const audit_log_response_schema = z.object({
  items: z.array(audit_log_entry_schema),
});
export type AuditLogResponse = z.infer<typeof audit_log_response_schema>;
