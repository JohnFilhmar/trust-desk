import type { ErrorEnvelope } from "@trust-desk/shared";

const json_headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

/**
 * Builds a JSON response.
 *
 * @param body - Any value `JSON.stringify` accepts.
 * @param status - HTTP status code. Defaults to 200.
 * @param correlation_id - Echoed in `x-correlation-id` so a caller can quote it.
 * @returns A response that no cache may store.
 */
export function json_response(
  body: unknown,
  status: number,
  correlation_id: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...json_headers, "x-correlation-id": correlation_id },
  });
}

/**
 * Builds the one error shape every failure uses.
 *
 * @param status - HTTP status code.
 * @param code - Stable machine-readable code, such as `not_found`.
 * @param message - Generic text safe to show a user. Never a stack trace or SQL.
 * @param correlation_id - Links the response to the full detail in the logs.
 * @returns A JSON response holding an error envelope.
 */
export function error_response(
  status: number,
  code: string,
  message: string,
  correlation_id: string,
): Response {
  const body: ErrorEnvelope = { error: { code, message, correlation_id } };
  return json_response(body, status, correlation_id);
}
