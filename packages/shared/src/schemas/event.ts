import { z } from "zod";
import { timestamp_schema } from "./account.ts";

export const event_type_schema = z.enum([
  "signup",
  "login",
  "login_failed",
  "payment",
  "payment_failed",
  "deploy",
  "cpu_spike",
  "abuse_report",
  "api_burst",
]);
export type EventType = z.infer<typeof event_type_schema>;

/** One entry of an account's timeline. `payload` is masked before it leaves the server. */
export const account_event_schema = z.object({
  id: z.number().int().positive(),
  event_type: event_type_schema,
  occurred_at: timestamp_schema,
  payload: z.record(z.string(), z.unknown()),
});
export type AccountEvent = z.infer<typeof account_event_schema>;

/** Query string of `GET /api/accounts/:account_id/events`. */
export const event_query_schema = z.object({
  event_type: event_type_schema.optional(),
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type EventQuery = z.infer<typeof event_query_schema>;

/** Body of `GET /api/accounts/:account_id/events`, newest first. */
export const event_list_response_schema = z.object({
  items: z.array(account_event_schema),
  next_cursor: z.string().nullable(),
});
export type EventListResponse = z.infer<typeof event_list_response_schema>;
