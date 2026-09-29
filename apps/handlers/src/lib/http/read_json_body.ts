import type { z } from "zod";

export type BodyResult<Body> = { ok: true; body: Body } | { ok: false };

/**
 * Reads a request body as JSON and validates it.
 *
 * @param req - The incoming request. Its body is consumed.
 * @param schema - The shape the body must have.
 * @returns The parsed body, or `ok: false` when the body is not JSON or does
 *   not fit the schema. The caller answers 422 without saying which field
 *   failed, since the console validates the same rules before sending.
 */
export async function read_json_body<Body>(
  req: Request,
  schema: z.ZodType<Body>,
): Promise<BodyResult<Body>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false };
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? { ok: true, body: parsed.data } : { ok: false };
}
