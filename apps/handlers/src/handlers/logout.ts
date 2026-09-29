import { build_set_cookie } from "#app/lib/auth/session_cookie.ts";
import type { Handler } from "#app/types/handler.ts";

/**
 * `POST /api/logout`. Ends the session by telling the browser to drop the
 * cookie. It needs no session, so it also works with an expired one.
 *
 * The cookie is stateless, so a copy taken before logout stays valid until
 * it expires. That is the known cost of having no session table.
 *
 * @returns 204 with a cookie of zero lifetime.
 */
export const logout: Handler = async (_req, deps, context) => {
  return new Response(null, {
    status: 204,
    headers: {
      "set-cookie": build_set_cookie("", deps.config.secure_cookies),
      "cache-control": "no-store",
      "x-correlation-id": context.correlation_id,
    },
  });
};
