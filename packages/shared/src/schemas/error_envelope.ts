import { z } from "zod";

/**
 * Every failure response from the handlers and from Rails has this shape.
 * `code` is stable and meant for programs. `message` is generic and safe to
 * show. `correlation_id` lets someone find the full detail in the logs.
 */
export const error_envelope_schema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    correlation_id: z.uuid(),
  }),
});

export type ErrorEnvelope = z.infer<typeof error_envelope_schema>;
