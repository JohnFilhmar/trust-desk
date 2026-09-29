import { z } from "zod";

/** Body of `GET /api/health`. `database` is `down` when MySQL cannot be reached. */
export const health_response_schema = z.object({
  status: z.enum(["ok", "degraded"]),
  database: z.enum(["up", "down"]),
});

export type HealthResponse = z.infer<typeof health_response_schema>;
