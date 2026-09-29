import { z } from "zod";
import { account_schema } from "./account.ts";
import { reason_schema } from "./enforcement.ts";

/** The PII fields a reveal unmasks. The audit row lists them by name, never by value. */
export const revealed_field_schema = z.enum([
  "email",
  "signup_ip",
  "device_fingerprint",
  "user_agent",
]);
export type RevealedField = z.infer<typeof revealed_field_schema>;

/** Body the browser sends to reveal the PII of one account. */
export const reveal_request_schema = z.object({
  reason: reason_schema,
});
export type RevealRequest = z.infer<typeof reveal_request_schema>;

/**
 * Body the handlers send to Rails before they unmask anything. The acting
 * staff user's id sits inside the body, so the signature covers it.
 */
export const internal_reveal_request_schema = reveal_request_schema.extend({
  actor_staff_user_id: z.number().int().positive(),
  account_id: z.number().int().positive(),
  fields: z.array(revealed_field_schema).min(1),
});
export type InternalRevealRequest = z.infer<typeof internal_reveal_request_schema>;

/** What Rails answers once the audit row exists. */
export const internal_reveal_result_schema = z.object({
  audit_log_id: z.number().int().positive(),
});
export type InternalRevealResult = z.infer<typeof internal_reveal_result_schema>;

/** Body of a successful reveal. `account.pii_revealed` is true. */
export const reveal_response_schema = z.object({
  account: account_schema,
  audit_log_id: z.number().int().positive(),
});
export type RevealResponse = z.infer<typeof reveal_response_schema>;
