import { health } from "#app/handlers/health.ts";
import type { Deps } from "#app/interfaces/deps.ts";
import { resolve_correlation_id } from "#app/lib/http/correlation_id.ts";
import { error_response } from "#app/lib/http/json_response.ts";
import type { Handler } from "#app/types/handler.ts";

export type Route = {
  method: string;
  /** A path whose segments are literal or, with a leading colon, captured. */
  pattern: string;
  handler: Handler;
};

/** Every endpoint this service answers. One line per handler file. */
export const routes: readonly Route[] = [
  { method: "GET", pattern: "/api/health", handler: health },
];

/**
 * Compares a path with a route pattern, segment by segment.
 *
 * @param pattern - Such as `/api/accounts/:account_id`.
 * @param pathname - The request path, without the query string.
 * @returns The captured values, or `null` when the path does not fit.
 */
export function match_pattern(
  pattern: string,
  pathname: string,
): Record<string, string> | null {
  const expected = pattern.split("/");
  const actual = pathname.split("/");
  if (expected.length !== actual.length) return null;

  const params: Record<string, string> = {};
  for (const [index, segment] of expected.entries()) {
    const value = actual[index];
    if (value === undefined) return null;
    if (segment.startsWith(":")) {
      if (value === "") return null;
      params[segment.slice(1)] = decodeURIComponent(value);
    } else if (segment !== value) {
      return null;
    }
  }
  return params;
}

/**
 * Finds the handler for a request and runs it. This is the single place
 * where an unexpected error becomes a response, so no handler can leak one.
 *
 * @param req - The incoming request.
 * @param deps - Shared dependencies.
 * @param table - The routes to search. Defaults to every route of the service.
 * @returns The handler's response, 404 when nothing matches, or 500 with a
 *   generic message. The detail of a 500 goes to the log, never to the caller.
 */
export async function dispatch(
  req: Request,
  deps: Deps,
  table: readonly Route[] = routes,
): Promise<Response> {
  const correlation_id = resolve_correlation_id(
    req.headers.get("x-correlation-id"),
  );
  const { pathname } = new URL(req.url);

  for (const route of table) {
    if (route.method !== req.method) continue;
    const params = match_pattern(route.pattern, pathname);
    if (params === null) continue;

    try {
      return await route.handler(req, deps, { correlation_id, params });
    } catch (error) {
      deps.logger.error(
        { correlation_id, route: route.pattern, err: error },
        "Handler failed.",
      );
      return error_response(
        500,
        "internal_error",
        "Something went wrong. Quote the correlation id when you report it.",
        correlation_id,
      );
    }
  }

  return error_response(404, "not_found", "Not found.", correlation_id);
}
