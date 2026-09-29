import type { HealthResponse } from "@trust-desk/shared";
import { json_response } from "#app/lib/http/json_response.ts";
import type { Handler } from "#app/types/handler.ts";

/**
 * `GET /api/health`. Needs no session. Compose and nginx use it to decide
 * whether this container is fit to receive traffic.
 *
 * @returns 200 when MySQL answers, 503 when it does not.
 */
export const health: Handler = async (_req, deps, context) => {
  const database_up = await deps.db.ping();
  const body: HealthResponse = {
    status: database_up ? "ok" : "degraded",
    database: database_up ? "up" : "down",
  };
  return json_response(body, database_up ? 200 : 503, context.correlation_id);
};
