import { has_permission, permissions_for } from "@trust-desk/shared";
import type { SessionUser } from "@trust-desk/shared";
import type { Deps } from "#app/interfaces/deps.ts";
import {
  read_cookie,
  read_session_value,
  session_cookie_name,
} from "#app/lib/auth/session_cookie.ts";
import type { RouteAccess } from "#app/types/handler.ts";

export type Authorization =
  | { allowed: true; user: SessionUser | null }
  | { allowed: false; status: 401 | 403; code: "unauthenticated" | "forbidden" };

/**
 * Reads the session cookie and loads the staff user behind it.
 *
 * @param req - The incoming request.
 * @param deps - Shared dependencies.
 * @returns The user, or `null` when the cookie is missing, invalid or
 *   expired, or the user no longer exists. The group is read from the
 *   database on every request, so a change of group takes effect at once.
 */
export async function load_session_user(
  req: Request,
  deps: Deps,
): Promise<SessionUser | null> {
  const value = read_cookie(req.headers.get("cookie"), session_cookie_name);
  if (value === null) return null;

  const payload = read_session_value(deps.config.session_secret, value, deps.clock.now());
  if (payload === null) return null;

  const row = await deps.db.find_staff_user_by_id(payload.staff_user_id);
  if (row === null) return null;

  return { ...row, permissions: permissions_for(row.group_name) };
}

/**
 * Decides whether a request may reach a route.
 *
 * @param req - The incoming request.
 * @param deps - Shared dependencies.
 * @param access - What the route demands.
 * @returns Allowed with the user, 401 when nobody is signed in, or 403 when
 *   the user lacks the permission.
 */
export async function authorize(
  req: Request,
  deps: Deps,
  access: RouteAccess,
): Promise<Authorization> {
  if (access === "public") return { allowed: true, user: null };

  const user = await load_session_user(req, deps);
  if (user === null) return { allowed: false, status: 401, code: "unauthenticated" };
  if (access === "session") return { allowed: true, user };

  if (!has_permission(user.group_name, access)) {
    return { allowed: false, status: 403, code: "forbidden" };
  }
  return { allowed: true, user };
}

/**
 * Checks the Origin header of a state-changing request.
 *
 * @param req - The incoming request.
 * @param allowed_origins - The origins the console is served from.
 * @returns `true` for GET, HEAD and OPTIONS, which change nothing. For every
 *   other method, `true` only when Origin is present and on the list. A
 *   missing Origin is refused: every browser sends one on a POST.
 */
export function origin_allowed(req: Request, allowed_origins: readonly string[]): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const origin = req.headers.get("origin");
  return origin !== null && allowed_origins.includes(origin);
}
