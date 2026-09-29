import { z } from "zod";
import { account_status_schema, timestamp_schema } from "./account.ts";

export const enforcement_action_type_schema = z.enum([
  "suspend",
  "unsuspend",
  "mark_spam",
]);
export type EnforcementActionType = z.infer<typeof enforcement_action_type_schema>;

/** A reason an analyst typed. Shorter than 10 characters is rarely a reason. */
export const reason_schema = z.string().trim().min(10).max(500);

/** One action taken against an account. */
export const enforcement_action_schema = z.object({
  id: z.number().int().positive(),
  account_id: z.number().int().positive(),
  staff_user_id: z.number().int().positive(),
  action_type: enforcement_action_type_schema,
  reason: z.string().min(1),
  correlation_id: z.uuid(),
  created_at: timestamp_schema,
});
export type EnforcementAction = z.infer<typeof enforcement_action_schema>;

/** Body the browser sends to suspend, unsuspend or mark as spam. */
export const enforcement_request_schema = z.object({
  reason: reason_schema,
});
export type EnforcementRequest = z.infer<typeof enforcement_request_schema>;

/**
 * Body the handlers send to Rails. The acting staff user's id sits inside
 * the body, so the signature covers it.
 */
export const internal_enforcement_request_schema = enforcement_request_schema.extend({
  actor_staff_user_id: z.number().int().positive(),
  /**
   * The `Idempotency-Key` header the browser sent, or null when it sent
   * none. It sits in the body so that the signature covers it.
   */
  idempotency_key: z.uuid().nullable(),
});
export type InternalEnforcementRequest = z.infer<
  typeof internal_enforcement_request_schema
>;

/**
 * What Rails answers after an enforcement action, and what the handlers
 * pass on to the browser unchanged. It carries no PII.
 */
export const enforcement_result_schema = z.object({
  enforcement_action: enforcement_action_schema,
  account: z.object({
    id: z.number().int().positive(),
    status: account_status_schema,
    spam_marked_at: timestamp_schema.nullable(),
  }),
  audit_log_id: z.number().int().positive(),
});
export type EnforcementResult = z.infer<typeof enforcement_result_schema>;
