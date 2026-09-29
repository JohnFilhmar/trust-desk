import { randomUUID } from "node:crypto";
import { z } from "zod";

const uuid_schema = z.uuid();

/**
 * Picks the correlation id for a request.
 *
 * @param incoming - The `x-correlation-id` header, or `null` when absent.
 * @returns The incoming value when it is a valid UUID, otherwise a new UUID.
 *   Anything else is dropped, so a caller cannot write free text into the logs.
 */
export function resolve_correlation_id(incoming: string | null): string {
  const parsed = uuid_schema.safeParse(incoming);
  return parsed.success ? parsed.data : randomUUID();
}
