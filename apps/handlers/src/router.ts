import type { Deps } from "#app/interfaces/deps.ts";
import { authorize, origin_allowed } from "#app/lib/auth/authorize.ts";
import { resolve_correlation_id } from "#app/lib/http/correlation_id.ts";
import { error_response } from "#app/lib/http/json_response.ts";
import { routes } from "#app/routes.ts";
import type { Route } from "#app/types/handler.ts";

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

const messages = {
  unauthenticated: "Sign in to continue.",
  forbidden: "Your group is not allowed to do this.",
} as const;

/**
 * Runs the checks every request passes through, in a fixed order: origin,
 * route, session, permission, handler. It is also the single place where an
 * unexpected error becomes a response, so no handler can leak one.
 *
 * @param req - The incoming request.
 * @param deps - Shared dependencies.
 * @param table - The routes to search. Defaults to every route of the service.
 * @returns The handler's response, or 403 for a foreign origin, 404 when
 *   nothing matches, 401 or 403 from the access check, or 500 with a generic
 *   message. The detail of a 500 goes to the log, never to the caller.
 */
export async function dispatch(
  req: Request,
  deps: Deps,
  table: readonly Route[] = routes,
): Promise<Response> {
  const correlation_id = resolve_correlation_id(req.headers.get("x-correlation-id"));
  const { pathname } = new URL(req.url);

  if (!origin_allowed(req, deps.config.allowed_origins)) {
    deps.logger.warn({ correlation_id }, "Request refused: origin not allowed.");
    return error_response(
      403,
      "origin_not_allowed",
      "This request did not come from the console.",
      correlation_id,
    );
  }

  for (const route of table) {
    if (route.method !== req.method) continue;
    const params = match_pattern(route.pattern, pathname);
    if (params === null) continue;

    try {
      const decision = await authorize(req, deps, route.access);
      if (!decision.allowed) {
        return error_response(
          decision.status,
          decision.code,
          messages[decision.code],
          correlation_id,
        );
      }
      return await route.handler(req, deps, {
        correlation_id,
        params,
        user: decision.user,
      });
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
