import { z } from "zod";
import { timestamp_schema } from "./account.ts";
import { reason_schema } from "./enforcement.ts";

export const operational_mode_name_schema = z.enum(["normal", "elevated", "lockdown"]);
export type OperationalModeName = z.infer<typeof operational_mode_name_schema>;

/** The mode in force, and who set it. */
export const operational_mode_schema = z.object({
  mode: operational_mode_name_schema,
  reason: z.string().min(1),
  changed_by: z.object({
    id: z.number().int().positive(),
    display_name: z.string().min(1),
  }),
  changed_at: timestamp_schema,
  /** The risk score at which an account is flagged for review in this mode. */
  review_threshold: z.number().int().min(0).max(100),
  /** False in lockdown. */
  unsuspend_allowed: z.boolean(),
});
export type OperationalMode = z.infer<typeof operational_mode_schema>;

/** Body the browser sends to change the mode. */
export const mode_change_request_schema = z.object({
  mode: operational_mode_name_schema,
  reason: reason_schema,
});
export type ModeChangeRequest = z.infer<typeof mode_change_request_schema>;

/** Body the handlers send to Rails. */
export const internal_mode_change_request_schema = mode_change_request_schema.extend({
  actor_staff_user_id: z.number().int().positive(),
});
export type InternalModeChangeRequest = z.infer<
  typeof internal_mode_change_request_schema
>;

/** What Rails answers after a mode change. */
export const internal_mode_change_result_schema = z.object({
  operational_mode: z.object({
    id: z.number().int().positive(),
    mode: operational_mode_name_schema,
    reason: z.string().min(1),
    staff_user_id: z.number().int().positive(),
    created_at: timestamp_schema,
  }),
  audit_log_id: z.number().int().positive(),
});
export type InternalModeChangeResult = z.infer<
  typeof internal_mode_change_result_schema
>;
