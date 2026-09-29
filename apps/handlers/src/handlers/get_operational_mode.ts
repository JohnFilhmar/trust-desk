import { json_response } from "#app/lib/http/json_response.ts";
import { present_mode } from "#app/lib/modes/present_mode.ts";
import type { Handler } from "#app/types/handler.ts";

/**
 * `GET /api/operational_mode`. Tells the console which mode is in force,
 * who set it and why, and what the mode changes.
 *
 * @returns 200 with the mode. `normal` when no mode was ever set.
 */
export const get_operational_mode: Handler = async (_req, deps, context) => {
  return json_response(
    present_mode(await deps.db.find_current_mode()),
    200,
    context.correlation_id,
  );
};
