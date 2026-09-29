import type { SessionResponse } from "@trust-desk/shared";
import { signed_in_user } from "#app/lib/auth/signed_in_user.ts";
import { json_response } from "#app/lib/http/json_response.ts";
import type { Handler } from "#app/types/handler.ts";

/**
 * `GET /api/session`. Tells the console who is signed in.
 *
 * @returns 200 with the user. The router answers 401 before this runs when
 *   nobody is signed in.
 */
export const get_session: Handler = async (_req, _deps, context) => {
  const body: SessionResponse = { user: signed_in_user(context) };
  return json_response(body, 200, context.correlation_id);
};
