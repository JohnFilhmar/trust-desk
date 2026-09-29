import type { Permission, SessionUser } from "@trust-desk/shared";
import type { Deps } from "#app/interfaces/deps.ts";

/** Values worked out for one request before its handler runs. */
export type RequestContext = {
  correlation_id: string;
  /** Values captured from the path, such as `account_id` from `/api/accounts/:account_id`. */
  params: Record<string, string>;
  /** The signed-in staff user. `null` only on a route whose access is `public`. */
  user: SessionUser | null;
};

/**
 * The shape of every endpoint. It uses the web-standard Request and Response,
 * so the same function runs behind the Node adapter and on AWS Lambda.
 */
export type Handler = (
  req: Request,
  deps: Deps,
  context: RequestContext,
) => Promise<Response>;

/**
 * Who may call a route. There is no default: a route with no `access` does
 * not compile, so nobody can expose one by forgetting.
 *
 * - `public`: no session needed
 * - `session`: any signed-in staff user
 * - a permission: a signed-in staff user who holds it
 */
export type RouteAccess = "public" | "session" | Permission;

export type Route = {
  method: string;
  /** A path whose segments are literal or, with a leading colon, captured. */
  pattern: string;
  access: RouteAccess;
  handler: Handler;
};
